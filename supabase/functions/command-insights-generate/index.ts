import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletionJSON } from "../_shared/ai-router.ts";
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOG = `[command-insights-generate][${VERSION}]`;

interface InsightItem {
  title: string;
  summary: string;
  category: string;
  severity: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth: only service role (cron) or authenticated owner/admin
    const authHeader = req.headers.get("Authorization") || "";
    const body = await req.json().catch(() => ({}));
    const { tenant_id: reqTenantId } = body;

    let tenantIds: string[] = [];

    // If called with service role key (cron mode) — process all active tenants or specific one
    if (authHeader.includes(supabaseKey)) {
      if (reqTenantId) {
        tenantIds = [reqTenantId];
      } else {
        const { data: tenants } = await supabase
          .from("tenants")
          .select("id")
          .eq("is_active", true)
          .limit(200);
        tenantIds = (tenants || []).map((t: any) => t.id);
      }
    } else {
      // Manual call: validate user access
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!reqTenantId) {
        return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use a user-scoped client so auth.uid() works inside the RPC
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: access } = await userClient.rpc("user_has_tenant_access", { p_tenant_id: reqTenantId });
      if (!access) {
        return new Response(JSON.stringify({ error: "Sem acesso ao tenant" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tenantIds = [reqTenantId];
    }

    console.log(`${LOG} Processing ${tenantIds.length} tenant(s)`);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);
    periodStart.setHours(0, 0, 0, 0);

    let totalInsights = 0;

    for (const tenantId of tenantIds) {
      try {
        // Check if insights already exist for this period
        const { data: existing } = await supabase
          .from("command_insights")
          .select("id")
          .eq("tenant_id", tenantId)
          .gte("period_end", periodStart.toISOString())
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`${LOG} Skipping tenant ${tenantId} — insights already generated for this period`);
          continue;
        }

        // Collect metrics
        const metrics = await collectMetrics(supabase, tenantId, periodStart, periodEnd);
        console.log(`${LOG} Metrics collected for tenant ${tenantId}:`, JSON.stringify(metrics).substring(0, 300));

        if (!hasSignificantData(metrics)) {
          console.log(`${LOG} Skipping tenant ${tenantId} — no significant data`);
          continue;
        }

        // Generate insights via AI
        const insights = await generateInsights(metrics, supabaseUrl, supabaseKey);
        console.log(`${LOG} Generated ${insights.length} insights for tenant ${tenantId}`);

        // Save insights
        if (insights.length > 0) {
          const rows = insights.map((insight: InsightItem) => ({
            tenant_id: tenantId,
            title: insight.title,
            summary: insight.summary,
            category: insight.category,
            severity: insight.severity,
            data: metrics,
            status: "new",
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
          }));

          const { error: insertErr } = await supabase.from("command_insights").insert(rows);
          if (insertErr) {
            console.error(`${LOG} Insert error for tenant ${tenantId}:`, insertErr);
          } else {
            totalInsights += insights.length;
          }
        }
      } catch (tenantErr) {
        console.error(`${LOG} Error processing tenant ${tenantId}:`, tenantErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, tenants_processed: tenantIds.length, insights_generated: totalInsights }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`${LOG} Fatal error:`, error);
    return errorResponse(error, corsHeaders, { module: "insights", action: "generate" });
  }
});

