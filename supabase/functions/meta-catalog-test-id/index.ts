import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Teste definitivo: envia o mesmo produto 0042 com novo retailer_id (0042_TEST)
 * para isolar se o problema é o estado interno do item na Meta.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { tenantId, catalogId, testId = "0042_TEST" } = body;

    // Get connection
    const conn = await getMetaConnectionForTenant(supabase, tenantId);

    if (!conn) {
      return new Response(JSON.stringify({ success: false, error: "No connection" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get product 0042 data
    const { data: product } = await supabase
      .from("products")
      .select("id, name, slug, sku, description, short_description, price, compare_at_price, brand, stock_quantity")
      .eq("sku", "0042")
      .eq("tenant_id", tenantId)
      .single();

    if (!product) {
      return new Response(JSON.stringify({ success: false, error: "Product 0042 not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get images - same query as UI
    const { data: images } = await supabase
      .from("product_images")
      .select("url, is_primary, sort_order")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const primaryImage = images?.find(i => i.is_primary)?.url || images?.[0]?.url || "";

    // Build payload - EXACT SAME as real sync, but with different ID
    const priceCents = Math.round((product.price || 0) * 100);
    const originalCents = product.compare_at_price ? Math.round(product.compare_at_price * 100) : 0;

    let description = product.short_description || product.name || "Produto";
    // Strip HTML
    description = description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 9999);

    const itemData: Record<string, any> = {
      id: testId, // <-- NEW ID, not "0042"
      title: product.name + " [TESTE ID]",
      description,
      link: `https://respeiteohomem.shops.comandocentral.com.br/produto/${product.slug || product.id}`,
      availability: "in stock",
      condition: "new",
      brand: product.brand || "Respeite o Homem",
      price: originalCents > priceCents ? `${(originalCents / 100).toFixed(2)} BRL` : `${(priceCents / 100).toFixed(2)} BRL`,
      image_link: primaryImage,
    };

    if (originalCents > priceCents) {
      itemData.sale_price = `${(priceCents / 100).toFixed(2)} BRL`;
    }

    console.log(`[meta-catalog-test-id] Sending test item with id="${testId}"`);
    console.log(`[meta-catalog-test-id] image_link: ${primaryImage}`);
    console.log(`[meta-catalog-test-id] Full payload:`, JSON.stringify(itemData));

    // Also send the ORIGINAL 0042 as comparison
    const originalData = { ...itemData, id: product.sku, title: product.name };

    const requests = [
      { method: "CREATE", data: itemData },      // 0042_TEST
      { method: "CREATE", data: originalData },   // 0042 (re-create)
    ];

    const batchUrl = `https://graph.facebook.com/v21.0/${catalogId}/items_batch`;
    const formData = new URLSearchParams({
      access_token: conn.access_token,
      item_type: "PRODUCT_ITEM",
      allow_upsert: "true",
      requests: JSON.stringify(requests),
    });

    const resp = await fetch(batchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const result = await resp.json();
    console.log(`[meta-catalog-test-id] Meta response:`, JSON.stringify(result));

    // Also do HEAD on the image to log headers
    let imageHeaders: Record<string, string> = {};
    try {
      const headResp = await fetch(primaryImage, { method: "HEAD", redirect: "follow" });
      headResp.headers.forEach((v, k) => { imageHeaders[k] = v; });
      imageHeaders["_final_url"] = headResp.url;
      imageHeaders["_status"] = String(headResp.status);
    } catch (e) {
      imageHeaders["_error"] = String(e);
    }

    return new Response(JSON.stringify({
      success: true,
      test_id: testId,
      original_id: product.sku,
      image_url: primaryImage,
      image_headers: imageHeaders,
      payload_sent: itemData,
      meta_response: result,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[meta-catalog-test-id] Error:`, err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
