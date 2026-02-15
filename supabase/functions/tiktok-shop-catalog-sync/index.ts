import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 5: TikTok Shop catalog sync
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Shop Catalog Sync
 * 
 * Sincroniza produtos locais com o TikTok Shop via Seller API.
 * 
 * Actions:
 * - sync: Envia produtos para o TikTok Shop
 * - list: Lista status de sincronização do cache local
 */
serve(async (req) => {
  console.log(`[tiktok-shop-catalog-sync][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Autenticação
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
    const { tenantId, action = "list", productIds } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório", code: "MISSING_TENANT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso", code: "FORBIDDEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: LIST ===
    if (action === "list") {
      const { data: items, error: listError } = await supabase
        .from("tiktok_shop_products")
        .select("*, products:product_id(id, name, slug, price, images:product_images(url, is_primary))")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (listError) {
        console.error(`[tiktok-shop-catalog-sync][${VERSION}] List error:`, listError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao listar produtos", code: "LIST_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: items || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: SYNC ===
    if (action === "sync") {
      // Buscar conexão Shop
      const { data: connection, error: connError } = await supabase
        .from("tiktok_shop_connections")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .single();

      if (connError || !connection) {
        return new Response(
          JSON.stringify({ success: false, error: "TikTok Shop não conectado", code: "NOT_CONNECTED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = connection.access_token;
      const shopId = connection.shop_id;
      if (!accessToken || !shopId) {
        return new Response(
          JSON.stringify({ success: false, error: "Conexão incompleta (token ou shop_id ausente)", code: "INCOMPLETE_CONNECTION" }),
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

      // Buscar produtos locais para sincronizar
      let productsQuery = supabase
        .from("products")
        .select("id, name, slug, description, short_description, price, compare_at_price, sku, gtin, brand, weight, width, height, depth, status, images:product_images(url, is_primary, alt_text, position)")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      if (productIds && productIds.length > 0) {
        productsQuery = productsQuery.in("id", productIds);
      }

      const { data: products, error: prodError } = await productsQuery.limit(50);

      if (prodError) {
        console.error(`[tiktok-shop-catalog-sync][${VERSION}] Products fetch error:`, prodError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar produtos", code: "PRODUCTS_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!products || products.length === 0) {
        return new Response(
          JSON.stringify({ success: true, data: { synced: 0, errors: 0, message: "Nenhum produto ativo para sincronizar" } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar store settings para URL da loja
      const { data: storeSettings } = await supabase
        .from("store_settings")
        .select("store_name")
        .eq("tenant_id", tenantId)
        .single();

      const { data: tenant } = await supabase
        .from("tenants")
        .select("slug, custom_domain")
        .eq("id", tenantId)
        .single();

      const storeUrl = tenant?.custom_domain
        ? `https://${tenant.custom_domain}`
        : `https://${tenant?.slug}.shops.comandocentral.com.br`;

      let syncedCount = 0;
      let errorCount = 0;
      const results: Array<{ productId: string; success: boolean; error?: string; tiktokProductId?: string }> = [];

      for (const product of products) {
        try {
          // Montar payload TikTok Shop Product
          const images = (product.images as any[]) || [];
          const primaryImage = images.find((img: any) => img.is_primary) || images[0];
          const additionalImages = images.filter((img: any) => !img.is_primary).slice(0, 8);

          const mainImages = primaryImage
            ? [{ uri: primaryImage.url }]
            : [];

          // Preço em centavos → string com decimais
          const priceStr = product.price ? (product.price / 100).toFixed(2) : "0.00";
          const comparePriceStr = product.compare_at_price ? (product.compare_at_price / 100).toFixed(2) : undefined;

          // Verificar se já existe na tabela de sync
          const { data: existing } = await supabase
            .from("tiktok_shop_products")
            .select("id, tiktok_product_id")
            .eq("tenant_id", tenantId)
            .eq("product_id", product.id)
            .maybeSingle();

          const isUpdate = existing?.tiktok_product_id;

          // Criar produto no TikTok Shop
          const tiktokPayload: Record<string, unknown> = {
            title: product.name,
            description: product.description || product.short_description || product.name,
            main_images: mainImages,
            skus: [
              {
                seller_sku: product.sku || product.id,
                original_price: priceStr,
                ...(comparePriceStr && { sale_price: comparePriceStr }),
                inventory: [{ warehouse_id: "default", quantity: 999 }],
              },
            ],
            package_weight: {
              value: product.weight ? String(product.weight) : "0.5",
              unit: "KILOGRAM",
            },
          };

          if (product.brand) {
            tiktokPayload.brand = { name: product.brand };
          }

          let apiUrl: string;
          let method: string;

          if (isUpdate && existing.tiktok_product_id) {
            // Update existing
            apiUrl = `https://open-api.tiktokglobalshop.com/product/202309/products/${existing.tiktok_product_id}?app_key=${appKey}&shop_id=${shopId}`;
            method = "PUT";
          } else {
            // Create new
            apiUrl = `https://open-api.tiktokglobalshop.com/product/202309/products?app_key=${appKey}&shop_id=${shopId}`;
            method = "POST";
          }

          const tiktokResponse = await fetch(apiUrl, {
            method,
            headers: {
              "x-tts-access-token": accessToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(tiktokPayload),
          });

          const responseText = await tiktokResponse.text();
          let responseData: any;
          try {
            responseData = JSON.parse(responseText);
          } catch {
            console.error(`[tiktok-shop-catalog-sync][${VERSION}] Response not JSON for ${product.id}:`, responseText);
            throw new Error("Resposta inesperada do TikTok Shop");
          }

          if (responseData.code !== 0) {
            throw new Error(responseData.message || `TikTok API error code: ${responseData.code}`);
          }

          const tiktokProductId = responseData.data?.product_id || existing?.tiktok_product_id || null;

          // Upsert no tracking local
          const { error: upsertError } = await supabase
            .from("tiktok_shop_products")
            .upsert({
              tenant_id: tenantId,
              product_id: product.id,
              tiktok_product_id: tiktokProductId,
              status: "synced",
              sync_action: isUpdate ? "update" : "create",
              last_synced_at: new Date().toISOString(),
              last_error: null,
              tiktok_status: responseData.data?.status || "pending",
              metadata: {
                last_response: {
                  code: responseData.code,
                  product_id: tiktokProductId,
                },
              },
            }, { onConflict: "tenant_id,product_id" });

          if (upsertError) {
            console.error(`[tiktok-shop-catalog-sync][${VERSION}] Upsert error for ${product.id}:`, upsertError);
          }

          syncedCount++;
          results.push({ productId: product.id, success: true, tiktokProductId });
        } catch (err) {
          errorCount++;
          const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
          console.error(`[tiktok-shop-catalog-sync][${VERSION}] Sync error for ${product.id}:`, errorMsg);

          // Registrar erro
          await supabase
            .from("tiktok_shop_products")
            .upsert({
              tenant_id: tenantId,
              product_id: product.id,
              status: "error",
              sync_action: "create",
              last_error: errorMsg,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: "tenant_id,product_id" });

          results.push({ productId: product.id, success: false, error: errorMsg });
        }
      }

      console.log(`[tiktok-shop-catalog-sync][${VERSION}] Sync done: ${syncedCount} synced, ${errorCount} errors`);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            synced: syncedCount,
            errors: errorCount,
            total: products.length,
            results,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação '${action}' não reconhecida`, code: "INVALID_ACTION" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-shop-catalog-sync][${VERSION}] Erro:`, error);
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
