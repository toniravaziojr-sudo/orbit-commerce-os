import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Shopee Sync Orders
 * 
 * Sincroniza pedidos da Shopee para a tabela orders.
 * Pode ser chamada manualmente ou por webhook.
 * 
 * Docs: https://open.shopee.com/documents/v2/v2.order.get_order_list
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { tenantId, orderId, fullSync } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão ativa do tenant
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "shopee")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão Shopee não encontrada ou inativa" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se token está válido
    const tokenExpired = connection.expires_at && new Date(connection.expires_at) < new Date();
    if (tokenExpired) {
      return new Response(
        JSON.stringify({ success: false, error: "Token Shopee expirado. Reconecte sua conta.", code: "token_expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais
    const partnerId = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_ID");
    const partnerKey = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_KEY");

    if (!partnerId || !partnerKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Shopee não configuradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = connection.access_token;
    const metadata = connection.metadata as Record<string, any> || {};
    const shopId = metadata.shop_id || parseInt(connection.external_user_id);
    const shopeeHost = "https://partner.shopeemobile.com";

    // Helper para criar assinatura
    const createSign = (path: string, timestamp: number) => {
      const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
      const hmac = createHmac("sha256", partnerKey);
      hmac.update(baseString);
      return hmac.digest("hex");
    };

    // Buscar lista de pedidos
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/order/get_order_list";
    const sign = createSign(path, timestamp);

    // Calcular time range (últimos 15 dias por padrão)
    const timeFrom = Math.floor((Date.now() - (fullSync ? 30 : 15) * 24 * 60 * 60 * 1000) / 1000);
    const timeTo = Math.floor(Date.now() / 1000);

    const orderListUrl = new URL(`${shopeeHost}${path}`);
    orderListUrl.searchParams.set("partner_id", partnerId);
    orderListUrl.searchParams.set("timestamp", timestamp.toString());
    orderListUrl.searchParams.set("sign", sign);
    orderListUrl.searchParams.set("shop_id", shopId.toString());
    orderListUrl.searchParams.set("access_token", accessToken);
    orderListUrl.searchParams.set("time_range_field", "create_time");
    orderListUrl.searchParams.set("time_from", timeFrom.toString());
    orderListUrl.searchParams.set("time_to", timeTo.toString());
    orderListUrl.searchParams.set("page_size", "50");

    const listResponse = await fetch(orderListUrl.toString());
    
    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error("[shopee-sync-orders] List error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar pedidos da Shopee" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listData = await listResponse.json();
    
    if (listData.error) {
      console.error("[shopee-sync-orders] API error:", listData.error, listData.message);
      return new Response(
        JSON.stringify({ success: false, error: `Erro Shopee: ${listData.message}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderSnList = listData.response?.order_list?.map((o: any) => o.order_sn) || [];
    console.log(`[shopee-sync-orders] Found ${orderSnList.length} orders for tenant ${tenantId}`);

    if (orderSnList.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, errors: 0, total: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar detalhes dos pedidos
    const detailTimestamp = Math.floor(Date.now() / 1000);
    const detailPath = "/api/v2/order/get_order_detail";
    const detailSign = createSign(detailPath, detailTimestamp);

    const detailUrl = new URL(`${shopeeHost}${detailPath}`);
    detailUrl.searchParams.set("partner_id", partnerId);
    detailUrl.searchParams.set("timestamp", detailTimestamp.toString());
    detailUrl.searchParams.set("sign", detailSign);
    detailUrl.searchParams.set("shop_id", shopId.toString());
    detailUrl.searchParams.set("access_token", accessToken);
    detailUrl.searchParams.set("order_sn_list", orderSnList.join(","));
    detailUrl.searchParams.set("response_optional_fields", "buyer_user_id,buyer_username,recipient_address,total_amount,order_status,payment_method,shipping_carrier");

    const detailResponse = await fetch(detailUrl.toString());
    
    if (!detailResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar detalhes dos pedidos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const detailData = await detailResponse.json();
    const orders = detailData.response?.order_list || [];

    let synced = 0;
    let errors = 0;

    // Mapear status da Shopee para nosso sistema
    const statusMap: Record<string, string> = {
      UNPAID: "pending",
      READY_TO_SHIP: "processing",
      PROCESSED: "processing",
      SHIPPED: "shipped",
      COMPLETED: "delivered",
      IN_CANCEL: "cancelled",
      CANCELLED: "cancelled",
      INVOICE_PENDING: "pending",
    };

    for (const shopeeOrder of orders) {
      try {
        const recipientAddress = shopeeOrder.recipient_address || {};
        
        // Buscar ou criar cliente
        let customerId: string | null = null;
        const buyerEmail = `${shopeeOrder.buyer_user_id}@shopee.user`;
        
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("email", buyerEmail)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer } = await supabase
            .from("customers")
            .insert({
              tenant_id: tenantId,
              email: buyerEmail,
              name: shopeeOrder.buyer_username || recipientAddress.name || "Cliente Shopee",
              phone: recipientAddress.phone || null,
              source: "shopee",
            })
            .select("id")
            .single();

          customerId = newCustomer?.id || null;
        }

        const orderStatus = statusMap[shopeeOrder.order_status] || "pending";
        const paymentStatus = shopeeOrder.order_status === "UNPAID" ? "pending" : "paid";

        const orderData = {
          tenant_id: tenantId,
          customer_id: customerId,
          status: orderStatus,
          payment_status: paymentStatus,
          subtotal: shopeeOrder.total_amount || 0,
          shipping_total: shopeeOrder.actual_shipping_fee || 0,
          total: (shopeeOrder.total_amount || 0) + (shopeeOrder.actual_shipping_fee || 0),
          currency: shopeeOrder.currency || "BRL",
          
          marketplace_source: "shopee",
          marketplace_order_id: shopeeOrder.order_sn,
          source_platform: "shopee",
          source_order_number: shopeeOrder.order_sn,
          marketplace_data: {
            shopee_order_sn: shopeeOrder.order_sn,
            shopee_status: shopeeOrder.order_status,
            shopee_buyer_id: shopeeOrder.buyer_user_id,
            shopee_buyer_username: shopeeOrder.buyer_username,
            shopee_shipping_carrier: shopeeOrder.shipping_carrier,
            shopee_create_time: shopeeOrder.create_time,
          },
          
          shipping_street: recipientAddress.full_address || null,
          shipping_city: recipientAddress.city || null,
          shipping_state: recipientAddress.state || null,
          shipping_postal_code: recipientAddress.zipcode || null,
          shipping_country: recipientAddress.region || "BR",
          
          notes: `Pedido importado da Shopee em ${new Date().toISOString()}`,
        };

        const { error: upsertError } = await supabase
          .from("orders")
          .upsert(orderData, {
            onConflict: "tenant_id,marketplace_order_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[shopee-sync-orders] Upsert error for ${shopeeOrder.order_sn}:`, upsertError);
          errors++;
        } else {
          synced++;
        }

      } catch (orderError) {
        console.error(`[shopee-sync-orders] Error processing order:`, orderError);
        errors++;
      }
    }

    // Atualizar last_sync_at
    await supabase
      .from("marketplace_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    // Log do sync
    await supabase
      .from("marketplace_sync_logs")
      .insert({
        connection_id: connection.id,
        tenant_id: tenantId,
        sync_type: "orders",
        status: errors === 0 ? "completed" : (synced > 0 ? "partial" : "failed"),
        processed_count: orderSnList.length,
        created_count: synced,
        failed_count: errors,
        details: { synced, errors, orderSnList },
      });

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        errors,
        total: orderSnList.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[shopee-sync-orders] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
