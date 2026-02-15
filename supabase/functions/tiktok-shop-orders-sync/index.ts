import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Fase 6: TikTok Shop orders sync
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
