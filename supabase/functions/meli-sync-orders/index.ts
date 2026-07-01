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

/**
 * billing_info do ML vem como:
 *   { billing_info: { doc_number, doc_type, additional_info: [{type,value}, ...] } }
 * Achata o additional_info em um map por TYPE para facilitar o consumo.
 */
function flattenBillingInfo(billing: any): Record<string, string> {
  const out: Record<string, string> = {};
  const root = billing?.billing_info || billing || {};
  if (root.doc_number) out.DOC_NUMBER = String(root.doc_number);
  if (root.doc_type) out.DOC_TYPE = String(root.doc_type).toUpperCase();
  const arr = Array.isArray(root.additional_info) ? root.additional_info : [];
  for (const it of arr) {
    if (it?.type && it.value != null) out[String(it.type).toUpperCase()] = String(it.value);
  }
  return out;
}

function pickFullName(bi: Record<string, string>, buyer: any, meliOrderId: string): string {
  const billingFull = bi.BUSINESS_NAME || bi.BUYER_NAME
    || [bi.FIRST_NAME, bi.LAST_NAME].filter(Boolean).join(" ").trim();
  const buyerName = [buyer?.first_name, buyer?.last_name].filter(Boolean).join(" ").trim();
  return (billingFull || buyerName || buyer?.nickname || `Comprador ML ${meliOrderId}`).trim();
}

function pickDoc(bi: Record<string, string>): { cpf: string | null; cnpj: string | null; person_type: "fisica" | "juridica" | null } {
  const type = (bi.DOC_TYPE || "").toUpperCase();
  const num = onlyDigits(bi.DOC_NUMBER);
  if (!num) return { cpf: null, cnpj: null, person_type: null };
  if (type === "CPF" || num.length === 11) return { cpf: num, cnpj: null, person_type: "fisica" };
  if (type === "CNPJ" || num.length === 14) return { cpf: null, cnpj: num, person_type: "juridica" };
  return { cpf: null, cnpj: null, person_type: null };
}

/** Extrai endereço a partir do billing_info achatado. */
function pickAddressFromBilling(bi: Record<string, string>) {
  return {
    shipping_street: bi.STREET_NAME || null,
    shipping_number: bi.STREET_NUMBER || null,
    shipping_complement: bi.COMMENT || null,
    shipping_neighborhood: bi.NEIGHBORHOOD || null,
    shipping_city: bi.CITY_NAME || null,
    shipping_state: (bi.STATE_CODE || "").replace(/^BR-/, "") || null,
    shipping_postal_code: onlyDigits(bi.ZIP_CODE),
    shipping_country: bi.COUNTRY_ID || "BR",
  };
}

