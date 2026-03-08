import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v5.0.0"; // Migrated from deprecated /batch to /items_batch endpoint. Field changes: image_url→image_link, url→link, name→title, price as "VALUE CURRENCY" string.
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

/** Format price for /items_batch: "VALUE CURRENCY" e.g. "336.57 BRL" */
function formatPrice(valueCents: number, currency = "BRL"): string {
  const value = (valueCents / 100).toFixed(2);
  return `${value} ${currency}`;
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
    const { tenantId, catalogId, productIds, action } = body;

    // === DELETE action: remove products from Meta catalog ===
    if (action === "delete") {
      if (!tenantId || !catalogId || !productIds?.length) {
        return new Response(
          JSON.stringify({ success: false, error: "tenantId, catalogId and productIds required for delete" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: connection } = await supabase
        .from("marketplace_connections")
        .select("access_token")
        .eq("tenant_id", tenantId)
        .eq("marketplace", "meta")
        .eq("is_active", true)
        .maybeSingle();

      if (!connection) {
        return new Response(
          JSON.stringify({ success: false, error: "Meta não conectada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get SKUs for these product IDs
      const { data: prods } = await supabase
        .from("products")
        .select("id, sku")
        .in("id", productIds);

      // Use /items_batch for delete too
      const deleteRequests = (prods || []).map((p: any) => ({
        method: "DELETE",
        data: {
          id: p.sku || p.id,
        },
      }));

      const deleteUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${catalogId}/items_batch`;
      const formData = new URLSearchParams({
        access_token: connection.access_token,
        item_type: "PRODUCT_ITEM",
        requests: JSON.stringify(deleteRequests),
      });

      const delResp = await fetch(deleteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      const delBody = await delResp.json();
      console.log(`[meta-catalog-sync] DELETE response:`, JSON.stringify(delBody));

      // Remove from meta_catalog_items
      for (const p of prods || []) {
        await supabase
          .from("meta_catalog_items")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("product_id", p.id)
          .eq("catalog_id", catalogId);
      }

      return new Response(
        JSON.stringify({ success: true, data: { deleted: deleteRequests.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log(`[meta-catalog-sync] ${products.length} products to sync via /items_batch`);

    // Get ALL images for products ordered by sort_order
    const productIdList = products.map((p: any) => p.id);
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id, url, is_primary, sort_order")
      .in("product_id", productIdList)
      .order("sort_order", { ascending: true });

    // Build image maps
    const primaryImageMap: Record<string, string> = {};
    const allImagesMap: Record<string, string[]> = {};
    
    for (const img of images || []) {
      if (!img.url) continue;
      if (!allImagesMap[img.product_id]) {
        allImagesMap[img.product_id] = [];
      }
      allImagesMap[img.product_id].push(img.url);
      if (img.is_primary || !primaryImageMap[img.product_id]) {
        primaryImageMap[img.product_id] = img.url;
      }
    }

    // Get store URL
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

    // Build batch requests using /items_batch format
    const batchItems: any[] = [];
    
    for (const product of products) {
      const productUrl = `${storeBaseUrl}/produto/${product.slug || product.id}`;
      const priceCents = Math.round((product.price || 0) * 100);
      const primaryImage = primaryImageMap[product.id] || "";
      const allImages = allImagesMap[product.id] || [];
      const additionalImages = allImages.filter(u => u !== primaryImage).slice(0, 50);

      // Description
      let description = product.short_description || "";
      if (!description && product.description) {
        description = stripHtml(product.description);
      }
      if (!description) {
        description = product.name || "Produto";
      }
      description = description.substring(0, 9999);

      // /items_batch uses different field names than legacy /batch:
      // name → title, url → link, image_url → image_link, additional_image_urls → additional_image_link
      // price: integer+currency → "VALUE CURRENCY" string
      const productData: Record<string, any> = {
        id: product.sku || product.id, // was retailer_id in /batch, now id inside data
        title: product.name || "Produto",
        description,
        link: productUrl,
        availability: (product.stock_quantity !== null && product.stock_quantity <= 0) ? "out of stock" : "in stock",
        condition: "new",
        brand: product.brand || tenant?.slug || "Loja",
        price: formatPrice(priceCents),
      };

      // Main image
      if (primaryImage) {
        productData.image_link = primaryImage;
      }

      // Additional images
      if (additionalImages.length > 0) {
        productData.additional_image_link = additionalImages;
      }

      // Sale price: compare_at_price is the "original" (higher), price is the "sale"
      if (product.compare_at_price && product.compare_at_price > product.price) {
        const originalCents = Math.round(product.compare_at_price * 100);
        productData.price = formatPrice(originalCents);
        productData.sale_price = formatPrice(priceCents);
      }

      // GTIN/Barcode
      if (product.gtin || product.barcode) {
        productData.gtin = product.gtin || product.barcode;
      }

      // Rich text description
      if (product.description && stripHtml(product.description).length > 200) {
        productData.rich_text_description = product.description.substring(0, 9999);
      }

      console.log(`[meta-catalog-sync] Product SKU=${product.sku} image_link="${productData.image_link || 'NONE'}" price="${productData.price}" additional=${additionalImages.length}`);

      batchItems.push({
        method: "CREATE",
        data: productData,
      });
    }

    // Send to /items_batch in chunks of 4999
    const BATCH_SIZE = 4999;
    let totalSent = 0;
    let totalErrors = 0;
    const errorDetails: any[] = [];

    for (let i = 0; i < batchItems.length; i += BATCH_SIZE) {
      const batch = batchItems.slice(i, i + BATCH_SIZE);

      try {
        const batchUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${catalogId}/items_batch`;
        
        const formData = new URLSearchParams({
          access_token: accessToken,
          item_type: "PRODUCT_ITEM",
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
          const handles = responseBody.handles || [];
          const validationStatus = responseBody.validation_status || [];
          const warnings = responseBody.warnings || [];
          
          console.log(`[meta-catalog-sync] Batch response: handles=${handles.length}, validation_status=${validationStatus.length}, warnings=${warnings.length}`);
          console.log(`[meta-catalog-sync][DEBUG] Full response:`, JSON.stringify(responseBody).substring(0, 3000));

          // Count errors from validation_status
          let batchErrors = 0;
          for (const vs of validationStatus) {
            if (vs.errors && vs.errors.length > 0) {
              batchErrors++;
              const product = products[i + validationStatus.indexOf(vs)];
              errorDetails.push({
                productId: product?.id,
                name: product?.name,
                retailer_id: vs.retailer_id || vs.id,
                errors: vs.errors,
              });
              console.warn(`[meta-catalog-sync] Validation error for ${vs.retailer_id || vs.id}:`, JSON.stringify(vs.errors));
            }
          }

          // Log warnings (items_batch provides them unlike legacy /batch)
          if (warnings.length > 0) {
            console.warn(`[meta-catalog-sync] Warnings:`, JSON.stringify(warnings).substring(0, 2000));
          }

          totalSent += batch.length - batchErrors;
          totalErrors += batchErrors;

          // Update meta_catalog_items
          for (let j = 0; j < batch.length; j++) {
            const product = products[i + j];
            const itemId = batch[j].data.id;
            const hasError = validationStatus.some(
              (vs: any) => (vs.retailer_id === itemId || vs.id === itemId) && vs.errors?.length > 0
            );

            await supabase
              .from("meta_catalog_items")
              .upsert({
                tenant_id: tenantId,
                product_id: product.id,
                catalog_id: catalogId,
                status: hasError ? "error" : "synced",
                last_error: hasError
                  ? JSON.stringify(validationStatus.find((vs: any) => (vs.retailer_id === itemId || vs.id === itemId))?.errors)
                  : null,
                last_synced_at: new Date().toISOString(),
              }, { onConflict: "tenant_id,product_id,catalog_id" });
          }
        } else {
          const errMsg = responseBody?.error?.message || JSON.stringify(responseBody).substring(0, 500);
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
