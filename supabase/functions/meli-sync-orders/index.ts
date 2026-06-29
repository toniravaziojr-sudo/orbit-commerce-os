import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre — Sync Orders (v2 com enriquecimento)
 *
 * Estratégia:
 *  1) GET /orders/{id}           → pedido (itens, valores, status, buyer.id/nickname)
 *  2) GET /orders/{id}/billing_info → doc_number/doc_type, razão social, endereço fiscal
 *  3) GET /shipments/{id} (x-format-new) → endereço de entrega real + telefone receptor
 *  4) Resolve/cria cliente preferindo: last_external_id → cpf → email real.
 *     Synthetic email só como fallback (constraint NOT NULL); marcado em notes.
 *  5) Define payment_gateway='mercadolivre' + payment_gateway_id (provider local)
 *     para que o pedido entre nos relatórios financeiros sem exceções.
 */

const ML_BASE = "https://api.mercadolibre.com";

async function mlGet(url: string, token: string, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn(`[meli-sync-orders] GET ${url} -> ${res.status} ${txt.slice(0, 200)}`);
    return null;
  }
  return await res.json().catch(() => null);
}

function onlyDigits(s: unknown): string | null {
  if (s == null) return null;
  const d = String(s).replace(/\D+/g, "");
  return d.length > 0 ? d : null;
}

function pickFullName(billing: any, buyer: any, meliOrderId: string): string {
  const billingName =
    billing?.buyer?.name ||
    [billing?.buyer?.first_name, billing?.buyer?.last_name].filter(Boolean).join(" ") ||
    billing?.buyer?.billing_info?.business_name ||
    null;
  const buyerName = [buyer?.first_name, buyer?.last_name].filter(Boolean).join(" ").trim();
  return (billingName || buyerName || buyer?.nickname || `Comprador ML ${meliOrderId}`).trim();
}

