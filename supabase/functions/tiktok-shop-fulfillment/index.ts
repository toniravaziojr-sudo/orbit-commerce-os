import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Fase 7: TikTok Shop fulfillment
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Shop Fulfillment
 *
 * Actions:
 * - submit: Envia informações de rastreio para o TikTok Shop
 * - list: Lista fulfillments do banco local
 * - shipping_providers: Lista transportadoras disponíveis no TikTok Shop
 *
 * Body: { tenantId, action, data? }
 */
serve(async (req) => {
  console.log(`[tiktok-shop-fulfillment][${VERSION}] Request received`);

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
    const { tenantId, action, data } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId obrigatório", code: "MISSING_PARAMS" }),
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

    // === ACTION: list ===
    if (action === "list") {
      let query = supabase
        .from("tiktok_shop_fulfillments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (data?.tiktokOrderId) {
        query = query.eq("tiktok_order_id", data.tiktokOrderId);
      }
      if (data?.status) {
        query = query.eq("status", data.status);
      }

      const { data: fulfillments, error: listError } = await query.limit(100);

      if (listError) {
        console.error(`[tiktok-shop-fulfillment][${VERSION}] List error:`, listError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao listar fulfillments", code: "DB_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: fulfillments || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: shipping_providers ===
    if (action === "shipping_providers") {
      const connection = await getShopConnection(supabase, tenantId);
      if (!connection) {
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

      const url = `https://open-api.tiktokglobalshop.com/fulfillment/202309/shipping_providers?app_key=${appKey}&shop_id=${connection.shop_id}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-tts-access-token": connection.access_token,
          "Content-Type": "application/json",
        },
      });

      const responseText = await response.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Resposta inválida da API TikTok", code: "API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (responseData.code !== 0) {
        return new Response(
          JSON.stringify({ success: false, error: responseData.message || "Erro na API TikTok", code: "TIKTOK_API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: responseData.data?.shipping_providers || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: submit ===
    if (action === "submit") {
      if (!data?.tiktokOrderId || !data?.trackingCode) {
        return new Response(
          JSON.stringify({ success: false, error: "tiktokOrderId e trackingCode obrigatórios", code: "MISSING_PARAMS" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const connection = await getShopConnection(supabase, tenantId);
      if (!connection) {
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

      // Montar payload de ship order
      const shipPayload: any = {
        order_id: data.tiktokOrderId,
        tracking_number: data.trackingCode,
        shipping_provider_id: data.shippingProviderId || "",
      };

      if (data.pickupSlot) {
        shipPayload.pick_up = data.pickupSlot;
      }

      const shipUrl = `https://open-api.tiktokglobalshop.com/fulfillment/202309/orders/${data.tiktokOrderId}/ship?app_key=${appKey}&shop_id=${connection.shop_id}`;

      console.log(`[tiktok-shop-fulfillment][${VERSION}] Submitting fulfillment for order ${data.tiktokOrderId}`);

      const shipResponse = await fetch(shipUrl, {
        method: "POST",
        headers: {
          "x-tts-access-token": connection.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shipPayload),
      });

      const shipText = await shipResponse.text();
      let shipData: any;
      try {
        shipData = JSON.parse(shipText);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Resposta inválida da API TikTok", code: "API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isSuccess = shipData.code === 0;

      // Upsert no banco local
      const { error: upsertError } = await supabase
        .from("tiktok_shop_fulfillments")
        .upsert({
          tenant_id: tenantId,
          tiktok_order_id: data.tiktokOrderId,
          tiktok_shop_order_id: data.tiktokShopOrderId || null,
          shipment_id: data.shipmentId || null,
          tracking_code: data.trackingCode,
          carrier_code: data.carrierCode || null,
          carrier_name: data.carrierName || null,
          status: isSuccess ? "submitted" : "error",
          tiktok_package_id: shipData.data?.package_id || null,
          tiktok_fulfillment_status: isSuccess ? "shipped" : "error",
          shipping_provider_id: data.shippingProviderId || null,
          pickup_slot: data.pickupSlot || null,
          fulfillment_data: shipData.data || {},
          submitted_at: isSuccess ? new Date().toISOString() : null,
          last_error: isSuccess ? null : (shipData.message || "Erro ao enviar fulfillment"),
        }, {
          onConflict: "tenant_id,tiktok_order_id,tracking_code",
        });

      if (upsertError) {
        console.error(`[tiktok-shop-fulfillment][${VERSION}] Upsert error:`, upsertError);
      }

      if (!isSuccess) {
        return new Response(
          JSON.stringify({
            success: false,
            error: shipData.message || "Erro ao enviar fulfillment",
            code: "TIKTOK_API_ERROR",
            details: shipData,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Atualizar status do pedido TikTok local
      await supabase
        .from("tiktok_shop_orders")
        .update({ status: "shipped", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("tiktok_order_id", data.tiktokOrderId);

      return new Response(
        JSON.stringify({ success: true, data: { packageId: shipData.data?.package_id, trackingCode: data.trackingCode } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação '${action}' não reconhecida`, code: "INVALID_ACTION" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-shop-fulfillment][${VERSION}] Erro:`, error);
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

async function getShopConnection(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("tiktok_shop_connections")
    .select("access_token, shop_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  return data?.access_token && data?.shop_id ? data : null;
}
