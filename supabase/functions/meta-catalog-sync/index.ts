import { createClient } from "npm:@supabase/supabase-js@2";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";

// ===== VERSION =====
const VERSION = "v6.1.0"; // Phase 5: Migrate to centralized meta-connection helper (V4+fallback)
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_API_VERSION = "v21.0";
const META_MIN_IMAGE_SIZE = 500; // Meta requires minimum 500x500 for catalog

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

/**
 * Validate an image URL server-side:
 * - HEAD request to check status, content-type, content-length
 * - If PNG/JPEG, try to read actual dimensions from the binary header
 */
async function validateImageUrl(url: string): Promise<{
  valid: boolean;
  status?: number;
  contentType?: string;
  contentLength?: number;
  width?: number;
  height?: number;
  error?: string;
  redirectUrl?: string;
}> {
  if (!url) return { valid: false, error: "URL vazia" };

  try {
    // First do HEAD to check basic accessibility
    const headResp = await fetch(url, { method: "HEAD", redirect: "follow" });
    const contentType = headResp.headers.get("content-type") || "";
    const contentLength = parseInt(headResp.headers.get("content-length") || "0", 10);
    const finalUrl = headResp.url; // After redirects

    if (!headResp.ok) {
      return {
        valid: false,
        status: headResp.status,
        contentType,
        error: `HTTP ${headResp.status}`,
        redirectUrl: finalUrl !== url ? finalUrl : undefined,
      };
    }

    // Check content type
    const isImage = contentType.startsWith("image/");
    if (!isImage) {
      return {
        valid: false,
        status: headResp.status,
        contentType,
        contentLength,
        error: `Content-Type não é imagem: ${contentType}`,
      };
    }

    // Check content length (must be > 0)
    if (contentLength === 0) {
      // Some servers don't return content-length on HEAD, try GET with range
      const rangeResp = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
      });
      if (!rangeResp.ok && rangeResp.status !== 206) {
        return {
          valid: false,
          status: rangeResp.status,
          contentType,
          error: "Arquivo vazio ou inacessível",
        };
      }
    }

    // Try to get image dimensions by reading first bytes
    let width: number | undefined;
    let height: number | undefined;

    try {
      // Read first 32KB to get dimensions from header
      const getResp = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-32767" },
        redirect: "follow",
      });

      if (getResp.ok || getResp.status === 206) {
        const buffer = await getResp.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const dims = getImageDimensions(bytes, contentType);
        if (dims) {
          width = dims.width;
          height = dims.height;
        }
      }
    } catch {
      // If range request fails, we'll skip dimension check
      console.warn(`[image-validate] Could not read dimensions for ${url}`);
    }

    // Validate dimensions against Meta minimum
    if (width !== undefined && height !== undefined) {
      if (width < META_MIN_IMAGE_SIZE || height < META_MIN_IMAGE_SIZE) {
        return {
          valid: false,
          status: headResp.status,
          contentType,
          contentLength,
          width,
          height,
          error: `Imagem ${width}x${height} abaixo do mínimo Meta (${META_MIN_IMAGE_SIZE}x${META_MIN_IMAGE_SIZE})`,
          redirectUrl: finalUrl !== url ? finalUrl : undefined,
        };
      }
    }

    return {
      valid: true,
      status: headResp.status,
      contentType,
      contentLength: contentLength || undefined,
      width,
      height,
      redirectUrl: finalUrl !== url ? finalUrl : undefined,
    };
  } catch (err) {
    return { valid: false, error: `Fetch error: ${String(err)}` };
  }
}

/**
 * Read image dimensions from binary header bytes
 */