function pickDoc(billing: any): { cpf: string | null; cnpj: string | null; person_type: "fisica" | "juridica" | null } {
  const id = billing?.buyer?.billing_info?.identification || billing?.buyer?.identification || billing?.payer?.identification;
  if (!id) return { cpf: null, cnpj: null, person_type: null };
  const type = String(id.type || "").toUpperCase();
  const num = onlyDigits(id.number);
  if (!num) return { cpf: null, cnpj: null, person_type: null };
  if (type === "CPF" || num.length === 11) return { cpf: num, cnpj: null, person_type: "fisica" };
  if (type === "CNPJ" || num.length === 14) return { cpf: null, cnpj: num, person_type: "juridica" };
  return { cpf: null, cnpj: null, person_type: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const { tenantId, orderId, fullSync } = body as { tenantId?: string; orderId?: string; fullSync?: boolean };

    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections").select("*")
      .eq("tenant_id", tenantId).eq("marketplace", "mercadolivre").eq("is_active", true).single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ success: false, error: "Conexão ML não encontrada ou inativa" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = connection.access_token as string;
    const sellerId = connection.external_user_id;

    // Resolver provider local de pagamento (para entrar nos relatórios financeiros).
    const { data: provider } = await supabase
      .from("payment_providers").select("id")
      .eq("tenant_id", tenantId).eq("provider", "mercadolivre").maybeSingle();
    const paymentGatewayId: string | null = provider?.id ?? null;

    let orderIds: string[] = [];
    if (orderId) {
      orderIds = [String(orderId)];
    } else {
      const limit = fullSync ? 50 : 10;
      const search = await mlGet(`${ML_BASE}/orders/search?seller=${sellerId}&sort=date_desc&limit=${limit}`, accessToken);
      orderIds = (search?.results || []).map((o: any) => String(o.id));
    }

    console.log(`[meli-sync-orders] Tenant ${tenantId} — ${orderIds.length} pedidos a processar`);

    let synced = 0, errors = 0;

    for (const meliOrderId of orderIds) {
      try {
        const meliOrder = await mlGet(`${ML_BASE}/orders/${meliOrderId}`, accessToken);
        if (!meliOrder) { errors++; continue; }

        // Enriquecimento paralelo
        const shippingId = meliOrder?.shipping?.id;
        const [billing, shipment] = await Promise.all([
          mlGet(`${ML_BASE}/orders/${meliOrderId}/billing_info`, accessToken),
          shippingId
            ? mlGet(`${ML_BASE}/shipments/${shippingId}`, accessToken, { "x-format-new": "true" })
            : Promise.resolve(null),
        ]);
        console.log(`[meli-sync-orders][${meliOrderId}] billing=`, billing ? JSON.stringify(billing).slice(0, 800) : "null");
        console.log(`[meli-sync-orders][${meliOrderId}] shipment=`, shipment ? JSON.stringify(shipment).slice(0, 800) : "null");
        console.log(`[meli-sync-orders][${meliOrderId}] buyer=`, JSON.stringify(meliOrder.buyer || {}).slice(0, 400));

        const statusMap: Record<string, string> = {
          confirmed: "processing", paid: "processing",
          payment_required: "pending", payment_in_process: "pending", partially_paid: "pending",
          shipped: "shipped", delivered: "delivered", cancelled: "cancelled",
        };
        const paymentStatusMap: Record<string, string> = {
          approved: "approved", pending: "pending", authorized: "pending", in_process: "pending",
          rejected: "declined", refunded: "refunded", cancelled: "cancelled",
        };
        const orderStatus = statusMap[meliOrder.status] || "pending";
        const paymentStatus = meliOrder.payments?.[0]?.status
          ? paymentStatusMap[meliOrder.payments[0].status] || "pending"
          : "pending";

        const buyer = meliOrder.buyer || {};
        const fullName = pickFullName(billing, buyer, meliOrderId);
        const doc = pickDoc(billing);

        // Telefone — prioridade: shipment.receiver_phone > buyer.phone
        const shipReceiverPhone = shipment?.receiver_phone || shipment?.receiver_address?.receiver_phone || null;
        const buyerPhone = buyer?.phone?.area_code && buyer?.phone?.number
          ? `${buyer.phone.area_code}${buyer.phone.number}`
          : (buyer?.phone?.number || null);
        const phone = onlyDigits(shipReceiverPhone) || onlyDigits(buyerPhone);

        // Endereço real (shipment.receiver_address tem mais detalhes que order.shipping.receiver_address)
        const addr = shipment?.receiver_address || meliOrder?.shipping?.receiver_address || {};
        const shippingFields = {
          shipping_street: addr.street_name || addr.address_line || null,
          shipping_number: addr.street_number || addr.number || null,
          shipping_complement: addr.comment || addr.complement || null,
          shipping_neighborhood: addr.neighborhood?.name || addr.neighborhood || null,
          shipping_city: addr.city?.name || addr.city || null,
          shipping_state: addr.state?.id?.replace(/^BR-/, "") || addr.state?.name || null,
          shipping_postal_code: onlyDigits(addr.zip_code),
          shipping_country: addr.country?.id || "BR",
        };

        // Email real só se vier do billing/buyer (ML costuma ocultar)
        const realEmail = (billing?.buyer?.email || buyer?.email || "").toLowerCase().trim() || null;
        const syntheticEmail = `meli-${meliOrderId}@marketplace.local`;
        const customerEmail = realEmail || syntheticEmail;

        // Resolver/criar cliente — prioridade: last_external_id → cpf → email real
        let customerId: string | null = null;
        if (buyer?.id) {
          const { data: c } = await supabase.from("customers").select("id")
            .eq("tenant_id", tenantId)
            .eq("last_source_platform", "mercadolivre")
            .eq("last_external_id", String(buyer.id)).maybeSingle();
          if (c) customerId = c.id;
        }
        if (!customerId && doc.cpf) {
          const { data: c } = await supabase.from("customers").select("id")
            .eq("tenant_id", tenantId).eq("cpf", doc.cpf).maybeSingle();
          if (c) customerId = c.id;
        }
        if (!customerId && doc.cnpj) {
          const { data: c } = await supabase.from("customers").select("id")
            .eq("tenant_id", tenantId).eq("cnpj", doc.cnpj).maybeSingle();
          if (c) customerId = c.id;
        }
        if (!customerId && realEmail) {
          const { data: c } = await supabase.from("customers").select("id")
            .eq("tenant_id", tenantId).eq("email", realEmail).maybeSingle();
          if (c) customerId = c.id;
        }

        const customerPayload: Record<string, unknown> = {
          tenant_id: tenantId,
          email: customerEmail,
          full_name: fullName,
          phone,
          cpf: doc.cpf,
          cnpj: doc.cnpj,
          person_type: doc.person_type,
          last_source_platform: "mercadolivre",
          last_external_id: buyer?.id ? String(buyer.id) : null,
          address_postal_code: shippingFields.shipping_postal_code,
          address_street: shippingFields.shipping_street,
          address_number: shippingFields.shipping_number,
          address_complement: shippingFields.shipping_complement,
          address_neighborhood: shippingFields.shipping_neighborhood,
          address_city: shippingFields.shipping_city,
          address_state: shippingFields.shipping_state,
        };

        if (customerId) {
          // Não sobrescreve email canônico; apenas preenche campos vazios
          const patch = { ...customerPayload };
          delete (patch as any).email;
          delete (patch as any).tenant_id;
          await supabase.from("customers").update(patch).eq("id", customerId);
        } else {
          const { data: ins } = await supabase.from("customers").insert(customerPayload).select("id").single();
          customerId = ins?.id ?? null;
        }

        // Flags de dados pendentes (sem fabricar)
        const pendingFlags: string[] = [];
        if (!realEmail) pendingFlags.push("email");
        if (!doc.cpf && !doc.cnpj) pendingFlags.push("documento");
        if (!shippingFields.shipping_street) pendingFlags.push("endereco");
        if (!phone) pendingFlags.push("telefone");
        const customerNotes = pendingFlags.length
          ? `Importado do Mercado Livre — pendente: ${pendingFlags.join(", ")}.`
          : null;

        const shippingCost = Number(meliOrder?.shipping?.cost || 0);
        const subtotal = Number(meliOrder?.total_amount || 0);

        const orderData: Record<string, unknown> = {
          tenant_id: tenantId,
          customer_id: customerId,
          customer_name: fullName,
          customer_email: customerEmail,
          customer_phone: phone,
          customer_cpf: doc.cpf,
          customer_cnpj: doc.cnpj,
          customer_notes: customerNotes,
          order_number: `ML-${meliOrderId}`,
          status: orderStatus,
          payment_status: paymentStatus,
          payment_gateway: "mercadolivre",
          payment_gateway_id: paymentGatewayId,
          payment_method: meliOrder?.payments?.[0]?.payment_type || null,
          subtotal,
          shipping_total: shippingCost,
          total: subtotal + shippingCost,
          currency: meliOrder.currency_id || "BRL",
          sales_channel: "marketplace",
          marketplace_source: "mercadolivre",
          marketplace_order_id: meliOrderId,
          source_platform: "mercadolivre",
          source_order_number: meliOrder?.pack_id ? `PACK-${meliOrder.pack_id}` : meliOrderId,
          marketplace_data: {
            meli_order_id: meliOrder.id,
            meli_pack_id: meliOrder.pack_id,
            meli_status: meliOrder.status,
            meli_status_detail: meliOrder.status_detail,
            meli_shipping_id: shippingId,
            meli_shipping_status: meliOrder?.shipping?.status,
            meli_buyer_id: buyer.id,
            meli_buyer_nickname: buyer.nickname,
            meli_date_created: meliOrder.date_created,
            meli_billing_doc_type: doc.cpf ? "CPF" : doc.cnpj ? "CNPJ" : null,
            meli_pending_fields: pendingFlags,
          },
          ...shippingFields,
        };

        // Upsert manual (índice parcial em tenant_id+marketplace_order_id)
        const { data: existing } = await supabase.from("orders").select("id")
          .eq("tenant_id", tenantId).eq("marketplace_order_id", meliOrderId).maybeSingle();

        let upserted: { id: string } | null = null;
        if (existing?.id) {
          const { data: upd, error: updErr } = await supabase.from("orders")
            .update(orderData).eq("id", existing.id).select("id").single();
          if (updErr) { console.error(`[meli-sync-orders] Update ${meliOrderId}:`, updErr); errors++; continue; }
          upserted = upd;
        } else {
          const { data: ins, error: insErr } = await supabase.from("orders")
            .insert(orderData).select("id").single();
          if (insErr) { console.error(`[meli-sync-orders] Insert ${meliOrderId}:`, insErr); errors++; continue; }
          upserted = ins;
        }
        if (!upserted) { errors++; continue; }

        // Itens (snapshot)
        const meliItems = Array.isArray(meliOrder.order_items) ? meliOrder.order_items : [];
        if (meliItems.length > 0) {
          await supabase.from("order_items").delete().eq("order_id", upserted.id);

          const skus = meliItems
            .map((it: any) => it?.item?.seller_sku || it?.item?.seller_custom_field || null)
            .filter((s: string | null): s is string => !!s);

          const skuMap: Record<string, { id: string; weight: number | null; barcode: string | null; ncm: string | null }> = {};
          if (skus.length > 0) {
            const { data: prods } = await supabase.from("products")
              .select("id, sku, weight, barcode, ncm").eq("tenant_id", tenantId).in("sku", skus);
            (prods || []).forEach((p: any) => {
              if (p.sku) skuMap[p.sku] = { id: p.id, weight: p.weight, barcode: p.barcode, ncm: p.ncm };
            });
          }

          const itemRows = meliItems.map((it: any) => {
            const sku = it?.item?.seller_sku || it?.item?.seller_custom_field || `ML-${it?.item?.id || "SEMSKU"}`;
            const match = skuMap[sku] || null;
            const qty = Number(it.quantity || 1);
            const unit = Number(it.unit_price || 0);
            return {
              order_id: upserted!.id,
              tenant_id: tenantId,
              product_id: match?.id || null,
              sku,
              product_name: it?.item?.title || sku,
              quantity: qty,
              unit_price: unit,
              total_price: qty * unit,
              weight: match?.weight ?? null,
              barcode: match?.barcode ?? null,
              ncm: match?.ncm ?? null,
            };
          });

          const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
          if (itemsErr) console.error(`[meli-sync-orders] Items ${meliOrderId}:`, itemsErr);
        }

        synced++;
      } catch (orderError) {
        console.error(`[meli-sync-orders] Erro ${meliOrderId}:`, orderError);
        errors++;
      }
    }

    await supabase.from("marketplace_connections")
      .update({ last_sync_at: new Date().toISOString() }).eq("id", connection.id);

    await supabase.from("marketplace_sync_logs").insert({
      connection_id: connection.id,
      tenant_id: tenantId,
      sync_type: "orders",
      status: errors === 0 ? "completed" : (synced > 0 ? "partial" : "failed"),
      processed_count: orderIds.length,
      created_count: synced,
      failed_count: errors,
      details: { synced, errors, orderIds },
    });

    return new Response(JSON.stringify({ success: true, synced, errors, total: orderIds.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error, corsHeaders, { module: "mercadolivre", action: "sync-orders" });
  }
});
