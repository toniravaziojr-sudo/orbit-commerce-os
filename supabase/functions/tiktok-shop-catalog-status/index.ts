import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 5: TikTok Shop catalog status check
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Shop Catalog Status
 * 
 * Verifica o status de aprovação dos produtos no TikTok Shop.
 * Atualiza tiktok_shop_products com o status mais recente.
 * 
 * Body: { tenantId, productIds? }
 */
serve(async (req) => {
  console.log(`[tiktok-shop-catalog-status][${VERSION}] Request received`);

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
    const { tenantId, productIds } = body;

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

    // Buscar produtos sincronizados que têm tiktok_product_id
    let query = supabase
      .from("tiktok_shop_products")
      .select("id, product_id, tiktok_product_id, status, tiktok_status")
      .eq("tenant_id", tenantId)
      .not("tiktok_product_id", "is", null);

    if (productIds && productIds.length > 0) {
      query = query.in("product_id", productIds);
    }

    const { data: syncedProducts, error: fetchError } = await query.limit(50);

    if (fetchError) {
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar produtos sincronizados", code: "FETCH_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!syncedProducts || syncedProducts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: { checked: 0, updated: 0, products: [] } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updatedCount = 0;
    const statusResults: Array<{ productId: string; tiktokProductId: string; status: string; previousStatus: string }> = [];

    for (const item of syncedProducts) {
      try {
        const statusUrl = `https://open-api.tiktokglobalshop.com/product/202309/products/${item.tiktok_product_id}?app_key=${appKey}&shop_id=${connection.shop_id}`;

        const statusResponse = await fetch(statusUrl, {
          method: "GET",
          headers: {
            "x-tts-access-token": connection.access_token,
            "Content-Type": "application/json",
          },
        });

        const statusText = await statusResponse.text();
        let statusData: any;
        try {
          statusData = JSON.parse(statusText);
        } catch {
          console.warn(`[tiktok-shop-catalog-status][${VERSION}] Non-JSON response for ${item.tiktok_product_id}`);
          continue;
        }

        if (statusData.code === 0 && statusData.data) {
          const newStatus = statusData.data.status || "unknown";
          const previousStatus = item.tiktok_status || "unknown";

          if (newStatus !== previousStatus) {
            await supabase
              .from("tiktok_shop_products")
              .update({
                tiktok_status: newStatus,
                status: newStatus === "ACTIVATE" ? "synced" : newStatus === "SELLER_DEACTIVATED" ? "paused" : "pending",
                last_synced_at: new Date().toISOString(),
                metadata: {
                  last_status_check: {
                    checked_at: new Date().toISOString(),
                    raw_status: newStatus,
                  },
                },
              })
              .eq("id", item.id);

            updatedCount++;
          }

          statusResults.push({
            productId: item.product_id,
            tiktokProductId: item.tiktok_product_id!,
            status: newStatus,
            previousStatus,
          });
        }
      } catch (err) {
        console.warn(`[tiktok-shop-catalog-status][${VERSION}] Error checking ${item.tiktok_product_id}:`, err);
      }
    }

    console.log(`[tiktok-shop-catalog-status][${VERSION}] Checked ${syncedProducts.length}, updated ${updatedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          checked: syncedProducts.length,
          updated: updatedCount,
          products: statusResults,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-shop-catalog-status][${VERSION}] Erro:`, error);
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
