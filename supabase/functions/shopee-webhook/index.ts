import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Shopee Webhook Handler
 * 
 * Recebe notificações push da Shopee sobre eventos (pedidos, produtos, etc).
 * 
 * Docs: https://open.shopee.com/documents/v2/Push%20Mechanism
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse webhook body
    const body = await req.json();
    
    const {
      code,        // Push type code (e.g., 3 = ORDER_STATUS_UPDATE)
      shop_id,     // Shop ID that the event belongs to
      timestamp,   // Event timestamp
      data,        // Event data (varies by push type)
    } = body;

    console.log(`[shopee-webhook] Received push code ${code} for shop ${shop_id}`);

    if (!shop_id) {
      console.log("[shopee-webhook] Missing shop_id");
      return new Response(
        JSON.stringify({ success: false, error: "Missing shop_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão ativa pelo shop_id
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("id, tenant_id")
      .eq("marketplace", "shopee")
      .eq("external_user_id", String(shop_id))
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      console.log(`[shopee-webhook] No active connection found for shop ${shop_id}`);
      // Retornar 200 para evitar retries desnecessários
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mapear push codes para tipos
    const pushTypeMap: Record<number, string> = {
      0: "shop_authorization",
      1: "shop_deauthorization",
      2: "item_promotion",
      3: "order_status_update",
      4: "order_trackingno",
      5: "shop_update",
      6: "add_item",
      7: "delete_item",
      8: "update_item",
      9: "promotion_update",
      10: "reserved_stock_change",
      11: "webchat_message",
      12: "buyer_cancel_order",
      13: "seller_cancel_order",
      14: "return_creation",
      15: "return_update",
    };

    const syncType = pushTypeMap[code] || `unknown_${code}`;

    // Registrar notificação no log
    const { error: logError } = await supabase
      .from("marketplace_sync_logs")
      .insert({
        connection_id: connection.id,
        tenant_id: connection.tenant_id,
        sync_type: `webhook_${syncType}`,
        status: "pending",
        processed_count: 0,
        details: {
          push_code: code,
          push_type: syncType,
          shop_id,
          timestamp,
          data,
          received_at: new Date().toISOString(),
        },
      });

    if (logError) {
      console.error("[shopee-webhook] Error saving log:", logError);
    }

    console.log(`[shopee-webhook] Logged ${syncType} event for tenant ${connection.tenant_id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Notification received" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[shopee-webhook] Error:", error);
    // Sempre retornar 200 para evitar retries desnecessários
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
