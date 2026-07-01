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

    // Vocabulário canônico do sistema (shipping_status). Mesmo mapa usado na
    // ponte para orders.shipping_status logo abaixo — garante paridade entre
    // marketplace_shipments.status e orders.shipping_status.
    // Ver: docs/especificacoes/marketplaces/mercado-livre.md
    const statusMap: Record<string, string> = {
      pending: "awaiting_shipment",
      handling: "awaiting_shipment",
      ready_to_ship: trackingNumber ? "label_generated" : "awaiting_label",
      shipped: "shipped",
      delivered: "delivered",
      not_delivered: "problem",
      cancelled: "cancelled",
    };
    const status = statusMap[mlStatus] || (trackingNumber ? "label_generated" : "awaiting_shipment");

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

    // 5. Ponte marketplace_shipments → orders (espelha shipment-ingest).
    // Mapeia o status do shipment para o vocabulário canônico de orders.shipping_status,
    // promove orders.status para 'dispatched'/'delivered' quando ainda está em estado
    // pré-despacho, registra tracking_code/shipping_carrier/shipped_at/delivered_at e
    // nunca regride pedidos já em estados terminais.
    // Memória: mem://constraints/marketplace-shipment-promotes-order-mirrors-shipment-ingest
    let orderBridge: { applied: boolean; updates?: Record<string, unknown> } = { applied: false };
    if (resolvedOrderId) {
      try {
        const { data: ord } = await supabase
          .from("orders")
          .select("status, shipping_status, tracking_code, shipping_carrier, shipped_at, delivered_at")
          .eq("id", resolvedOrderId).maybeSingle();

        if (ord) {
          // marketplace_shipments.status já é canônico (vocabulário do sistema).
          // Usamos o mesmo valor em orders.shipping_status para manter paridade.
          const newShippingStatus = status;

          const terminalOrderStatuses = new Set([
            "shipped","in_transit","delivered","completed",
            "cancelled","returning","returned",
          ]);
          const preDispatchOrderStatuses = new Set([
            "paid","processing","ready_to_invoice","pending","awaiting_shipment",
            "invoice_pending_sefaz","invoice_authorized","invoice_issued","fulfilled",
          ]);
          const dispatchTriggerStatuses = new Set([
            "label_generated","shipped","delivered",
          ]);

          const updates: Record<string, unknown> = {};
          if (trackingNumber && trackingNumber !== ord.tracking_code) {
            updates.tracking_code = trackingNumber;
          }
          if (carrier && carrier !== ord.shipping_carrier) {
            updates.shipping_carrier = String(carrier).toLowerCase();
          }

          // Não regride pedidos terminais
          if (!terminalOrderStatuses.has(String(ord.status))) {
            if (newShippingStatus && newShippingStatus !== ord.shipping_status) {
              updates.shipping_status = newShippingStatus;
            }
            // Promoção para dispatched
            if (dispatchTriggerStatuses.has(status)
                && preDispatchOrderStatuses.has(String(ord.status))) {
              updates.status = "dispatched";
              if (!ord.shipped_at) updates.shipped_at = new Date().toISOString();
            }
            // Promoção para delivered (sem rebaixar pedidos já em delivered)
            if (status === "delivered") {
              if (!ord.delivered_at) updates.delivered_at = new Date().toISOString();
              if (ord.status !== "delivered") updates.status = "delivered";
            }
            // problem: só ajusta shipping_status, não toca orders.status
          }

          if (Object.keys(updates).length > 0) {
            const { error: ordErr } = await supabase
              .from("orders").update(updates).eq("id", resolvedOrderId);
            if (ordErr) {
              console.error("[meli-fetch-shipment] order bridge update:", ordErr);
            } else {
              orderBridge = { applied: true, updates };
              await supabase.from("order_history").insert({
                order_id: resolvedOrderId,
                action: "shipment_updated",
                description: `Marketplace shipment ${shipmentId} (${status}) — bridge aplicou: ${Object.keys(updates).join(", ")}`,
                new_value: { source: "marketplace_shipment", shipment_id: String(shipmentId), ml_status: mlStatus, ms_status: status, updates },
              });
            }
          }
        }
      } catch (bridgeErr) {
        console.error("[meli-fetch-shipment] bridge error:", bridgeErr);
      }
    }

    // 6. Envio para WMS Pratika (quando aplicável).
    // Só dispara se: (a) tenant tem Pratika ativa, (b) já temos código de rastreio,
    // (c) o pedido está vinculado. A NF autorizada é validada pelo wms-pratika-send.
    // Idempotência: wms-pratika-send tem trava única por invoice; ainda assim
    // marcamos pratika_sent_at para curto-circuito rápido.
    // Ver: mem://features/external-apps/wms-pratika-integration
    let pratika: { attempted: boolean; success?: boolean; skipped?: boolean; reason?: string } = { attempted: false };
    if (resolvedOrderId && trackingNumber && !row?.pratika_sent_at) {
      const { data: wmsCfg } = await supabase
        .from("wms_pratika_configs")
        .select("is_enabled").eq("tenant_id", tenantId).maybeSingle();
      if (wmsCfg?.is_enabled) {
        pratika.attempted = true;
        try {
          const sendRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/wms-pratika-send`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                action: "send_combined",
                order_id: resolvedOrderId,
                tenant_id: tenantId,
              }),
            }
          );
          const sendJson = await sendRes.json().catch(() => ({}));
          pratika.success = !!sendJson?.success;
          pratika.skipped = !!sendJson?.skipped;
          pratika.reason = sendJson?.reason || sendJson?.error || null;
          if (pratika.success && !pratika.skipped) {
            await supabase.from("marketplace_shipments")
              .update({ pratika_sent_at: new Date().toISOString() })
              .eq("id", row.id);
          }
        } catch (pratikaErr) {
          console.error("[meli-fetch-shipment] pratika send error:", pratikaErr);
          pratika.reason = String((pratikaErr as any)?.message || pratikaErr);
        }
      }
    }

    return json({ success: true, shipment: row, has_label: !!labelUrl, order_bridge: orderBridge, pratika }, 200);
  } catch (e) {
    console.error("[meli-fetch-shipment] erro:", e);
    return json({ success: false, error: String(e?.message || e) }, 200);
  }
});

function json(b: any, s: number) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
