import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v2.0.0"; // Fase 6b: Sync to main orders table
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Shop Orders Sync
 *
 * Actions:
 * - list: Lista pedidos sincronizados do banco
 * - sync: Busca pedidos da API TikTok Shop e salva/atualiza no banco
 *
 * Body: { tenantId, action, filters? }
 * filters: { status?, startDate?, endDate?, page?, pageSize? }
 */
serve(async (req) => {
  console.log(`[tiktok-shop-orders-sync][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida", code: "INVALID_SESSION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { tenantId, action = "list", filters = {} } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório", code: "MISSING_TENANT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso", code: "FORBIDDEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LIST =====
    if (action === "list") {
      let query = supabase
        .from("tiktok_shop_orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      const limit = filters.pageSize || 50;
      const offset = ((filters.page || 1) - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        console.error(`[tiktok-shop-orders-sync][${VERSION}] List error:`, error);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao listar pedidos", code: "FETCH_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SYNC =====
    if (action === "sync") {
      // Buscar conexão
      const { data: connection } = await supabase
        .from("tiktok_shop_connections")
        .select("access_token, shop_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .single();

      if (!connection?.access_token || !connection?.shop_id) {
        return new Response(
          JSON.stringify({ success: false, error: "TikTok Shop não conectado", code: "NOT_CONNECTED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const appKey = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_SHOP_APP_KEY");
      if (!appKey) {
        return new Response(
          JSON.stringify({ success: false, error: "TIKTOK_SHOP_APP_KEY não configurada", code: "NOT_CONFIGURED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar pedidos da API TikTok Shop
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

      const searchBody = {
        page_size: 50,
        sort_order: "DESC",
        sort_field: "CREATE_TIME",
        create_time_ge: filters.startDate
          ? Math.floor(new Date(filters.startDate).getTime() / 1000)
          : thirtyDaysAgo,
        create_time_lt: filters.endDate
          ? Math.floor(new Date(filters.endDate).getTime() / 1000)
          : now,
      };

      const ordersUrl = `https://open-api.tiktokglobalshop.com/order/202309/orders/search?app_key=${appKey}&shop_id=${connection.shop_id}`;

      const ordersResponse = await fetch(ordersUrl, {
        method: "POST",
        headers: {
          "x-tts-access-token": connection.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      });

      const ordersText = await ordersResponse.text();
      let ordersData: any;
      try {
        ordersData = JSON.parse(ordersText);
      } catch {
        console.error(`[tiktok-shop-orders-sync][${VERSION}] Non-JSON response from TikTok`);
        return new Response(
          JSON.stringify({ success: false, error: "Resposta inválida da API TikTok", code: "API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (ordersData.code !== 0) {
        console.error(`[tiktok-shop-orders-sync][${VERSION}] TikTok API error:`, ordersData);
        return new Response(
          JSON.stringify({
            success: false,
            error: ordersData.message || "Erro na API TikTok",
            code: "TIKTOK_API_ERROR",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const orders = ordersData.data?.orders || [];
      let syncedCount = 0;
      let errorCount = 0;

      for (const order of orders) {
        try {
          const tiktokOrderId = order.id || order.order_id;
          const buyerInfo = order.buyer_info || {};
          const paymentInfo = order.payment_info || {};
          const items = (order.line_items || order.order_line_list || []).map((item: any) => ({
            tiktokSkuId: item.sku_id,
            productName: item.product_name || item.sku_name,
            quantity: item.quantity,
            salePriceCents: Math.round((item.sale_price || 0) * 100),
            originalPriceCents: Math.round((item.original_price || 0) * 100),
            imageUrl: item.sku_image,
          }));

          const totalCents = Math.round(
            (paymentInfo.total_amount || paymentInfo.original_total_price || 0) * 100
          );

          const shippingAddress = order.recipient_address || order.shipping_address || null;

          const { error: upsertError } = await supabase
            .from("tiktok_shop_orders")
            .upsert(
              {
                tenant_id: tenantId,
                tiktok_order_id: tiktokOrderId,
                status: mapTikTokOrderStatus(order.status),
                tiktok_status: order.status,
                buyer_name: buyerInfo.name || null,
                buyer_email: buyerInfo.email || null,
                buyer_phone: buyerInfo.phone || null,
                shipping_address: shippingAddress,
                order_total_cents: totalCents,
                currency: paymentInfo.currency || "BRL",
                items,
                order_data: order,
                synced_at: new Date().toISOString(),
                last_error: null,
              },
              { onConflict: "tenant_id,tiktok_order_id" }
            );

          if (upsertError) {
            console.warn(`[tiktok-shop-orders-sync][${VERSION}] Upsert error for ${tiktokOrderId}:`, upsertError);
            errorCount++;
          } else {
            syncedCount++;

            // === Sync to main orders table ===
            const mainOrderStatus = mapToMainOrderStatus(order.status);
            const mainPaymentStatus = mapToMainPaymentStatus(order.status);
            const mainShippingStatus = mapToMainShippingStatus(order.status);

            const sourceHash = `tiktokshop:${tenantId}:${tiktokOrderId}`;

            const mainOrderData: Record<string, any> = {
              tenant_id: tenantId,
              source_platform: "tiktokshop",
              marketplace_source: "tiktokshop",
              marketplace_order_id: tiktokOrderId,
              source_order_number: tiktokOrderId,
              source_hash: sourceHash,
              status: mainOrderStatus,
              payment_status: mainPaymentStatus,
              shipping_status: mainShippingStatus,
              customer_name: buyerInfo.name || "TikTok Shop Buyer",
              customer_email: buyerInfo.email || `tiktok_${tiktokOrderId}@marketplace.local`,
              customer_phone: buyerInfo.phone || null,
              subtotal: totalCents / 100,
              total: totalCents / 100,
              discount_total: 0,
              shipping_total: 0,
              tax_total: 0,
              currency: paymentInfo.currency || "BRL",
              marketplace_data: { tiktokOrderId, tiktokStatus: order.status, items },
              updated_at: new Date().toISOString(),
            };

            // Add shipping address if available
            if (shippingAddress) {
              mainOrderData.shipping_street = shippingAddress.address_detail || shippingAddress.full_address || null;
              mainOrderData.shipping_city = shippingAddress.city || null;
              mainOrderData.shipping_state = shippingAddress.state || shippingAddress.region || null;
              mainOrderData.shipping_postal_code = shippingAddress.zipcode || shippingAddress.postal_code || null;
              mainOrderData.shipping_country = shippingAddress.country || "BR";
            }

            if (mainOrderStatus === "delivered") {
              mainOrderData.delivered_at = new Date().toISOString();
            }
            if (mainPaymentStatus === "paid") {
              mainOrderData.paid_at = new Date().toISOString();
            }

            // Check if order exists in main table
            const { data: existingOrder } = await supabase
              .from("orders")
              .select("id")
              .eq("source_hash", sourceHash)
              .maybeSingle();

            if (existingOrder) {
              // Update existing
              await supabase
                .from("orders")
                .update(mainOrderData)
                .eq("id", existingOrder.id);

              // Link tiktok_shop_orders to main order
              await supabase
                .from("tiktok_shop_orders")
                .update({ order_id: existingOrder.id })
                .eq("tenant_id", tenantId)
                .eq("tiktok_order_id", tiktokOrderId);
            } else {
              // Insert new with order_number
              const { data: lastOrder } = await supabase
                .from("orders")
                .select("order_number")
                .eq("tenant_id", tenantId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              const lastNum = lastOrder?.order_number
                ? parseInt(lastOrder.order_number.replace(/\D/g, ""), 10) || 0
                : 0;
              mainOrderData.order_number = `ORD-${String(lastNum + 1).padStart(4, "0")}`;

              const { data: newOrder } = await supabase
                .from("orders")
                .insert(mainOrderData)
                .select("id")
                .single();

              if (newOrder) {
                // Link tiktok_shop_orders to main order
                await supabase
                  .from("tiktok_shop_orders")
                  .update({ order_id: newOrder.id })
                  .eq("tenant_id", tenantId)
                  .eq("tiktok_order_id", tiktokOrderId);

                // Insert order items
                const orderItems = items.map((item: any, idx: number) => ({
                  order_id: newOrder.id,
                  tenant_id: tenantId,
                  product_name: item.productName,
                  quantity: item.quantity,
                  unit_price: item.salePriceCents / 100,
                  total_price: (item.salePriceCents * item.quantity) / 100,
                  sort_order: idx,
                }));

                if (orderItems.length > 0) {
                  await supabase.from("order_items").insert(orderItems);
                }
              }
            }
          }
        } catch (err) {
          console.warn(`[tiktok-shop-orders-sync][${VERSION}] Error processing order:`, err);
          errorCount++;
        }
      }

      console.log(
        `[tiktok-shop-orders-sync][${VERSION}] Synced ${syncedCount}, errors ${errorCount}, total from API ${orders.length}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            synced: syncedCount,
            errors: errorCount,
            totalFromApi: orders.length,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}`, code: "UNKNOWN_ACTION" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-shop-orders-sync][${VERSION}] Erro:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
        code: "INTERNAL_ERROR",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function mapTikTokOrderStatus(tiktokStatus: string): string {
  const map: Record<string, string> = {
    UNPAID: "pending",
    ON_HOLD: "pending",
    AWAITING_SHIPMENT: "confirmed",
    AWAITING_COLLECTION: "confirmed",
    PARTIALLY_SHIPPING: "shipping",
    IN_TRANSIT: "shipping",
    DELIVERED: "delivered",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  };
  return map[tiktokStatus] || "pending";
}

function mapToMainOrderStatus(tiktokStatus: string): string {
  const map: Record<string, string> = {
    UNPAID: "awaiting_payment",
    ON_HOLD: "pending",
    AWAITING_SHIPMENT: "processing",
    AWAITING_COLLECTION: "processing",
    PARTIALLY_SHIPPING: "shipped",
    IN_TRANSIT: "in_transit",
    DELIVERED: "delivered",
    COMPLETED: "delivered",
    CANCELLED: "cancelled",
  };
  return map[tiktokStatus] || "pending";
}

function mapToMainPaymentStatus(tiktokStatus: string): string {
  const map: Record<string, string> = {
    UNPAID: "pending",
    ON_HOLD: "pending",
    AWAITING_SHIPMENT: "paid",
    AWAITING_COLLECTION: "paid",
    PARTIALLY_SHIPPING: "paid",
    IN_TRANSIT: "paid",
    DELIVERED: "paid",
    COMPLETED: "paid",
    CANCELLED: "refunded",
  };
  return map[tiktokStatus] || "pending";
}

function mapToMainShippingStatus(tiktokStatus: string): string {
  const map: Record<string, string> = {
    UNPAID: "pending",
    ON_HOLD: "pending",
    AWAITING_SHIPMENT: "pending",
    AWAITING_COLLECTION: "ready",
    PARTIALLY_SHIPPING: "shipped",
    IN_TRANSIT: "in_transit",
    DELIVERED: "delivered",
    COMPLETED: "delivered",
    CANCELLED: "cancelled",
  };
  return map[tiktokStatus] || "pending";
}
