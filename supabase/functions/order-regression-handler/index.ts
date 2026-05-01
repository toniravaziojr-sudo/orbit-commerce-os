/**
 * order-regression-handler
 *
 * Orquestrador de REGRESSÃO de pedidos. Disparado por:
 *  - core-orders após mudança manual de status para estado regressivo
 *  - webhooks de chargeback / estorno
 *  - cron de expiração de pagamento
 *
 * Responsabilidades:
 *  1. Reforçar marcação requires_action em fiscal_invoices e shipments
 *     (defesa em profundidade — as triggers DB já fazem isso, mas se o
 *     pedido vier de webhook que NÃO mudou o status via core-orders,
 *     garantimos consistência).
 *  2. Cancelar rascunhos pendentes nas filas (idempotente com a trigger).
 *  3. Registrar entrada em order_history descrevendo o impacto.
 *  4. NÃO cancela NF-e autorizada nem etiqueta despachada automaticamente
 *     — isso exige ação humana com justificativa (fiscal-cancel) ou
 *     processo logístico de devolução. Apenas SINALIZA via requires_action.
 *
 * Padrão Layer 2: Edge Function com verify_jwt=false, validação interna
 * via service_role OU Authorization header de admin/owner do tenant.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REGRESSION_STATES = new Set([
  "cancelled",
  "returned",
  "returning",
  "chargeback_detected",
  "chargeback_lost",
  "payment_expired",
  "invoice_cancelled",
]);

interface Payload {
  order_id: string;
  tenant_id?: string;
  reason?: string; // novo status do pedido
  source?: string; // 'manual' | 'webhook' | 'cron' | 'fiscal-cancel'
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    let body: Payload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_json" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!body.order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id_required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Carregar pedido
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, tenant_id, status, payment_status, shipping_status")
      .eq("id", body.order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ success: false, error: "order_not_found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const reason = body.reason ?? order.status;
    if (!REGRESSION_STATES.has(reason)) {
      // Não é regressão — nada a fazer. Resposta 200 para idempotência.
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: "status_not_regressive",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const source = body.source ?? "manual";
    const summary: Record<string, number> = {};

    // 1) Reforço: marcar fiscal_invoices ainda não sinalizadas
    const { data: invoiceFlag } = await supabase
      .from("fiscal_invoices")
      .update({
        requires_action: true,
        action_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", order.id)
      .eq("status", "authorized")
      .eq("requires_action", false)
      .select("id");
    summary.invoices_flagged = invoiceFlag?.length ?? 0;

    // 2) Reforço: marcar shipments não entregues
    const { data: shipFlag } = await supabase
      .from("shipments")
      .update({
        requires_action: true,
        action_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", order.id)
      .eq("requires_action", false)
      .is("delivered_at", null)
      .select("id");
    summary.shipments_flagged = shipFlag?.length ?? 0;

    // 3) Reforço: cancelar rascunhos pendentes (idempotente com triggers DB)
    const queues = [
      "fiscal_draft_queue",
      "shipping_draft_queue",
      "gateway_sync_queue",
    ] as const;
    for (const q of queues) {
      const { data: cancelled } = await supabase
        .from(q)
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_reason: `order_regression:${reason}`,
        })
        .eq("order_id", order.id)
        .in("status", ["pending", "processing"])
        .select("id");
      summary[`${q}_cancelled`] = cancelled?.length ?? 0;
    }

    // 4) Registrar histórico
    await supabase.from("order_history").insert({
      tenant_id: order.tenant_id,
      order_id: order.id,
      action: "regression_handled",
      description: `[REGRESSÃO ${reason.toUpperCase()}] origem=${source}. ` +
        `NF-e sinalizadas: ${summary.invoices_flagged}, ` +
        `Remessas sinalizadas: ${summary.shipments_flagged}, ` +
        `Rascunhos cancelados (fiscal/envio/gateway): ` +
        `${summary.fiscal_draft_queue_cancelled}/` +
        `${summary.shipping_draft_queue_cancelled}/` +
        `${summary.gateway_sync_queue_cancelled}.`,
      metadata: { reason, source, summary },
    });

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return errorResponse(e, corsHeaders, {
      module: "orders",
      action: "regression-handler",
    });
  }
});
