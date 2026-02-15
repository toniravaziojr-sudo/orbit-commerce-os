import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Fase 6: TikTok Shop order detail
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Shop Order Detail
 *
 * Busca detalhes completos de um pedido na API TikTok Shop
 * e atualiza o registro local.
 *
 * Body: { tenantId, tiktokOrderId }
 */
serve(async (req) => {
  console.log(`[tiktok-shop-orders-detail][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
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
    const { tenantId, tiktokOrderId } = body;

    if (!tenantId || !tiktokOrderId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId e tiktokOrderId obrigatórios", code: "MISSING_PARAMS" }),
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

    // Buscar detalhes na API TikTok
    const detailUrl = `https://open-api.tiktokglobalshop.com/order/202309/orders?app_key=${appKey}&shop_id=${connection.shop_id}&ids=${tiktokOrderId}`;

    const detailResponse = await fetch(detailUrl, {
      method: "GET",
      headers: {
        "x-tts-access-token": connection.access_token,
        "Content-Type": "application/json",
      },
    });

    const detailText = await detailResponse.text();
    let detailData: any;
    try {
      detailData = JSON.parse(detailText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Resposta inválida da API TikTok", code: "API_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (detailData.code !== 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: detailData.message || "Erro na API TikTok",
          code: "TIKTOK_API_ERROR",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const order = detailData.data?.orders?.[0];
    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: "Pedido não encontrado no TikTok", code: "NOT_FOUND" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar registro local
    const { error: updateError } = await supabase
      .from("tiktok_shop_orders")
      .update({
        tiktok_status: order.status,
        order_data: order,
        synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("tenant_id", tenantId)
      .eq("tiktok_order_id", tiktokOrderId);

    if (updateError) {
      console.warn(`[tiktok-shop-orders-detail][${VERSION}] Update error:`, updateError);
    }

    return new Response(
      JSON.stringify({ success: true, data: order }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-shop-orders-detail][${VERSION}] Erro:`, error);
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
