import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Google Merchant Center sync
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MERCHANT_API_BASE = "https://shoppingcontent.googleapis.com/content/v2.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[google-merchant-sync][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tenantId, merchantAccountId, productIds, action = "sync" } = body;

    if (!tenantId) {
      return jsonResponse({ success: false, error: "tenantId obrigatório" });
    }
    if (!merchantAccountId) {
      return jsonResponse({ success: false, error: "merchantAccountId obrigatório" });
    }

    // Get valid access token
    const accessToken = await getValidToken(supabase, supabaseUrl, supabaseServiceKey, tenantId);
    if (!accessToken) {
      return jsonResponse({ success: false, error: "Conexão Google não encontrada ou token inválido", code: "NO_CONNECTION" });
    }

    // Verify merchant pack is enabled
    const { data: conn } = await supabase
      .from("google_connections")
      .select("scope_packs")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!conn?.scope_packs?.includes("merchant")) {
      return jsonResponse({ success: false, error: "Pack Merchant Center não habilitado", code: "PACK_NOT_ENABLED" });
    }

    if (action === "sync") {
      return await syncProducts(supabase, tenantId, merchantAccountId, accessToken, productIds);
    } else if (action === "delete") {
      return await deleteProducts(supabase, tenantId, merchantAccountId, accessToken, productIds);
    } else {
      return jsonResponse({ success: false, error: `Ação desconhecida: ${action}` });
    }
  } catch (error) {
    console.error(`[google-merchant-sync][${VERSION}] Error:`, error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Erro interno" });
  }
});

async function syncProducts(
  supabase: any,
  tenantId: string,
  merchantAccountId: string,
  accessToken: string,
  productIds?: string[],
) {
  // Fetch products from DB
  let query = supabase
    .from("products")
    .select(`
      id, name, slug, sku, description, short_description,
      price, compare_at_price, stock_quantity, manage_stock,
      weight, brand, vendor, product_type, tags,
      barcode, gtin, ncm, status,
      seo_title, seo_description,
      requires_shipping, taxable
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (productIds?.length) {
    query = query.in("id", productIds);
  }

  const { data: products, error: prodError } = await query;
  if (prodError) {
    return jsonResponse({ success: false, error: "Erro ao buscar produtos: " + prodError.message });
  }
  if (!products?.length) {
    return jsonResponse({ success: true, synced: 0, message: "Nenhum produto ativo encontrado" });
  }

  // Fetch product images
  const prodIds = products.map((p: any) => p.id);
  const { data: images } = await supabase
    .from("product_images")
    .select("product_id, url, is_primary, alt_text, sort_order")
    .in("product_id", prodIds)
    .order("sort_order");

  const imagesByProduct = new Map<string, any[]>();
  for (const img of (images || [])) {
    if (!imagesByProduct.has(img.product_id)) imagesByProduct.set(img.product_id, []);
    imagesByProduct.get(img.product_id)!.push(img);
  }

  // Get store settings for store URL
  const { data: settings } = await supabase
    .from("store_settings")
    .select("store_url")
    .eq("tenant_id", tenantId)
    .single();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug, custom_domain")
    .eq("id", tenantId)
    .single();

  const storeUrl = settings?.store_url ||
    (tenant?.custom_domain ? `https://${tenant.custom_domain}` : `https://${tenant?.slug}.shops.comandocentral.com.br`);

  // Build and send products
  const results = { synced: 0, errors: 0, details: [] as any[] };

  for (const product of products) {
    try {
      const merchantProduct = buildMerchantProduct(product, imagesByProduct.get(product.id) || [], storeUrl, merchantAccountId);
      const dataHash = simpleHash(JSON.stringify(merchantProduct));

      // Check if already synced with same data
      const { data: existingSync } = await supabase
        .from("google_merchant_products")
        .select("id, synced_data_hash, merchant_product_id")
        .eq("tenant_id", tenantId)
        .eq("product_id", product.id)
        .eq("merchant_account_id", merchantAccountId)
        .maybeSingle();

      if (existingSync?.synced_data_hash === dataHash) {
        results.details.push({ productId: product.id, status: "skipped", reason: "unchanged" });
        continue;
      }

      // Insert/update product in Merchant Center
      const offerId = `cc_${product.id}`;
      const apiUrl = `${MERCHANT_API_BASE}/${merchantAccountId}/products`;
      const merchantPayload = { ...merchantProduct, offerId };

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(merchantPayload),
      });

      const resText = await res.text();
      let resData: any;
      try { resData = JSON.parse(resText); } catch { resData = { error: resText }; }

      if (res.ok) {
        // Upsert sync record
        await supabase
          .from("google_merchant_products")
          .upsert({
            tenant_id: tenantId,
            product_id: product.id,
            merchant_account_id: merchantAccountId,
            merchant_product_id: resData.id || offerId,
            sync_status: "synced",
            last_sync_at: new Date().toISOString(),
            last_error: null,
            synced_data_hash: dataHash,
            disapproval_reasons: null,
          }, { onConflict: "tenant_id,product_id,merchant_account_id" });

        results.synced++;
        results.details.push({ productId: product.id, status: "synced" });
      } else {
        const errorMsg = resData?.error?.message || resData?.error || "Erro desconhecido";
        console.error(`[google-merchant-sync][${VERSION}] Product ${product.id} error:`, errorMsg);

        await supabase
          .from("google_merchant_products")
          .upsert({
            tenant_id: tenantId,
            product_id: product.id,
            merchant_account_id: merchantAccountId,
            sync_status: "error",
            last_sync_at: new Date().toISOString(),
            last_error: errorMsg,
            disapproval_reasons: resData?.error?.errors || null,
          }, { onConflict: "tenant_id,product_id,merchant_account_id" });

        results.errors++;
        results.details.push({ productId: product.id, status: "error", error: errorMsg });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      results.errors++;
      results.details.push({ productId: product.id, status: "error", error: msg });
    }
  }

  console.log(`[google-merchant-sync][${VERSION}] Sync complete: ${results.synced} synced, ${results.errors} errors`);
  return jsonResponse({ success: true, ...results });
}

