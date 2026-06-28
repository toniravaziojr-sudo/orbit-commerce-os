import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * meli-fetch-shipment
 * Busca dados do shipment e baixa o PDF da etiqueta do ML.
 * Body: { tenantId, shipmentId, orderId? }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { tenantId, shipmentId, orderId } = await req.json();
    if (!tenantId || !shipmentId) return json({ success: false, error: "tenantId e shipmentId obrigatórios" }, 200);

    const { data: conn } = await supabase
      .from("marketplace_connections").select("*")
      .eq("tenant_id", tenantId).eq("marketplace", "mercadolivre").eq("is_active", true).maybeSingle();
    if (!conn) return json({ success: false, error: "Conexão ML não encontrada" }, 200);

    // 1. Dados do shipment
    const shRes = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });
    if (!shRes.ok) {
      const t = await shRes.text();
      return json({ success: false, error: `shipment HTTP ${shRes.status}: ${t.slice(0, 200)}` }, 200);
    }
    const shipment = await shRes.json();

    const mlStatus = shipment?.status || "pending";
    const trackingNumber = shipment?.tracking_number || null;
    const trackingMethod = shipment?.tracking_method || null;
    const carrier = shipment?.shipping_option?.shipping_method?.name || trackingMethod || null;

    const statusMap: Record<string, string> = {
      pending: "awaiting_invoice",
      ready_to_ship: "ready_to_ship",
      handling: "ready_to_ship",
      shipped: "in_transit",
      delivered: "delivered",
      not_delivered: "problem",
      cancelled: "cancelled",
    };
    const status = statusMap[mlStatus] || "ready_to_ship";

    // 2. Resolver order_id se não veio
    let resolvedOrderId = orderId || null;
    if (!resolvedOrderId) {
      const mlOrderId = shipment?.order_id ? String(shipment.order_id) : null;
      if (mlOrderId) {
        const { data: o } = await supabase
          .from("orders").select("id").eq("tenant_id", tenantId)
          .eq("marketplace_order_id", mlOrderId).maybeSingle();
        resolvedOrderId = o?.id || null;
      }
    }

    // 3. Tentar baixar PDF da etiqueta (só se ML já liberou)
    let labelUrl: string | null = null;
    if (["ready_to_ship", "shipped", "delivered"].includes(mlStatus)) {
      const labelRes = await fetch(
        `https://api.mercadolibre.com/shipment_labels?shipment_ids=${shipmentId}&response_type=pdf`,
        { headers: { Authorization: `Bearer ${conn.access_token}` } }
      );
      if (labelRes.ok) {
        const buf = new Uint8Array(await labelRes.arrayBuffer());
        const path = `${tenantId}/${shipmentId}.pdf`;
        const up = await supabase.storage.from("marketplace-labels").upload(path, buf, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (!up.error) {
          const { data: signed } = await supabase.storage.from("marketplace-labels").createSignedUrl(path, 60 * 60 * 24 * 7);
          labelUrl = signed?.signedUrl || path;
        }
      } else {
        console.warn(`[meli-fetch-shipment] PDF não disponível: ${labelRes.status}`);
      }
    }

    // 4. Upsert
    const { data: row, error: upErr } = await supabase.from("marketplace_shipments").upsert({
      tenant_id: tenantId,
      label_origin: "marketplace",
      source_key: "mercadolivre",
      order_id: resolvedOrderId,
      marketplace_order_id: shipment?.order_id ? String(shipment.order_id) : null,
      external_shipment_id: String(shipmentId),
      carrier,
      tracking_number: trackingNumber,
      tracking_url: trackingNumber ? `https://www.mercadolibre.com.br/envios/${shipmentId}` : null,
      status,
      label_pdf_url: labelUrl,
      label_fetched_at: labelUrl ? new Date().toISOString() : null,
      last_tracking_event_at: new Date().toISOString(),
      raw: shipment,
    }, { onConflict: "tenant_id,source_key,external_shipment_id" }).select().single();

    if (upErr) return json({ success: false, error: upErr.message }, 200);
    return json({ success: true, shipment: row, has_label: !!labelUrl }, 200);
  } catch (e) {
    console.error("[meli-fetch-shipment] erro:", e);
    return json({ success: false, error: String(e?.message || e) }, 200);
  }
});

function json(b: any, s: number) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
