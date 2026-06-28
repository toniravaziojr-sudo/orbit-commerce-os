import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * meli-send-invoice
 * Anexa a chave da NF autorizada ao shipment do pedido no Mercado Livre.
 * Pré-requisito para o ML liberar a etiqueta.
 *
 * Body: { tenantId, orderId, invoiceId? }
 * Modo cron: { processQueue: true } drena meli_invoice_send_queue.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));

  if (body.processQueue) {
    return await drainQueue(supabase);
  }

  const { tenantId, orderId, invoiceId } = body;
  if (!tenantId || !orderId) {
    return json({ success: false, error: "tenantId e orderId obrigatórios" }, 200);
  }

  try {
    const result = await sendInvoice(supabase, tenantId, orderId, invoiceId);
    return json(result, 200);
  } catch (e) {
    console.error("[meli-send-invoice] erro:", e);
    return json({ success: false, error: String(e?.message || e) }, 200);
  }
});

async function drainQueue(supabase: any) {
  const { data: rows } = await supabase
    .from("meli_invoice_send_queue")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);

  const processed: any[] = [];
  for (const row of rows || []) {
    await supabase.from("meli_invoice_send_queue").update({ status: "processing", attempts: row.attempts + 1 }).eq("id", row.id);
    try {
      const r = await sendInvoice(supabase, row.tenant_id, row.order_id, row.invoice_id);
      if (r.success) {
        await supabase.from("meli_invoice_send_queue").update({ status: "done", done_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
      } else {
        await supabase.from("meli_invoice_send_queue").update({
          status: "failed",
          last_error: r.error || "unknown",
          next_attempt_at: new Date(Date.now() + Math.min(60, row.attempts + 1) * 60_000).toISOString(),
        }).eq("id", row.id);
      }
      processed.push({ id: row.id, ...r });
    } catch (e) {
      await supabase.from("meli_invoice_send_queue").update({
        status: "failed",
        last_error: String(e?.message || e),
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      }).eq("id", row.id);
    }
  }
  return json({ success: true, processed: processed.length, details: processed }, 200);
}

async function sendInvoice(supabase: any, tenantId: string, orderId: string, invoiceId?: string) {
  // 1. Conexão ML
  const { data: conn } = await supabase
    .from("marketplace_connections").select("*")
    .eq("tenant_id", tenantId).eq("marketplace", "mercadolivre").eq("is_active", true).maybeSingle();
  if (!conn) return { success: false, error: "Conexão ML não encontrada" };

  // 2. Pedido + shipping_id ML
  const { data: order } = await supabase
    .from("orders").select("id, marketplace_order_id, marketplace_data")
    .eq("id", orderId).eq("tenant_id", tenantId).maybeSingle();
  if (!order) return { success: false, error: "Pedido não encontrado" };

  const mlOrderId = order.marketplace_order_id;
  if (!mlOrderId) return { success: false, error: "marketplace_order_id ausente" };

  // Buscar shipment_id no ML
  let shipmentId: string | null = (order.marketplace_data as any)?.shipping?.id || null;
  if (!shipmentId) {
    const r = await fetch(`https://api.mercadolibre.com/orders/${mlOrderId}`, {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });
    if (r.ok) {
      const d = await r.json();
      shipmentId = d?.shipping?.id || null;
    }
  }
  if (!shipmentId) return { success: false, error: "shipment_id não disponível no pedido ML" };

  // 3. NF autorizada
  let invQ = supabase.from("fiscal_invoices")
    .select("id, chave_acesso, xml_url, status")
    .eq("tenant_id", tenantId).eq("status", "authorized")
    .not("chave_acesso", "is", null);
  invQ = invoiceId ? invQ.eq("id", invoiceId) : invQ.eq("order_id", orderId);
  const { data: invoice } = await invQ.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!invoice?.chave_acesso) return { success: false, error: "NF autorizada não encontrada" };

  // 4. Enviar para o ML: POST /shipments/{id}/invoice_data
  const chave = String(invoice.chave_acesso).replace(/\D/g, "");
  const payload = { invoice_data: { number: chave, type: "N", date_created: new Date().toISOString() } };

  const resp = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}/invoice_data`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const respText = await resp.text();
  if (!resp.ok) {
    console.error(`[meli-send-invoice] ML ${resp.status}:`, respText);
    return { success: false, error: `ML HTTP ${resp.status}: ${respText.slice(0, 300)}` };
  }

  // 5. Upsert marketplace_shipments
  await supabase.from("marketplace_shipments").upsert({
    tenant_id: tenantId,
    label_origin: "marketplace",
    source_key: "mercadolivre",
    order_id: orderId,
    marketplace_order_id: mlOrderId,
    external_shipment_id: String(shipmentId),
    invoice_id: invoice.id,
    invoice_sent_at: new Date().toISOString(),
    status: "ready_to_ship",
  }, { onConflict: "tenant_id,source_key,external_shipment_id" });

  return { success: true, shipment_id: shipmentId, invoice_id: invoice.id };
}

function json(b: any, s: number) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
