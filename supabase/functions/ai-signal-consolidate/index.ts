// Edge Function: ai-signal-consolidate
// Consolida candidatos de sinais (últimos 7 dias) em grupos canônicos.
// Promove grupos relevantes a insights pendentes (status='pendente').
// Roda semanalmente para todos tenants ativos.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface CanonicalGroup {
  id: string;
  tenant_id: string;
  insight_type: string;
  canonical_label: string;
  evidence_count: number;
  unique_customer_count: number;
  variations: string[];
  product_id: string | null;
  last_seen_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const targetTenantId: string | undefined = body?.tenant_id;

    // 1. Listar tenants alvo (todos ou específico)
    let tenantsQuery = supabase.from("tenants").select("id");
    if (targetTenantId) tenantsQuery = supabase.from("tenants").select("id").eq("id", targetTenantId);

    const { data: tenants, error: tenantsErr } = await tenantsQuery;
    if (tenantsErr) throw tenantsErr;

    const results: any[] = [];

    for (const tenant of tenants || []) {
      const tenantId = tenant.id;
      try {
        const tenantResult = await consolidateTenant(supabase, tenantId);
        results.push({ tenant_id: tenantId, ...tenantResult });
      } catch (e) {
        console.error(`[consolidate] tenant ${tenantId} failed:`, e);
        results.push({ tenant_id: tenantId, error: (e as Error).message });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        duration_ms: Date.now() - startedAt,
        tenants_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[consolidate] fatal:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function consolidateTenant(supabase: any, tenantId: string) {
  const periodEnd = new Date();
  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Buscar grupos canônicos atualizados nos últimos 7 dias
  const { data: groups, error: groupsErr } = await supabase
    .from("ai_signal_canonical_groups")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("last_seen_at", periodStart.toISOString())
    .order("evidence_count", { ascending: false })
    .limit(50);

  if (groupsErr) throw groupsErr;
  if (!groups || groups.length === 0) {
    return { groups_evaluated: 0, insights_created: 0, insights_updated: 0 };
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const group of groups as CanonicalGroup[]) {
    // 2. Verificar relevância adaptativa via SQL function
    const { data: isRelevant, error: relevanceErr } = await supabase.rpc("is_signal_relevant", {
      _tenant_id: tenantId,
      _evidence_count: group.evidence_count,
      _unique_customer_count: group.unique_customer_count,
      _period_days: 7,
    });
    if (relevanceErr) {
      console.error(`[consolidate] is_signal_relevant failed for group ${group.id}:`, relevanceErr.message);
      continue;
    }

    if (!isRelevant) continue;

    // 3. Verificar se já existe insight ativo para este grupo
    const { data: existing } = await supabase
      .from("ai_brain_insights")
      .select("id, status, evidence_count, unique_customer_count, variations")
      .eq("tenant_id", tenantId)
      .eq("canonical_group_id", group.id)
      .in("status", ["pendente", "aprovado"])
      .maybeSingle();

    if (existing) {
      // Atualizar contadores e variações se já existe
      const mergedVariations = Array.from(
        new Set([...(existing.variations || []), ...(group.variations || [])]),
      ).slice(0, 20);

      await supabase
        .from("ai_brain_insights")
        .update({
          evidence_count: group.evidence_count,
          unique_customer_count: group.unique_customer_count,
          variations: mergedVariations,
          period_end: periodEnd.toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      updatedCount++;
      continue;
    }

    // 4. Gerar título + resumo + recomendação via Gemini
    const generated = await generateInsightContent(group);
    if (!generated) continue;

    // 5. Criar insight pendente
    const { error: insertErr } = await supabase.from("ai_brain_insights").insert({
      tenant_id: tenantId,
      canonical_group_id: group.id,
      insight_type: group.insight_type,
      title: generated.title,
      summary: generated.summary,
      recommendation: generated.recommendation,
      is_urgent: generated.is_urgent,
      evidence_count: group.evidence_count,
      unique_customer_count: group.unique_customer_count,
      variations: group.variations || [],
      product_id: group.product_id,
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      status: "pendente",
      // Escopos default: todos ligados — usuário decide ao aprovar
      scope_vendas: true,
      scope_landing: true,
      scope_trafego: true,
      scope_auxiliar: true,
    });

    if (insertErr) {
      console.error(`[consolidate] insert insight failed for group ${group.id}:`, insertErr);
      continue;
    }
    createdCount++;
  }

  return {
    groups_evaluated: groups.length,
    insights_created: createdCount,
    insights_updated: updatedCount,
  };
}

async function generateInsightContent(group: CanonicalGroup): Promise<{
  title: string;
  summary: string;
  recommendation: string;
  is_urgent: boolean;
} | null> {
  const samples = (group.variations || []).slice(0, 8).join(" | ");

  const systemPrompt = `Você é um analista de comportamento de clientes.
Receberá um padrão recorrente detectado em conversas e deve gerar:
- title: nome curto e direto do padrão (máx 60 chars)
- summary: explicação clara do que está acontecendo e por quê é relevante (2-3 frases)
- recommendation: ação concreta sugerida para o agente de IA (1-2 frases)
- is_urgent: true se o padrão indica perda de venda iminente, problema operacional ou objeção crítica

Tom: executivo, objetivo, em PT-BR. Sem jargão técnico.`;

  const userPrompt = `Tipo do padrão: ${group.insight_type}
Conceito canônico: ${group.canonical_label}
Ocorrências: ${group.evidence_count} (${group.unique_customer_count} clientes únicos)
Exemplos reais: ${samples}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_insight",
              description: "Emite o insight estruturado",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", maxLength: 80 },
                  summary: { type: "string" },
                  recommendation: { type: "string" },
                  is_urgent: { type: "boolean" },
                },
                required: ["title", "summary", "recommendation", "is_urgent"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_insight" } },
      }),
    });

    if (!resp.ok) {
      console.error("[consolidate] gateway error:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    return JSON.parse(args);
  } catch (e) {
    console.error("[consolidate] generation failed:", e);
    return null;
  }
}