async function deleteProducts(
  supabase: any,
  tenantId: string,
  merchantAccountId: string,
  accessToken: string,
  productIds: string[],
) {
  if (!productIds?.length) {
    return jsonResponse({ success: false, error: "productIds obrigatório para delete" });
  }

  const results = { deleted: 0, errors: 0 };

  for (const productId of productIds) {
    try {
      const { data: syncRecord } = await supabase
        .from("google_merchant_products")
        .select("merchant_product_id")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .eq("merchant_account_id", merchantAccountId)
        .maybeSingle();

      if (!syncRecord?.merchant_product_id) continue;

      const res = await fetch(
        `${MERCHANT_API_BASE}/${merchantAccountId}/products/${encodeURIComponent(syncRecord.merchant_product_id)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (res.ok || res.status === 404) {
        await supabase
          .from("google_merchant_products")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("product_id", productId)
          .eq("merchant_account_id", merchantAccountId);
        results.deleted++;
      } else {
        results.errors++;
      }
    } catch {
      results.errors++;
    }
  }

  return jsonResponse({ success: true, ...results });
}

function buildMerchantProduct(product: any, images: any[], storeUrl: string, merchantId: string) {
  const primaryImage = images.find(i => i.is_primary) || images[0];
  const additionalImages = images.filter(i => i !== primaryImage).slice(0, 9);

  const merchantProduct: Record<string, any> = {
    channel: "online",
    contentLanguage: "pt",
    targetCountry: "BR",
    title: product.name,
    description: product.short_description || product.description || product.name,
    link: `${storeUrl}/produto/${product.slug}`,
    condition: "new",
    availability: product.manage_stock
      ? (product.stock_quantity > 0 ? "in_stock" : "out_of_stock")
      : "in_stock",
    price: {
      value: (product.price || 0).toFixed(2),
      currency: "BRL",
    },
  };

  if (product.compare_at_price && product.compare_at_price > product.price) {
    merchantProduct.salePrice = { value: product.price.toFixed(2), currency: "BRL" };
    merchantProduct.price = { value: product.compare_at_price.toFixed(2), currency: "BRL" };
  }

  if (primaryImage?.url) {
    merchantProduct.imageLink = primaryImage.url;
  }
  if (additionalImages.length > 0) {
    merchantProduct.additionalImageLinks = additionalImages.map((i: any) => i.url);
  }

  if (product.brand) merchantProduct.brand = product.brand;
  if (product.gtin) merchantProduct.gtin = product.gtin;
  if (product.barcode && !product.gtin) merchantProduct.mpn = product.barcode;
  if (product.sku) merchantProduct.mpn = merchantProduct.mpn || product.sku;
  if (product.product_type) merchantProduct.productType = product.product_type;
  if (product.weight) {
    merchantProduct.shippingWeight = { value: (product.weight / 1000).toFixed(3), unit: "kg" };
  }

  // identifierExists required if no brand+gtin
  if (!product.brand || !product.gtin) {
    merchantProduct.identifierExists = false;
  }

  return merchantProduct;
}

async function getValidToken(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  tenantId: string,
): Promise<string | null> {
  const { data: conn } = await supabase
    .from("google_connections")
    .select("access_token, token_expires_at, refresh_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (!conn) return null;

  // Check if token is still valid (5 min buffer)
  if (conn.token_expires_at) {
    const expiresAt = new Date(conn.token_expires_at);
    if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
      return conn.access_token;
    }
  }

  // Refresh token
  if (!conn.refresh_token) return null;

  const [clientId, clientSecret] = await Promise.all([
    getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_ID"),
    getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_SECRET"),
  ]);

  if (!clientId || !clientSecret) return null;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const tokenText = await tokenRes.text();
  let tokenData: any;
  try { tokenData = JSON.parse(tokenText); } catch { return null; }

  if (!tokenRes.ok || !tokenData.access_token) return null;

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  await supabase
    .from("google_connections")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: newExpiresAt,
      connection_status: "connected",
      last_error: null,
    })
    .eq("tenant_id", tenantId);

  return tokenData.access_token;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
