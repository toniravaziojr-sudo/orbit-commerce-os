import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * external-shipping-sync-cron
 * 1) Drena meli_invoice_send_queue (chama meli-send-invoice)
 * 2) Re-sincroniza marketplace_shipments não-terminais (chama meli-fetch-shipment)
 * 3) Despacha para Pratika os shipments com NF+tracking prontos e ainda não enviados
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supaUrl, supaKey);

  const summary: any = { invoice_queue: null, shipments_refreshed: 0, pratika_dispatched: 0 };

  // 1) drenar fila NF→ML
  try {
    const r = await fetch(`${supaUrl}/functions/v1/meli-send-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supaKey}` },
      body: JSON.stringify({ processQueue: true }),
    });
    summary.invoice_queue = await r.json().catch(() => null);
  } catch (e) {
    summary.invoice_queue_error = String(e?.message || e);
  }

  // 2) refresh de shipments não-terminais (últimas 24h e em movimento)
  const { data: pending } = await supabase
    .from("marketplace_shipments")
    .select("tenant_id, external_shipment_id, order_id")
    .eq("source_key", "mercadolivre")
    .in("status", ["awaiting_invoice", "ready_to_ship", "in_transit"])
    .order("updated_at", { ascending: true })
    .limit(50);

  for (const s of pending || []) {
    try {
      await fetch(`${supaUrl}/functions/v1/meli-fetch-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supaKey}` },
        body: JSON.stringify({ tenantId: s.tenant_id, shipmentId: s.external_shipment_id, orderId: s.order_id }),
      });
      summary.shipments_refreshed++;
    } catch (e) {
      console.error("[external-shipping-sync-cron] refresh err:", e);
    }
  }

  // 3) despachar Pratika (label_issued/in_transit com NF enviada e ainda não enviados à Pratika)
  const { data: ready } = await supabase
    .from("marketplace_shipments")
    .select("id, tenant_id, invoice_id, order_id")
    .eq("source_key", "mercadolivre")
    .not("tracking_number", "is", null)
    .not("invoice_id", "is", null)
    .is("pratika_sent_at", null)
    .limit(30);

  for (const m of ready || []) {
    try {
      const r = await fetch(`${supaUrl}/functions/v1/wms-pratika-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supaKey}` },
        body: JSON.stringify({ action: "send_combined", invoice_id: m.invoice_id, tenant_id: m.tenant_id }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.success) {
        await supabase.from("marketplace_shipments").update({ pratika_sent_at: new Date().toISOString() }).eq("id", m.id);
        summary.pratika_dispatched++;
      } else if (j?.skipped) {
        // aguardando algum requisito; ignorar até próxima rodada
      } else {
        await supabase.from("marketplace_shipments").update({ last_error: j?.error || "pratika erro" }).eq("id", m.id);
      }
    } catch (e) {
      console.error("[external-shipping-sync-cron] pratika err:", e);
    }
  }

  return new Response(JSON.stringify({ success: true, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
