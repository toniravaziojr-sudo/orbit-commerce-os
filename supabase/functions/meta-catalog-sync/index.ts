import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v3.1.0"; // Fix: price/currency as separate fields for Graph API
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_API_VERSION = "v21.0";

/** Strip HTML tags from text */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  console.log(`[meta-catalog-sync][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { tenantId, catalogId, productIds } = body;

    if (!tenantId || !catalogId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId and catalogId are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Meta connection
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("access_token, expires_at, metadata")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta")
      .eq("is_active", true)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta não conectada", code: "NOT_CONNECTED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Token Meta expirado. Reconecte.", code: "TOKEN_EXPIRED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = connection.access_token;

    // Build product query
    let productQuery = supabase
      .from("products")
      .select("id, name, slug, sku, description, short_description, price, compare_at_price, brand, gtin, barcode, weight, stock_quantity")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null);

    if (productIds && productIds.length > 0) {
      productQuery = productQuery.in("id", productIds);
    }

    const { data: products, error: prodError } = await productQuery.limit(1000);

    if (prodError) {
      console.error(`[meta-catalog-sync] Error fetching products:`, prodError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar produtos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: { synced: 0, failed: 0, total: 0 } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[meta-catalog-sync] ${products.length} products to sync`);

    // Get ALL images for products (use sort_order, not position)
    const productIdList = products.map((p: any) => p.id);
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id, url, is_primary, sort_order")
      .in("product_id", productIdList)
      .order("sort_order", { ascending: true });

    // Build image map: product_id -> primary image URL
    // Also build additional images map for additional_image_link
    const imageMap: Record<string, string> = {};
    const additionalImagesMap: Record<string, string[]> = {};
    for (const img of images || []) {
      if (!img.url) continue;
      if (img.is_primary || !imageMap[img.product_id]) {
        imageMap[img.product_id] = img.url;
      }
      if (!additionalImagesMap[img.product_id]) {
        additionalImagesMap[img.product_id] = [];
      }
      additionalImagesMap[img.product_id].push(img.url);
    }

    // Get store URL from tenant_domains (primary verified domain)
    const { data: tenant } = await supabase
      .from("tenants")
      .select("slug")
      .eq("id", tenantId)
      .single();

    const { data: primaryDomain } = await supabase
      .from("tenant_domains")
      .select("domain")
      .eq("tenant_id", tenantId)
      .eq("is_primary", true)
      .eq("status", "verified")
      .maybeSingle();

    const storeBaseUrl = primaryDomain?.domain
      ? `https://${primaryDomain.domain}`
      : `https://${tenant?.slug || "loja"}.shops.comandocentral.com.br`;

    console.log(`[meta-catalog-sync] Store URL: ${storeBaseUrl}`);

    // Build batch requests
    const batchRequests: any[] = [];
    for (const product of products) {
      const imageUrl = imageMap[product.id] || "";
      const additionalImages = (additionalImagesMap[product.id] || []).filter(u => u !== imageUrl).slice(0, 9);
      const productUrl = `${storeBaseUrl}/produto/${product.slug || product.id}`;
      const priceCents = Math.round((product.price || 0) * 100);

      // Use short_description (plain text) first, fallback to stripped HTML description
      let description = product.short_description || "";
      if (!description && product.description) {
        description = stripHtml(product.description);
      }
      if (!description) {
        description = product.name || "Produto";
      }
      // Meta limit: 9999 chars
      description = description.substring(0, 9999);

      const bodyParams: Record<string, string> = {
        retailer_id: product.sku || product.id,
        name: product.name || "Produto",
        description,
        url: productUrl,
        availability: (product.stock_quantity !== null && product.stock_quantity <= 0) ? "out of stock" : "in stock",
        condition: "new",
        brand: product.brand || tenant?.slug || "loja",
        price: String(priceCents),
        currency: "BRL",
      };

      // Image URL (required by Meta)
      if (imageUrl) {
        bodyParams.image_url = imageUrl;
      }

      // Additional images
      if (additionalImages.length > 0) {
        bodyParams.additional_image_link = additionalImages.join(",");
      }

      // Sale price handling
      if (product.compare_at_price && product.compare_at_price > product.price) {
        bodyParams.price = String(Math.round(product.compare_at_price * 100));
        bodyParams.sale_price = String(priceCents);
        bodyParams.sale_price_currency = "BRL";
      }

      if (product.gtin || product.barcode) {
        bodyParams.gtin = product.gtin || product.barcode;
      }

      batchRequests.push({
        method: "POST",
        relative_url: `${catalogId}/products`,
        body: new URLSearchParams(bodyParams).toString(),
      });
    }

    // Send in batches of 50
    const BATCH_SIZE = 50;
    let totalSent = 0;
    let totalErrors = 0;
    const errorDetails: any[] = [];

    for (let i = 0; i < batchRequests.length; i += BATCH_SIZE) {
      const batch = batchRequests.slice(i, i + BATCH_SIZE);

      try {
        const batchResponse = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            access_token: accessToken,
            batch: JSON.stringify(batch),
          }).toString(),
        });

        if (batchResponse.ok) {
          const batchResults = await batchResponse.json();
          for (let j = 0; j < (batchResults || []).length; j++) {
            const result = batchResults[j];
            const product = products[i + j];
            if (result && result.code >= 200 && result.code < 300) {
              totalSent++;
              let metaProductId = null;
              try {
                const bodyData = JSON.parse(result.body);
                metaProductId = bodyData?.id;
              } catch {}
              
              await supabase
                .from("meta_catalog_items")
                .upsert({
                  tenant_id: tenantId,
                  product_id: product.id,
                  catalog_id: catalogId,
                  meta_product_id: metaProductId,
                  status: "synced",
                  last_error: null,
                  last_synced_at: new Date().toISOString(),
                }, { onConflict: "tenant_id,product_id,catalog_id" });
            } else {
              totalErrors++;
              let errorMsg = "Unknown error";
              try {
                const bodyData = JSON.parse(result.body);
                errorMsg = bodyData?.error?.message || `Code ${result.code}`;
              } catch {}
              
              errorDetails.push({ productId: product?.id, name: product?.name, error: errorMsg });
              console.warn(`[meta-catalog-sync] Product ${product?.name} failed: ${errorMsg}`);

              if (product) {
                await supabase
                  .from("meta_catalog_items")
                  .upsert({
                    tenant_id: tenantId,
                    product_id: product.id,
                    catalog_id: catalogId,
                    status: "error",
                    last_error: errorMsg,
                    last_synced_at: new Date().toISOString(),
                  }, { onConflict: "tenant_id,product_id,catalog_id" });
              }
            }
          }
        } else {
          const errText = await batchResponse.text();
          totalErrors += batch.length;
          console.error(`[meta-catalog-sync] Batch ${i} failed:`, errText.substring(0, 300));
        }
      } catch (batchErr) {
        totalErrors += batch.length;
        console.error(`[meta-catalog-sync] Batch ${i} exception:`, batchErr);
      }
    }

    console.log(`[meta-catalog-sync] Done: ${totalSent} synced, ${totalErrors} errors of ${products.length} total`);

    return new Response(
      JSON.stringify({
        success: true,
        data: { synced: totalSent, failed: totalErrors, total: products.length, errors: errorDetails.slice(0, 10) },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[meta-catalog-sync] Fatal error:`, err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
