import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "3.0.0"; // Fix GTIN, all images, description, permalink storage
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  console.log(`[meli-publish-listing][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Não autorizado" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ success: false, error: "Sessão inválida" });
    }

    const body = await req.json();
    const { tenantId, listingId, action } = body;

    if (!tenantId || !listingId) {
      return jsonResponse({ success: false, error: "tenantId e listingId são obrigatórios" });
    }

    // Verify user access
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!userRole) {
      return jsonResponse({ success: false, error: "Sem acesso ao tenant" });
    }

    // Get listing with product data - include gtin, regulatory_info, warranty
    const { data: listing, error: listingError } = await supabase
      .from("meli_listings")
      .select("*, product:products(name, sku, price, stock_quantity, description, weight, width, height, depth, brand, gtin, regulatory_info, warranty_type, warranty_duration)")
      .eq("id", listingId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (listingError || !listing) {
      return jsonResponse({ success: false, error: "Anúncio não encontrado" });
    }

    // Get ML connection
    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .maybeSingle();

    if (!connection?.access_token) {
      return jsonResponse({ success: false, error: "Mercado Livre não conectado" });
    }

    let accessToken = connection.access_token;

    // Auto-refresh token if expired
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      console.log(`[meli-publish-listing] Token expired, attempting auto-refresh...`);
      try {
        const refreshRes = await supabase.functions.invoke("meli-token-refresh", {
          body: { connectionId: connection.id },
        });
        if (refreshRes.data?.success && refreshRes.data?.refreshed > 0) {
          const { data: refreshedConn } = await supabase
            .from("marketplace_connections")
            .select("access_token")
            .eq("id", connection.id)
            .maybeSingle();
          if (refreshedConn?.access_token) {
            accessToken = refreshedConn.access_token;
            console.log(`[meli-publish-listing] Token refreshed successfully`);
          } else {
            return jsonResponse({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" });
          }
        } else {
          return jsonResponse({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" });
        }
      } catch (refreshErr) {
        console.error(`[meli-publish-listing] Token refresh failed:`, refreshErr);
        return jsonResponse({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" });
      }
    }

    // Get ALL product images (not just primary)
    const { data: productImages } = await supabase
      .from("product_images")
      .select("url, sort_order, is_primary")
      .eq("product_id", listing.product_id)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(10);

    // Handle different actions
    if (action === "pause") {
      return await pauseListing(accessToken, listing, supabase);
    }
    if (action === "activate") {
      return await activateListing(accessToken, listing, supabase);
    }
    if (action === "update") {
      return await updateListing(accessToken, listing, productImages, supabase);
    }

    // Default: publish new listing
    if (listing.status !== "approved" && listing.status !== "error") {
      return jsonResponse({ success: false, error: "Anúncio deve estar aprovado para publicar" });
    }

    // Mark as publishing
    await supabase
      .from("meli_listings")
      .update({ status: "publishing" })
      .eq("id", listingId);

    // Build images list — ALWAYS use all product images, merge with listing images
    const images = buildImagesList(listing.images, productImages);
    
    // Validate required fields
    if (!listing.category_id) {
      await supabase.from("meli_listings").update({ status: "error", error_message: "Categoria do ML é obrigatória. Edite o anúncio e informe o category_id." }).eq("id", listingId);
      return jsonResponse({ success: false, error: "Categoria do ML é obrigatória (category_id). Edite o anúncio." });
    }

    // Title length guard
    try {
      const catRes = await fetch(`https://api.mercadolibre.com/categories/${listing.category_id}`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (catRes.ok) {
        const catData = await catRes.json();
        const maxLen = catData.settings?.max_title_length;
        if (maxLen && listing.title.length > maxLen) {
          const errMsg = `Título excede o limite da categoria (${listing.title.length}/${maxLen} caracteres). Reduza o título e tente novamente.`;
          await supabase.from("meli_listings").update({ status: "error", error_message: errMsg }).eq("id", listingId);
          return jsonResponse({ success: false, error: errMsg, code: "title_too_long" });
        }
      }
    } catch (catErr) {
      console.log(`[meli-publish-listing] Category title length check skipped:`, catErr);
    }

    if (images.length === 0) {
      await supabase.from("meli_listings").update({ status: "error", error_message: "Pelo menos 1 imagem é obrigatória." }).eq("id", listingId);
      return jsonResponse({ success: false, error: "Pelo menos 1 imagem é obrigatória para publicar no ML." });
    }

    // Strip HTML from description - ML only accepts plain text
    const rawDescription = listing.description || listing.product?.description || "";
    const plainDescription = rawDescription.replace(/<[^>]*>/g, "").trim();

    const itemPayload: any = {
      title: listing.title,
      category_id: listing.category_id,
      price: Number(listing.price),
      currency_id: listing.currency_id || "BRL",
      available_quantity: listing.available_quantity || 1,
      buying_mode: "buy_it_now",
      condition: listing.condition || "new",
      listing_type_id: listing.listing_type || "gold_special",
      pictures: images,
    };

    // Shipping
    if (listing.shipping && Object.keys(listing.shipping).length > 0) {
      itemPayload.shipping = listing.shipping;
    } else {
      itemPayload.shipping = {
        mode: "me2",
        local_pick_up: false,
        free_shipping: false,
      };
    }

    // Attributes - merge saved + product fallback
    const attributes: any[] = [];
    
    if (Array.isArray(listing.attributes) && listing.attributes.length > 0) {
      attributes.push(...listing.attributes);
    }
    
    const attrIds = new Set(attributes.map((a: any) => a.id));
    
    if (!attrIds.has("BRAND") && listing.product?.brand) {
      attributes.push({ id: "BRAND", value_name: listing.product.brand });
    }
    if (!attrIds.has("GTIN") && listing.product?.gtin) {
      attributes.push({ id: "GTIN", value_name: listing.product.gtin });
    }
    if (!attrIds.has("SELLER_SKU") && listing.product?.sku) {
      attributes.push({ id: "SELLER_SKU", value_name: listing.product.sku });
    }
    
    // Package dimensions
    if (!attrIds.has("PACKAGE_WEIGHT") && listing.product?.weight) {
      attributes.push({ id: "PACKAGE_WEIGHT", value_name: `${listing.product.weight} g` });
    }
    if (!attrIds.has("PACKAGE_WIDTH") && listing.product?.width) {
      attributes.push({ id: "PACKAGE_WIDTH", value_name: `${listing.product.width} cm` });
    }
    if (!attrIds.has("PACKAGE_HEIGHT") && listing.product?.height) {
      attributes.push({ id: "PACKAGE_HEIGHT", value_name: `${listing.product.height} cm` });
    }
    if (!attrIds.has("PACKAGE_LENGTH") && listing.product?.depth) {
      attributes.push({ id: "PACKAGE_LENGTH", value_name: `${listing.product.depth} cm` });
    }

    // Warranty from product
    if (listing.product?.warranty_type && listing.product.warranty_type !== 'none') {
      const warrantyLabel = listing.product.warranty_type === 'vendor' ? 'Garantia do vendedor' : 'Garantia de fábrica';
      const warrantyText = listing.product.warranty_duration 
        ? `${warrantyLabel}: ${listing.product.warranty_duration}`
        : warrantyLabel;
      itemPayload.warranty = warrantyText;
    }

    if (attributes.length > 0) {
      itemPayload.attributes = attributes;
    }

    console.log(`[meli-publish-listing] Publishing item: ${listing.title}, category: ${listing.category_id}, images: ${images.length}, attrs: ${attributes.length}`);
    console.log(`[meli-publish-listing] Description length: ${plainDescription.length}`);

    // Call ML API to create item (WITHOUT description - must be sent separately)
    const publishRes = await fetch("https://api.mercadolibre.com/items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(itemPayload),
    });

    const responseText = await publishRes.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!publishRes.ok) {
      let errorMsg = responseData?.message || "Erro ao publicar no Mercado Livre";
      const causes = responseData?.cause || [];
      if (Array.isArray(causes) && causes.length > 0) {
        const causeMessages = causes.map((c: any) => c.message || c.code || JSON.stringify(c)).join("; ");
        errorMsg = `${errorMsg}: ${causeMessages}`;
      }
      console.error(`[meli-publish-listing] ML API error ${publishRes.status}:`, JSON.stringify(responseData).slice(0, 1000));

      await supabase
        .from("meli_listings")
        .update({
          status: "error",
          error_message: errorMsg.slice(0, 500),
          meli_response: responseData,
        })
        .eq("id", listingId);

      return jsonResponse({
        success: false,
        error: errorMsg,
        details: causes.length > 0 ? causes : undefined,
      });
    }

    // Success - now send description separately (ML API requires this)
    const meliItemId = responseData.id;
    const permalink = responseData.permalink;

    if (plainDescription) {
      console.log(`[meli-publish-listing] Sending description for ${meliItemId} (${plainDescription.length} chars)`);
      try {
        const descRes = await fetch(`https://api.mercadolibre.com/items/${meliItemId}/description`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plain_text: plainDescription }),
        });
        if (!descRes.ok) {
          const descError = await descRes.text();
          console.error(`[meli-publish-listing] Description upload failed:`, descError);
        } else {
          console.log(`[meli-publish-listing] Description uploaded successfully`);
        }
      } catch (descErr) {
        console.error(`[meli-publish-listing] Description upload error:`, descErr);
      }
    }

    console.log(`[meli-publish-listing] Published successfully: ${meliItemId}, permalink: ${permalink}`);

    await supabase
      .from("meli_listings")
      .update({
        status: "published",
        meli_item_id: meliItemId,
        meli_response: responseData,
        error_message: null,
        published_at: new Date().toISOString(),
      })
      .eq("id", listingId);

    return jsonResponse({
      success: true,
      meli_item_id: meliItemId,
      permalink,
      message: "Anúncio publicado com sucesso no Mercado Livre!",
    });

  } catch (error: any) {
    console.error(`[meli-publish-listing] Error:`, error);
    return jsonResponse({ success: false, error: error.message || "Erro interno" });
  }
});