/** Endereço/telefone do receptor a partir do shipment v2 (destination.receiver_address). */
function pickAddressFromShipment(shipment: any) {
  const dest = shipment?.destination || {};
  const addr = dest?.receiver_address || shipment?.receiver_address || {};
  const phone = dest?.receiver_phone || addr?.receiver_phone || null;
  return {
    phone,
    address: {
      shipping_street: addr.street_name || addr.address_line || null,
      shipping_number: addr.street_number || addr.number || null,
      shipping_complement: addr.comment || addr.complement || null,
      shipping_neighborhood: addr.neighborhood?.name || addr.neighborhood || null,
      shipping_city: addr.city?.name || addr.city || null,
      shipping_state: (addr.state?.id || addr.state?.name || "").replace(/^BR-/, "") || null,
      shipping_postal_code: onlyDigits(addr.zip_code),
      shipping_country: addr.country?.id || "BR",
    },
  };
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

    // Regra §8 padroes-operacionais: usar health_status como filtro canônico.
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections").select("*")
      .eq("tenant_id", tenantId).eq("marketplace", "mercadolivre")
      .neq("health_status", "needs_reauth").single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ success: false, error: "Conexão ML não encontrada ou precisa de reconexão" }), {
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
        const bi = flattenBillingInfo(billing);
        if (Deno.env.get("ML_SYNC_DEBUG") === "1") {
          console.log(`[meli-sync-orders][${meliOrderId}] bi=`, JSON.stringify(bi).slice(0, 600));
          console.log(`[meli-sync-orders][${meliOrderId}] shipment.destination=`, JSON.stringify(shipment?.destination || {}).slice(0, 600));
        }

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
        const fullName = pickFullName(bi, buyer, meliOrderId);
        const doc = pickDoc(bi);

        // Endereço — prioridade: shipment (destination.receiver_address) > billing_info
        const ship = pickAddressFromShipment(shipment);
        const billAddr = pickAddressFromBilling(bi);
        const shippingFields = {
          shipping_street: ship.address.shipping_street || billAddr.shipping_street,
          shipping_number: ship.address.shipping_number || billAddr.shipping_number,
          shipping_complement: ship.address.shipping_complement || billAddr.shipping_complement,
          shipping_neighborhood: ship.address.shipping_neighborhood || billAddr.shipping_neighborhood,
          shipping_city: ship.address.shipping_city || billAddr.shipping_city,
          shipping_state: ship.address.shipping_state || billAddr.shipping_state,
          shipping_postal_code: ship.address.shipping_postal_code || billAddr.shipping_postal_code,
          shipping_country: ship.address.shipping_country || billAddr.shipping_country,
        };

        // Telefone — shipment.destination.receiver_phone > buyer.phone
        const buyerPhone = buyer?.phone?.area_code && buyer?.phone?.number
          ? `${buyer.phone.area_code}${buyer.phone.number}`
          : (buyer?.phone?.number || null);
        const phone = onlyDigits(ship.phone) || onlyDigits(buyerPhone);

        // Email real só se vier do billing/buyer (ML costuma ocultar)
        const realEmail = (buyer?.email || "").toLowerCase().trim() || null;
        const syntheticEmail = `meli-${meliOrderId}@marketplace.local`;

        // Resolver/criar cliente — prioridade:
        //   last_external_id → cpf → cnpj → email real → telefone (variantes com/sem 55)
        // Telefone só é usado quando há identificação adicional (cpf, cnpj ou email)
        // ausente; segue a mesma normalização do `lookup_customer` da IA de atendimento.
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
        if (!customerId && phone) {
          const digits = phone;
          const variants = new Set<string>([digits]);
          if (digits.startsWith("55") && digits.length > 11) variants.add(digits.slice(2));
          else if (!digits.startsWith("55")) variants.add(`55${digits}`);
          const { data: c } = await supabase.from("customers").select("id, phone")
            .eq("tenant_id", tenantId)
            .in("phone", Array.from(variants))
            .limit(1).maybeSingle();
          if (c) customerId = c.id;
        }

        // Se já existe cliente, lê dados canônicos para propagar ao pedido sem sobrescrever
        let existingCustomer: { email: string | null; phone: string | null } | null = null;
        if (customerId) {
          const { data: c } = await supabase.from("customers")
            .select("email, phone").eq("id", customerId).maybeSingle();
          existingCustomer = c ?? null;
        }

        // E-mail final: real do ML > real já cadastrado > sintético
        const existingRealEmail = existingCustomer?.email && !existingCustomer.email.endsWith("@marketplace.local")
          ? existingCustomer.email
          : null;
        const customerEmail = realEmail || existingRealEmail || syntheticEmail;

        // Telefone final: do shipment > já cadastrado
        const finalPhone = phone || onlyDigits(existingCustomer?.phone) || null;

        const customerPayload: Record<string, unknown> = {
          tenant_id: tenantId,
          email: customerEmail,
          full_name: fullName,
          phone: finalPhone,
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
          // Não sobrescreve email canônico nem telefone existente; só preenche campos vazios
          // (política `profile-enrichment-policy-standard`).
          const patch: Record<string, unknown> = { ...customerPayload };
          delete (patch as any).email;
          delete (patch as any).tenant_id;
          if (existingCustomer?.phone) delete (patch as any).phone;
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

        // Identifica pedido pré-existente (para preservar order_number canônico em re-sync)
        const { data: existing } = await supabase.from("orders")
          .select("id, order_number, is_first_sale")
          .eq("tenant_id", tenantId)
          .eq("marketplace_order_id", meliOrderId)
          .maybeSingle();

        // Calcula is_first_sale: só TRUE se o cliente não tem nenhum outro pedido neste tenant
        let isFirstSale = false;
        if (!existing) {
          if (customerId) {
            const { count } = await supabase.from("orders")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tenantId)
              .eq("customer_id", customerId);
            isFirstSale = (count || 0) === 0;
          } else {
            isFirstSale = true; // cliente recém-criado neste mesmo sync
          }
        }

        const orderData: Record<string, unknown> = {
          tenant_id: tenantId,
          customer_id: customerId,
          customer_name: fullName,
          customer_email: customerEmail,
          customer_phone: finalPhone,
          customer_cpf: doc.cpf,
          customer_cnpj: doc.cnpj,
          customer_notes: customerNotes,
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

        // Metadados obrigatórios de cancelamento (trigger trg_guard_order_cancellation_metadata)
        if (orderStatus === "cancelled") {
          const cancelDate = meliOrder?.date_closed || meliOrder?.last_updated || meliOrder?.date_created || new Date().toISOString();
          const cancelReason = meliOrder?.status_detail?.description
            || meliOrder?.status_detail?.code
            || meliOrder?.cancel_detail?.description
            || meliOrder?.cancel_detail?.code
            || (typeof meliOrder?.status_detail === "string" ? meliOrder.status_detail : null)
            || "Pedido cancelado no Mercado Livre";
          (orderData as any).cancelled_at = cancelDate;
          (orderData as any).cancellation_reason = String(cancelReason).slice(0, 500);
        }


        let upserted: { id: string; order_number: string } | null = null;
        if (existing?.id) {
          // Re-sync: NÃO regenerar número, preservar is_first_sale calculado na 1ª importação
          // Guarda anti-rebaixamento (espelha o padrão do shipment-ingest): se o pedido já está
          // em estado avançado, NÃO sobrescreve `status` com o mapeamento ML (que só conhece
          // pending/processing/shipped/etc.). Apenas payment_status e demais campos são atualizados.
          // Memória: mem://constraints/marketplace-shipment-promotes-order-mirrors-shipment-ingest
          const { data: existingStatusRow } = await supabase.from("orders")
            .select("status").eq("id", existing.id).maybeSingle();
          const advancedStatuses = new Set([
            "invoice_pending_sefaz","invoice_authorized","invoice_issued",
            "dispatched","shipped","in_transit","delivered","completed",
            "cancelled","returning","returned",
          ]);
          const updatePayload: Record<string, unknown> = { ...orderData };
          if (existingStatusRow?.status && advancedStatuses.has(String(existingStatusRow.status))
              && orderStatus !== "cancelled") {
            delete (updatePayload as any).status;
          }
          const { data: upd, error: updErr } = await supabase.from("orders")
            .update(updatePayload).eq("id", existing.id)
            .select("id, order_number").single();
          if (updErr) { console.error(`[meli-sync-orders] Update ${meliOrderId}:`, updErr); errors++; continue; }
          upserted = upd;
        } else {
          // Novo pedido: aloca número sequencial canônico do tenant (#NNN)
          const { data: orderNumber, error: numErr } = await supabase
            .rpc("generate_order_number", { p_tenant_id: tenantId });
          if (numErr || !orderNumber) {
            console.error(`[meli-sync-orders] generate_order_number falhou para ${meliOrderId}:`, numErr);
            errors++; continue;
          }
          const insertPayload = { ...orderData, order_number: orderNumber, is_first_sale: isFirstSale };
          const { data: ins, error: insErr } = await supabase.from("orders")
            .insert(insertPayload).select("id, order_number").single();
          if (insErr) { console.error(`[meli-sync-orders] Insert ${meliOrderId}:`, insErr); errors++; continue; }
          upserted = ins;

          // Histórico: registra origem para aparecer no card "Histórico" do pedido
          await supabase.from("order_history").insert({
            order_id: ins.id,
            action: "imported_from_marketplace",
            description: `Pedido importado do Mercado Livre (ID externo ${meliOrderId})`,
            new_value: {
              marketplace: "mercadolivre",
              external_order_id: meliOrderId,
              meli_status: meliOrder.status,
              meli_pack_id: meliOrder.pack_id ?? null,
            },
          });
        }
        if (!upserted) { errors++; continue; }

        // Itens (snapshot)
        const meliItems = Array.isArray(meliOrder.order_items) ? meliOrder.order_items : [];
        if (meliItems.length > 0) {
          await supabase.from("order_items").delete().eq("order_id", upserted.id);

          const skus = meliItems
            .map((it: any) => it?.item?.seller_sku || it?.item?.seller_custom_field || null)
            .filter((s: string | null): s is string => !!s);

          const skuMap: Record<string, { id: string; weight: number | null; barcode: string | null; ncm: string | null; image_url: string | null }> = {};
          if (skus.length > 0) {
            const { data: prods } = await supabase.from("products")
              .select("id, sku, weight, barcode, ncm").eq("tenant_id", tenantId).in("sku", skus);
            const productIds = (prods || []).map((p: any) => p.id);
            // Busca em paralelo a imagem principal de cada produto resolvido
            const imageByProduct: Record<string, string> = {};
            if (productIds.length > 0) {
              const { data: imgs } = await supabase.from("product_images")
                .select("product_id, url, is_primary, sort_order")
                .in("product_id", productIds)
                .order("is_primary", { ascending: false })
                .order("sort_order", { ascending: true });
              (imgs || []).forEach((img: any) => {
                if (!imageByProduct[img.product_id] && img.url) {
                  imageByProduct[img.product_id] = img.url;
                }
              });
            }
            (prods || []).forEach((p: any) => {
              if (p.sku) skuMap[p.sku] = {
                id: p.id,
                weight: p.weight,
                barcode: p.barcode,
                ncm: p.ncm,
                image_url: imageByProduct[p.id] || null,
              };
            });
          }

          const itemRows = meliItems.map((it: any) => {
            const sku = it?.item?.seller_sku || it?.item?.seller_custom_field || `ML-${it?.item?.id || "SEMSKU"}`;
            const match = skuMap[sku] || null;
            const qty = Number(it.quantity || 1);
            const unit = Number(it.unit_price || 0);
            // Prioridade: imagem do catálogo (SKU resolvido) → thumbnail do anúncio ML
            const productImage = match?.image_url
              || it?.item?.secure_thumbnail
              || it?.item?.thumbnail
              || null;
            return {
              order_id: upserted!.id,
              tenant_id: tenantId,
              product_id: match?.id || null,
              sku,
              product_name: it?.item?.title || sku,
              product_image_url: productImage,
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