async function collectMetrics(supabase: any, tenantId: string, periodStart: Date, periodEnd: Date) {
  const startISO = periodStart.toISOString();
  const endISO = periodEnd.toISOString();

  const [
    ordersRes,
    revenueRes,
    cancelledRes,
    chargebackRes,
    pendingShipmentRes,
    lowStockRes,
    conversationsRes,
    nfePendingRes,
    adActionsRes,
  ] = await Promise.all([
    // Total orders in period
    supabase.from("orders").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", startISO).lte("created_at", endISO),
    // Revenue (paid orders)
    supabase.from("orders").select("total_cents")
      .eq("tenant_id", tenantId).eq("payment_status", "paid")
      .gte("created_at", startISO).lte("created_at", endISO),
    // Cancelled orders
    supabase.from("orders").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "cancelled")
      .gte("created_at", startISO).lte("created_at", endISO),
    // Chargebacks
    supabase.from("orders").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).in("status", ["chargeback_detected", "chargeback_lost"]),
    // Pending shipment
    supabase.from("orders").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "paid"),
    // Low stock products
    (supabase.from("products") as any).select("id, name, stock, min_stock")
      .eq("tenant_id", tenantId).eq("is_active", true).is("deleted_at", null)
      .not("stock", "is", null).not("min_stock", "is", null).limit(100),
    // Support conversations needing attention
    supabase.from("conversations").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).in("status", ["new", "waiting_agent"]),
    // NF-e pending (fiscal documents)
    supabase.from("fiscal_documents").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "draft"),
    // Ads autopilot pending actions
    supabase.from("ads_autopilot_actions").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "pending"),
  ]);

  const revenueData = revenueRes.data || [];
  const totalRevenueCents = revenueData.reduce((sum: number, o: any) => sum + (o.total_cents || 0), 0);
  const avgTicketCents = revenueData.length > 0 ? Math.round(totalRevenueCents / revenueData.length) : 0;

  const lowStockProducts = (lowStockRes.data || []).filter((p: any) => p.stock <= p.min_stock);

  return {
    period: { start: startISO, end: endISO },
    orders: {
      total: ordersRes.count || 0,
      paid: revenueData.length,
      cancelled: cancelledRes.count || 0,
      chargebacks: chargebackRes.count || 0,
      pending_shipment: pendingShipmentRes.count || 0,
    },
    revenue: {
      total_cents: totalRevenueCents,
      avg_ticket_cents: avgTicketCents,
    },
    stock: {
      low_stock_count: lowStockProducts.length,
      low_stock_products: lowStockProducts.slice(0, 5).map((p: any) => p.name),
    },
    support: {
      awaiting_agent: conversationsRes.count || 0,
    },
    fiscal: {
      nfe_pending: nfePendingRes.count || 0,
    },
    ads: {
      pending_actions: adActionsRes.count || 0,
    },
  };
}

function hasSignificantData(metrics: any): boolean {
  return (
    metrics.orders.total > 0 ||
    metrics.stock.low_stock_count > 0 ||
    metrics.support.awaiting_agent > 0 ||
    metrics.fiscal.nfe_pending > 0
  );
}

async function generateInsights(metrics: any, supabaseUrl: string, supabaseKey: string): Promise<InsightItem[]> {
  const systemPrompt = `Você é um analista de negócios de e-commerce brasileiro. Analise as métricas semanais fornecidas e gere insights acionáveis. Seja direto e prático. Foque em:
- Tendências de vendas e receita
- Problemas operacionais (envios pendentes, NF-e, chargebacks)
- Alertas de estoque
- Oportunidades de melhoria

Gere entre 3 e 6 insights relevantes. Se os números forem baixos ou normais, destaque oportunidades em vez de problemas.`;

  const userPrompt = `Métricas da semana:\n${JSON.stringify(metrics, null, 2)}`;

  const { data: aiResponse } = await aiChatCompletionJSON(
    "google/gemini-2.5-flash",
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "save_insights",
          description: "Salva os insights gerados a partir da análise de métricas semanais do negócio.",
          parameters: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Título curto e direto do insight (máx. 80 chars)" },
                    summary: { type: "string", description: "Descrição acionável do insight em 1-3 frases" },
                    category: {
                      type: "string",
                      enum: ["vendas", "estoque", "marketing", "operacoes", "financeiro"],
                      description: "Categoria do insight",
                    },
                    severity: {
                      type: "string",
                      enum: ["info", "warning", "critical"],
                      description: "Severidade: info (oportunidade), warning (atenção), critical (urgente)",
                    },
                  },
                  required: ["title", "summary", "category", "severity"],
                  additionalProperties: false,
                },
              },
            },
            required: ["insights"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "save_insights" } },
    },
    { supabaseUrl, supabaseServiceKey: supabaseKey, logPrefix: LOG, maxRetries: 2, baseDelayMs: 3000 }
  );

  try {
    const toolCall = aiResponse?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error(`${LOG} No tool call in AI response`);
      return [];
    }
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.insights || [];
  } catch (e) {
    console.error(`${LOG} Failed to parse AI response:`, e);
    return [];
  }
}
