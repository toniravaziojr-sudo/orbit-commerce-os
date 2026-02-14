import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: sync products to Meta Commerce catalog
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const GRAPH_API_VERSION = "v21.0";

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
    const { tenantId, catalogId, productIds, action = "sync" } = body;

    if (!tenantId || !catalogId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId and catalogId are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Meta connection
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
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

    // Check if token expired
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Token Meta expirado. Reconecte.", code: "TOKEN_EXPIRED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = connection.access_token;

    // Get page access token for catalog operations
    const metadata = connection.metadata as any;
    const pages = metadata?.assets?.pages || [];
    // Use user access token for catalog API
    const catalogToken = accessToken;

    // Build product query
    let productQuery = supabase
      .from("products")
      .select("id, name, slug, sku, description, short_description, price, compare_at_price, brand, vendor, product_type, tags, weight, status, gtin, barcode")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (productIds && productIds.length > 0) {
      productQuery = productQuery.in("id", productIds);
    }

    const { data: products, error: prodError } = await productQuery.limit(100);

    if (prodError) {
      console.error(`[meta-catalog-sync] Error fetching products:`, prodError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar produtos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: { synced: 0, errors: [] } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get images for products
    const productIdList = products.map(p => p.id);
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id, url, is_primary, position")
      .in("product_id", productIdList)
      .order("position", { ascending: true });

    const imageMap: Record<string, string> = {};
    const additionalImagesMap: Record<string, string[]> = {};
    for (const img of images || []) {
      if (img.is_primary || !imageMap[img.product_id]) {
        imageMap[img.product_id] = img.url;
      }
      if (!additionalImagesMap[img.product_id]) {
        additionalImagesMap[img.product_id] = [];
      }
      if (additionalImagesMap[img.product_id].length < 10) {
        additionalImagesMap[img.product_id].push(img.url);
      }
    }

    // Get store URL for product links
    const { data: tenant } = await supabase
      .from("tenants")
      .select("slug, custom_domain")
      .eq("id", tenantId)
      .single();

    const storeBaseUrl = tenant?.custom_domain
      ? `https://${tenant.custom_domain}`
      : `https://${tenant?.slug}.shops.comandocentral.com.br`;

    // Sync each product to Meta catalog
    const results: Array<{ productId: string; success: boolean; metaProductId?: string; error?: string }> = [];

    for (const product of products) {
      try {
        const primaryImage = imageMap[product.id];
        const additionalImages = additionalImagesMap[product.id] || [];
        const productUrl = `${storeBaseUrl}/produto/${product.slug}`;

        // Build Meta product data (Commerce API format)
        const metaProduct: Record<string, any> = {
          retailer_id: product.sku || product.id,
          name: product.name,
          description: product.description || product.short_description || product.name,
          url: productUrl,
          price: Math.round((product.price || 0) * 100), // cents
          currency: "BRL",
          availability: "in stock",
          condition: "new",
          brand: product.brand || "N/A",
        };

        if (primaryImage) {
          metaProduct.image_url = primaryImage;
        }
        if (additionalImages.length > 1) {
          metaProduct.additional_image_urls = JSON.stringify(additionalImages.slice(1));
        }
        if (product.compare_at_price && product.compare_at_price > product.price) {
          metaProduct.sale_price = Math.round(product.price * 100);
          metaProduct.price = Math.round(product.compare_at_price * 100);
        }
        if (product.gtin || product.barcode) {
          metaProduct.gtin = product.gtin || product.barcode;
        }
        if (product.product_type) {
          metaProduct.category = product.product_type;
        }

        // Send to Meta Commerce API
        const formData = new FormData();
        for (const [key, value] of Object.entries(metaProduct)) {
          formData.append(key, String(value));
        }

        const graphUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${catalogId}/products`;
        const response = await fetch(graphUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${catalogToken}` },
          body: formData,
        });

        const responseText = await response.text();
        let responseData: any;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { error: { message: responseText } };
        }

        if (!response.ok || responseData.error) {
          const errorMsg = responseData.error?.message || `HTTP ${response.status}`;
          console.error(`[meta-catalog-sync] Error syncing product ${product.id}:`, errorMsg);

          // Update catalog item status
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

          results.push({ productId: product.id, success: false, error: errorMsg });
        } else {
          const metaProductId = responseData.id;
          console.log(`[meta-catalog-sync] Product ${product.id} synced → Meta ID: ${metaProductId}`);

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

          results.push({ productId: product.id, success: true, metaProductId });
        }
      } catch (err) {
        console.error(`[meta-catalog-sync] Exception for product ${product.id}:`, err);
        results.push({ productId: product.id, success: false, error: String(err) });
      }
    }

    const synced = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success);

    return new Response(
      JSON.stringify({ success: true, data: { synced, failed: errors.length, results } }),
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
