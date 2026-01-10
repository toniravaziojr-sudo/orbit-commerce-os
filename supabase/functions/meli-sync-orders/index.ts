import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre Sync Orders
 * 
 * Sincroniza pedidos do ML para a tabela orders.
 * Pode ser chamada manualmente ou por webhook.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obter body
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
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão ML não encontrada ou inativa" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se token está válido
    const tokenExpired = connection.expires_at && new Date(connection.expires_at) < new Date();
    if (tokenExpired) {
      return new Response(
        JSON.stringify({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = connection.access_token;
    const sellerId = connection.external_user_id;

    // Determinar quais pedidos buscar
    let orderIds: string[] = [];

    if (orderId) {
      // Sincronizar pedido específico
      orderIds = [orderId];
    } else if (fullSync) {
      // Full sync: buscar últimos 50 pedidos
      const searchUrl = `https://api.mercadolibre.com/orders/search?seller=${sellerId}&sort=date_desc&limit=50`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!searchRes.ok) {
        const errorText = await searchRes.text();
        console.error("[meli-sync-orders] Search error:", errorText);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar pedidos do ML", details: errorText }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const searchData = await searchRes.json();
      orderIds = searchData.results?.map((o: any) => o.id.toString()) || [];
    } else {
      // Sync recente: últimos 10 pedidos
      const searchUrl = `https://api.mercadolibre.com/orders/search?seller=${sellerId}&sort=date_desc&limit=10`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!searchRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar pedidos do ML" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const searchData = await searchRes.json();
      orderIds = searchData.results?.map((o: any) => o.id.toString()) || [];
    }

    console.log(`[meli-sync-orders] Syncing ${orderIds.length} orders for tenant ${tenantId}`);

    let synced = 0;
    let errors = 0;

    // Processar cada pedido
    for (const meliOrderId of orderIds) {
      try {
        // Buscar detalhes do pedido
        const orderUrl = `https://api.mercadolibre.com/orders/${meliOrderId}`;
        const orderRes = await fetch(orderUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!orderRes.ok) {
          console.error(`[meli-sync-orders] Failed to fetch order ${meliOrderId}`);
          errors++;
          continue;
        }

        const meliOrder = await orderRes.json();

        // Mapear status do ML para nosso sistema
        const statusMap: Record<string, string> = {
          confirmed: "processing",
          paid: "processing",
          payment_required: "pending",
          payment_in_process: "pending",
          partially_paid: "pending",
          shipped: "shipped",
          delivered: "delivered",
          cancelled: "cancelled",
        };

        // Mapear status de pagamento
        const paymentStatusMap: Record<string, string> = {
          approved: "paid",
          pending: "pending",
          authorized: "pending",
          in_process: "pending",
          rejected: "failed",
          refunded: "refunded",
        };

        const orderStatus = statusMap[meliOrder.status] || "pending";
        const paymentStatus = meliOrder.payments?.[0]?.status 
          ? paymentStatusMap[meliOrder.payments[0].status] || "pending"
          : "pending";

        // Preparar dados do cliente
        const buyer = meliOrder.buyer || {};
        
        // Buscar ou criar cliente
        let customerId: string | null = null;
        if (buyer.email) {
          const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("email", buyer.email.toLowerCase().trim())
            .single();

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            // Criar cliente
            const { data: newCustomer } = await supabase
              .from("customers")
              .insert({
                tenant_id: tenantId,
                email: buyer.email.toLowerCase().trim(),
                name: `${buyer.first_name || ""} ${buyer.last_name || ""}`.trim() || buyer.nickname,
                phone: buyer.phone?.number || null,
                source: "mercadolivre",
              })
              .select("id")
              .single();

            customerId = newCustomer?.id || null;
          }
        }

        // Preparar dados do pedido
        const shipping = meliOrder.shipping || {};
        const shippingAddress = shipping.receiver_address || {};

        const orderData = {
          tenant_id: tenantId,
          customer_id: customerId,
          status: orderStatus,
          payment_status: paymentStatus,
          subtotal: meliOrder.total_amount || 0,
          shipping_total: shipping.cost || 0,
          total: (meliOrder.total_amount || 0) + (shipping.cost || 0),
          currency: meliOrder.currency_id || "BRL",
          
          // Dados do marketplace
          marketplace_source: "mercadolivre",
          marketplace_order_id: meliOrderId,
          source_platform: "mercadolivre",
          source_order_number: meliOrder.pack_id ? `PACK-${meliOrder.pack_id}` : meliOrderId,
          marketplace_data: {
            meli_order_id: meliOrder.id,
            meli_pack_id: meliOrder.pack_id,
            meli_status: meliOrder.status,
            meli_status_detail: meliOrder.status_detail,
            meli_shipping_id: shipping.id,
            meli_shipping_status: shipping.status,
            meli_buyer_id: buyer.id,
            meli_buyer_nickname: buyer.nickname,
            meli_date_created: meliOrder.date_created,
          },
          
          // Dados de envio
          shipping_street: shippingAddress.street_name || null,
          shipping_number: shippingAddress.street_number || null,
          shipping_neighborhood: shippingAddress.neighborhood?.name || null,
          shipping_city: shippingAddress.city?.name || null,
          shipping_state: shippingAddress.state?.id || null,
          shipping_postal_code: shippingAddress.zip_code || null,
          shipping_country: shippingAddress.country?.id || "BR",
          
          // Metadata
          notes: `Pedido importado do Mercado Livre em ${new Date().toISOString()}`,
        };

        // Upsert pedido (não duplicar)
        const { error: upsertError } = await supabase
          .from("orders")
          .upsert(orderData, {
            onConflict: "tenant_id,marketplace_order_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[meli-sync-orders] Upsert error for ${meliOrderId}:`, upsertError);
          errors++;
        } else {
          synced++;
        }

      } catch (orderError) {
        console.error(`[meli-sync-orders] Error processing order ${meliOrderId}:`, orderError);
        errors++;
      }
    }

    // Atualizar last_sync_at na conexão
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
        processed_count: orderIds.length,
        created_count: synced,
        failed_count: errors,
        details: { synced, errors, orderIds },
      });

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        errors,
        total: orderIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meli-sync-orders] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
