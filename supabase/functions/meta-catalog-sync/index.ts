import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v4.0.0"; // Fix: use /{catalog_id}/batch endpoint with all images, correct field names
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

    // Build product query — fetch ALL relevant fields
    let productQuery = supabase
      .from("products")
      .select("id, name, slug, sku, description, short_description, price, compare_at_price, brand, gtin, barcode, weight, stock_quantity, tags, product_format")
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

    // Get ALL images for products ordered by sort_order
    const productIdList = products.map((p: any) => p.id);
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id, url, is_primary, sort_order")
      .in("product_id", productIdList)
      .order("sort_order", { ascending: true });

    // Build image maps: primary + additional (respecting exact sort_order)
    const primaryImageMap: Record<string, string> = {};
    const allImagesMap: Record<string, string[]> = {};
    
    for (const img of images || []) {
      if (!img.url) continue;
      
      // Collect all images per product in order
      if (!allImagesMap[img.product_id]) {
        allImagesMap[img.product_id] = [];
      }
      allImagesMap[img.product_id].push(img.url);
      
      // Primary image: explicit is_primary flag or first by sort_order
      if (img.is_primary || !primaryImageMap[img.product_id]) {
        primaryImageMap[img.product_id] = img.url;
      }
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

    // Build batch requests using the /{catalog_id}/batch endpoint format
    const batchItems: any[] = [];
    
    for (const product of products) {
      const productUrl = `${storeBaseUrl}/produto/${product.slug || product.id}`;
      const priceCents = Math.round((product.price || 0) * 100);
      const primaryImage = primaryImageMap[product.id] || "";
      const allImages = allImagesMap[product.id] || [];
      
      // Additional images: all except the primary, up to 50 (Meta limit)
      const additionalImages = allImages.filter(u => u !== primaryImage).slice(0, 50);

      // Use short_description (plain text) first, fallback to stripped HTML
      let description = product.short_description || "";
      if (!description && product.description) {
        description = stripHtml(product.description);
      }
      if (!description) {
        description = product.name || "Produto";
      }
      description = description.substring(0, 9999);

      // Build product data object for /{catalog_id}/batch
      const productData: Record<string, any> = {
        name: product.name || "Produto",
        description,
        url: productUrl,
        availability: (product.stock_quantity !== null && product.stock_quantity <= 0) ? "out of stock" : "in stock",
        condition: "new",
        brand: product.brand || tenant?.slug || "Loja",
        price: priceCents,
        currency: "BRL",
      };

      // Main image (required)
      if (primaryImage) {
        productData.image_url = primaryImage;
      }

      // Additional images as JSON array (up to 50)
      if (additionalImages.length > 0) {
        productData.additional_image_urls = additionalImages;
      }

      // Sale price: compare_at_price is the "original" (higher), price is the "sale"
      if (product.compare_at_price && product.compare_at_price > product.price) {
        const originalCents = Math.round(product.compare_at_price * 100);
        productData.price = `${originalCents} BRL`;
        productData.sale_price = `${priceCents} BRL`;
      }

      // GTIN/Barcode
      if (product.gtin || product.barcode) {
        productData.gtin = product.gtin || product.barcode;
      }

      // Rich text description (full HTML) if description is long
      if (product.description && stripHtml(product.description).length > 200) {
        // Meta supports rich_text_description for commerce catalogs
        productData.rich_text_description = product.description.substring(0, 9999);
      }

      batchItems.push({
        retailer_id: product.sku || product.id,
        method: "CREATE",
        data: productData,
      });
    }

    // Send to /{catalog_id}/batch in chunks of 4999 (Meta limit is 5000)
    const BATCH_SIZE = 4999;
    let totalSent = 0;
    let totalErrors = 0;
    const errorDetails: any[] = [];

    for (let i = 0; i < batchItems.length; i += BATCH_SIZE) {
      const batch = batchItems.slice(i, i + BATCH_SIZE);

      try {
        const batchUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${catalogId}/batch`;
        
        const formData = new URLSearchParams({
          access_token: accessToken,
          allow_upsert: "true",
          requests: JSON.stringify(batch),
        });

        console.log(`[meta-catalog-sync] Sending batch ${i}-${i + batch.length} to ${batchUrl}`);

        const batchResponse = await fetch(batchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        const responseBody = await batchResponse.json();

        if (batchResponse.ok && responseBody) {
          // The /batch endpoint returns validation_status array
          const handles = responseBody.handles || [];
          const validationStatus = responseBody.validation_status || [];
          
          console.log(`[meta-catalog-sync] Batch response: handles=${handles.length}, validation_status=${validationStatus.length}`);

          // Count errors from validation_status
          let batchErrors = 0;
          for (const vs of validationStatus) {
            if (vs.errors && vs.errors.length > 0) {
              batchErrors++;
              const product = products[i + validationStatus.indexOf(vs)];
              errorDetails.push({
                productId: product?.id,
                name: product?.name,
                retailer_id: vs.retailer_id,
                errors: vs.errors,
              });
              console.warn(`[meta-catalog-sync] Validation error for ${vs.retailer_id}:`, JSON.stringify(vs.errors));
            }
          }

          totalSent += batch.length - batchErrors;
          totalErrors += batchErrors;

          // Update meta_catalog_items for successfully synced products
          for (let j = 0; j < batch.length; j++) {
            const product = products[i + j];
            const hasError = validationStatus.some(
              (vs: any) => vs.retailer_id === batch[j].retailer_id && vs.errors?.length > 0
            );

            await supabase
              .from("meta_catalog_items")
              .upsert({
                tenant_id: tenantId,
                product_id: product.id,
                catalog_id: catalogId,
                status: hasError ? "error" : "synced",
                last_error: hasError
                  ? JSON.stringify(validationStatus.find((vs: any) => vs.retailer_id === batch[j].retailer_id)?.errors)
                  : null,
                last_synced_at: new Date().toISOString(),
              }, { onConflict: "tenant_id,product_id,catalog_id" });
          }
        } else {
          const errMsg = responseBody?.error?.message || JSON.stringify(responseBody).substring(0, 300);
          totalErrors += batch.length;
          console.error(`[meta-catalog-sync] Batch failed:`, errMsg);
          errorDetails.push({ batch: `${i}-${i + batch.length}`, error: errMsg });
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