// ===================== Helper Functions =====================

function buildImagesList(listingImages: any[], productImages: any[] | null): any[] {
  const seenUrls = new Set<string>();
  const images: any[] = [];

  // First: add listing-specific images
  if (Array.isArray(listingImages) && listingImages.length > 0) {
    for (const img of listingImages) {
      const url = typeof img === "string" ? img : img.url || img.source;
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        images.push({ source: url });
      }
    }
  }

  // Then: add ALL product images (not just fallback)
  if (productImages?.length) {
    for (const img of productImages) {
      if (img.url && !seenUrls.has(img.url)) {
        seenUrls.add(img.url);
        images.push({ source: img.url });
      }
    }
  }

  return images.slice(0, 10);
}

async function pauseListing(accessToken: string, listing: any, supabase: any) {
  if (!listing.meli_item_id) {
    return jsonResponse({ success: false, error: "Anúncio não publicado" });
  }

  const res = await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "paused" }),
  });

  const data = await res.json();
  if (!res.ok) {
    return jsonResponse({ success: false, error: data.message || "Erro ao pausar" });
  }

  await supabase.from("meli_listings").update({ status: "paused", meli_response: data }).eq("id", listing.id);
  return jsonResponse({ success: true, message: "Anúncio pausado" });
}

async function activateListing(accessToken: string, listing: any, supabase: any) {
  if (!listing.meli_item_id) {
    return jsonResponse({ success: false, error: "Anúncio não publicado" });
  }

  const res = await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "active" }),
  });

  const data = await res.json();
  if (!res.ok) {
    return jsonResponse({ success: false, error: data.message || "Erro ao reativar" });
  }

  await supabase.from("meli_listings").update({ status: "published", meli_response: data }).eq("id", listing.id);
  return jsonResponse({ success: true, message: "Anúncio reativado" });
}

async function updateListing(accessToken: string, listing: any, productImages: any[] | null, supabase: any) {
  if (!listing.meli_item_id) {
    return jsonResponse({ success: false, error: "Anúncio não publicado" });
  }

  const updatePayload: any = {
    price: Number(listing.price),
    available_quantity: listing.available_quantity,
  };

  // Update images if available
  const images = buildImagesList(listing.images, productImages);
  if (images.length > 0) {
    updatePayload.pictures = images;
  }

  const res = await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(updatePayload),
  });

  const data = await res.json();
  if (!res.ok) {
    return jsonResponse({ success: false, error: data.message || "Erro ao atualizar" });
  }

  // Also update description separately
  if (listing.description) {
    const plainDesc = listing.description.replace(/<[^>]*>/g, "").trim();
    await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}/description`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plain_text: plainDesc }),
    });
  }

  await supabase.from("meli_listings").update({ meli_response: data }).eq("id", listing.id);
  return jsonResponse({ success: true, message: "Anúncio atualizado no Mercado Livre" });
}