function getImageDimensions(
  bytes: Uint8Array,
  contentType: string
): { width: number; height: number } | null {
  try {
    // PNG: bytes 16-23 contain width (4 bytes BE) and height (4 bytes BE) in IHDR
    if (contentType.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
      if (bytes.length >= 24) {
        const width =
          (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height =
          (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        if (width > 0 && height > 0 && width < 100000 && height < 100000) {
          return { width, height };
        }
      }
    }

    // JPEG: scan for SOF markers (0xFF 0xC0-0xCF, excluding 0xC4 and 0xCC)
    if (contentType.includes("jpeg") || contentType.includes("jpg") || (bytes[0] === 0xFF && bytes[1] === 0xD8)) {
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes[i] !== 0xFF) { i++; continue; }
        const marker = bytes[i + 1];
        if (
          marker >= 0xC0 && marker <= 0xCF &&
          marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC
        ) {
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width = (bytes[i + 7] << 8) | bytes[i + 8];
          if (width > 0 && height > 0) {
            return { width, height };
          }
        }
        const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
        i += 2 + segLen;
      }
    }

    // WebP: RIFF header, VP8 chunk
    if (contentType.includes("webp") || (bytes[0] === 0x52 && bytes[1] === 0x49)) {
      if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF") {
        // VP8 lossy
        if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
          const width = ((bytes[26] | (bytes[27] << 8)) & 0x3FFF);
          const height = ((bytes[28] | (bytes[29] << 8)) & 0x3FFF);
          return { width, height };
        }
        // VP8L lossless
        if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4C) {
          if (bytes.length >= 25) {
            const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
            const width = 1 + (((b1 & 0x3F) << 8) | b0);
            const height = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
            return { width, height };
          }
        }
      }
    }
  } catch {
    // Silent fail
  }
  return null;
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

    // === DELETE action ===
    if (action === "delete") {
      if (!tenantId || !catalogId || !productIds?.length) {
        return new Response(
          JSON.stringify({ success: false, error: "tenantId, catalogId and productIds required for delete" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const connection = await getMetaConnectionForTenant(supabase, tenantId);

      if (!connection) {
        return new Response(
          JSON.stringify({ success: false, error: "Meta não conectada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: prods } = await supabase
        .from("products")
        .select("id, sku, meta_retailer_id")
        .in("id", productIds);

      // Also check tombstoned IDs to delete those too
      const { data: retiredIds } = await supabase
        .from("meta_retired_ids")
        .select("retired_id")
        .in("product_id", productIds)
        .eq("channel", "meta");

      const deleteRequests: any[] = [];
      for (const p of prods || []) {
        // Use meta_retailer_id if set, otherwise SKU
        const retailerId = p.meta_retailer_id || p.sku || p.id;
        deleteRequests.push({ method: "DELETE", data: { id: retailerId } });
      }
      // Also delete any retired/tombstoned IDs
      for (const r of retiredIds || []) {
        deleteRequests.push({ method: "DELETE", data: { id: r.retired_id } });
      }

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

    // === SYNC action (default) ===
    if (!tenantId || !catalogId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId and catalogId are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Meta connection
    const connection = await getMetaConnectionForTenant(supabase, tenantId);

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
      .select("id, name, slug, sku, description, short_description, price, compare_at_price, brand, gtin, barcode, weight, stock_quantity, tags, product_format, meta_retailer_id")
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

    // Get ALL images for products - SAME query structure as UI uses
    // Ordered by sort_order ASC, created_at ASC for deterministic ordering
    const productIdList = products.map((p: any) => p.id);
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id, url, is_primary, sort_order, created_at")
      .in("product_id", productIdList)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    // Build image maps with deterministic ordering
    const primaryImageMap: Record<string, string> = {};
    const allImagesMap: Record<string, string[]> = {};

    for (const img of images || []) {
      if (!img.url) continue;
      if (!allImagesMap[img.product_id]) {
        allImagesMap[img.product_id] = [];
      }
      allImagesMap[img.product_id].push(img.url);
      // Primary: explicit is_primary flag OR first image by sort order
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

    // ===== PRE-VALIDATE ALL PRIMARY IMAGES =====
    console.log(`[meta-catalog-sync] Validating ${Object.keys(primaryImageMap).length} primary images...`);
    const imageValidations: Record<string, Awaited<ReturnType<typeof validateImageUrl>>> = {};

    // Validate all images in parallel (batches of 10 to avoid overwhelming)
    const validationEntries = Object.entries(primaryImageMap);
    for (let vi = 0; vi < validationEntries.length; vi += 10) {
      const batch = validationEntries.slice(vi, vi + 10);
      const results = await Promise.all(
        batch.map(([pid, url]) => validateImageUrl(url).then(r => ({ pid, result: r })))
      );
      for (const { pid, result } of results) {
        imageValidations[pid] = result;
        if (!result.valid) {
          console.warn(`[meta-catalog-sync] ❌ Image INVALID for product ${pid}: ${result.error} (${result.width}x${result.height}) URL: ${primaryImageMap[pid]}`);
        } else {
          console.log(`[meta-catalog-sync] ✅ Image OK for product ${pid}: ${result.width}x${result.height} (${result.contentType})`);
        }
      }
    }

    // ===== DELETE TOMBSTONED/RETIRED IDs FROM META =====
    const { data: retiredIds } = await supabase
      .from("meta_retired_ids")
      .select("retired_id, product_id")
      .in("product_id", productIdList)
      .eq("channel", "meta");

    if (retiredIds && retiredIds.length > 0) {
      console.log(`[meta-catalog-sync] Found ${retiredIds.length} retired IDs to delete from Meta`);
      const deleteRetiredRequests = retiredIds.map(r => ({
        method: "DELETE",
        data: { id: r.retired_id },
      }));

      try {
        const delUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${catalogId}/items_batch`;
        const delForm = new URLSearchParams({
          access_token: accessToken,
          item_type: "PRODUCT_ITEM",
          requests: JSON.stringify(deleteRetiredRequests),
        });
        const delResp = await fetch(delUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: delForm.toString(),
        });
        const delBody = await delResp.json();
        console.log(`[meta-catalog-sync] Retired IDs delete response:`, JSON.stringify(delBody));
      } catch (e) {
        console.warn(`[meta-catalog-sync] Failed to delete retired IDs:`, e);
      }
    }

    // Build batch items with per-product audit
    const batchItems: any[] = [];
    const productPayloads: Record<string, any> = {}; // productId -> payload for audit
    const imageErrors: Array<{ productId: string; sku: string; name: string; error: string; dimensions?: string }> = [];

    for (const product of products) {
      const productUrl = `${storeBaseUrl}/produto/${product.slug || product.id}`;
      const priceCents = Math.round((product.price || 0) * 100);
      const primaryImage = primaryImageMap[product.id] || "";
      const allImages = allImagesMap[product.id] || [];
      const additionalImages = allImages.filter(u => u !== primaryImage).slice(0, 50);

      // Check image validation result
      const imgValidation = imageValidations[product.id];
      if (primaryImage && imgValidation && !imgValidation.valid) {
        imageErrors.push({
          productId: product.id,
          sku: product.sku || "",
          name: product.name || "",
          error: imgValidation.error || "Imagem inválida",
          dimensions: imgValidation.width && imgValidation.height
            ? `${imgValidation.width}x${imgValidation.height}`
            : undefined,
        });

        // Save validation error to meta_catalog_items
        await supabase
          .from("meta_catalog_items")
          .upsert({
            tenant_id: tenantId,
            product_id: product.id,
            catalog_id: catalogId,
            status: "image_error",
            last_error: imgValidation.error,
            last_synced_at: new Date().toISOString(),
            last_image_validation: imgValidation,
            sync_version: VERSION,
          }, { onConflict: "tenant_id,product_id,catalog_id" });

        console.warn(`[meta-catalog-sync] SKIPPING product SKU=${product.sku} - image validation failed: ${imgValidation.error}`);
        continue; // Skip this product - don't send broken images to Meta
      }

      // Description
      let description = product.short_description || "";
      if (!description && product.description) {
        description = stripHtml(product.description);
      }
      if (!description) {
        description = product.name || "Produto";
      }
      description = description.substring(0, 9999);

      // Use meta_retailer_id if set, otherwise fall back to SKU, then product UUID
      const retailerId = product.meta_retailer_id || product.sku || product.id;

      const productData: Record<string, any> = {
        id: retailerId,
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

      // Sale price
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

      // Store payload for audit
      productPayloads[product.id] = productData;

      console.log(`[meta-catalog-sync] Product SKU=${product.sku} retailer_id="${retailerId}" image_link="${productData.image_link || 'NONE'}" price="${productData.price}" additional=${additionalImages.length} img_valid=${imgValidation?.valid ?? 'no-image'} img_dims=${imgValidation?.width}x${imgValidation?.height}`);

      batchItems.push({
        method: "CREATE",
        data: productData,
      });
    }

    if (imageErrors.length > 0) {
      console.warn(`[meta-catalog-sync] ${imageErrors.length} products skipped due to image validation errors:`, JSON.stringify(imageErrors));
    }

    // Send to /items_batch in chunks of 4999
    const BATCH_SIZE = 4999;
    let totalSent = 0;
    let totalErrors = 0;
    const errorDetails: any[] = [];

    // Track which products are in each batch for audit
    const batchProductMap: any[] = []; // index -> product
    let batchIdx = 0;
    for (const product of products) {
      if (productPayloads[product.id]) {
        batchProductMap[batchIdx] = product;
        batchIdx++;
      }
    }

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

        console.log(`[meta-catalog-sync] Sending batch ${i}-${i + batch.length} to items_batch`);

        const batchResponse = await fetch(batchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        const responseBody = await batchResponse.json();
        const responseStr = JSON.stringify(responseBody).substring(0, 5000);

        if (batchResponse.ok && responseBody) {
          const handles = responseBody.handles || [];
          const validationStatus = responseBody.validation_status || [];
          const warnings = responseBody.warnings || [];

          console.log(`[meta-catalog-sync] Batch OK: handles=${handles.length}, validation_status=${validationStatus.length}, warnings=${warnings.length}`);
          console.log(`[meta-catalog-sync][DEBUG] Response:`, responseStr);

          let batchErrors = 0;
          for (const vs of validationStatus) {
            if (vs.errors && vs.errors.length > 0) {
              batchErrors++;
              const product = batchProductMap[i + validationStatus.indexOf(vs)];
              errorDetails.push({
                productId: product?.id,
                sku: product?.sku,
                name: product?.name,
                retailer_id: vs.retailer_id || vs.id,
                errors: vs.errors,
              });
              console.warn(`[meta-catalog-sync] Meta validation error for ${vs.retailer_id || vs.id}:`, JSON.stringify(vs.errors));
            }
          }

          if (warnings.length > 0) {
            console.warn(`[meta-catalog-sync] Warnings:`, JSON.stringify(warnings).substring(0, 2000));
          }

          totalSent += batch.length - batchErrors;
          totalErrors += batchErrors;

          // Update meta_catalog_items with audit data
          for (let j = 0; j < batch.length; j++) {
            const product = batchProductMap[i + j];
            if (!product) continue;

            const itemId = batch[j].data.id;
            const hasError = validationStatus.some(
              (vs: any) => (vs.retailer_id === itemId || vs.id === itemId) && vs.errors?.length > 0
            );
            const itemValidation = validationStatus.find(
              (vs: any) => vs.retailer_id === itemId || vs.id === itemId
            );

            await supabase
              .from("meta_catalog_items")
              .upsert({
                tenant_id: tenantId,
                product_id: product.id,
                catalog_id: catalogId,
                status: hasError ? "error" : "synced",
                last_error: hasError ? JSON.stringify(itemValidation?.errors) : null,
                last_synced_at: new Date().toISOString(),
                last_payload: productPayloads[product.id] || null,
                last_response: itemValidation || { batch_ok: true, handles: handles.length },
                last_image_validation: imageValidations[product.id] || null,
                sync_version: VERSION,
              }, { onConflict: "tenant_id,product_id,catalog_id" });
          }
        } else {
          const errMsg = responseBody?.error?.message || responseStr;
          totalErrors += batch.length;
          console.error(`[meta-catalog-sync] Batch FAILED:`, errMsg);
          errorDetails.push({ batch: `${i}-${i + batch.length}`, error: errMsg });

          // Save failure to all products in batch
          for (let j = 0; j < batch.length; j++) {
            const product = batchProductMap[i + j];
            if (!product) continue;
            await supabase
              .from("meta_catalog_items")
              .upsert({
                tenant_id: tenantId,
                product_id: product.id,
                catalog_id: catalogId,
                status: "error",
                last_error: errMsg.substring(0, 1000),
                last_synced_at: new Date().toISOString(),
                last_payload: productPayloads[product.id] || null,
                last_response: responseBody,
                sync_version: VERSION,
              }, { onConflict: "tenant_id,product_id,catalog_id" });
          }
        }
      } catch (batchErr) {
        totalErrors += batch.length;
        console.error(`[meta-catalog-sync] Batch ${i} exception:`, batchErr);
      }
    }

    const skipped = imageErrors.length;
    console.log(`[meta-catalog-sync] Done: ${totalSent} synced, ${totalErrors} errors, ${skipped} skipped (image validation) of ${products.length} total`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          synced: totalSent,
          failed: totalErrors,
          skipped,
          total: products.length,
          errors: errorDetails.slice(0, 10),
          imageErrors: imageErrors.slice(0, 10),
        },
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
