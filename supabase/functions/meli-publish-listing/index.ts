import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "1.0.0"; // Initial release - publish listings to ML API
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

/**
 * Mercado Livre Publish Listing v1.0.0
 * 
 * Publica um anúncio aprovado na API do Mercado Livre.
 * POST /items - Cria novo item
 * PUT /items/{id} - Atualiza item existente
 * 
 * Contrato: HTTP 200 + { success: true/false }
 */
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
      .single();

    if (!userRole) {
      return jsonResponse({ success: false, error: "Sem acesso ao tenant" });
    }

    // Get listing
    const { data: listing, error: listingError } = await supabase
      .from("meli_listings")
      .select("*, product:products(name, sku, price, stock_quantity, description, weight, width, height, depth, brand)")
      .eq("id", listingId)
      .eq("tenant_id", tenantId)
      .single();

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
      .single();

    if (!connection?.access_token) {
      return jsonResponse({ success: false, error: "Mercado Livre não conectado" });
    }

    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return jsonResponse({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" });
    }

    const accessToken = connection.access_token;

    // Get product images
    const { data: productImages } = await supabase
      .from("product_images")
      .select("url, position")
      .eq("product_id", listing.product_id)
      .order("position", { ascending: true })
      .limit(10);

    // Handle different actions
    if (action === "pause") {
      return await pauseListing(accessToken, listing, supabase);
    }
    if (action === "activate") {
      return await activateListing(accessToken, listing, supabase);
    }
    if (action === "update") {
      return await updateListing(accessToken, listing, supabase);
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

    // Build ML item payload
    const images = buildImagesList(listing.images, productImages);
    
    const itemPayload: any = {
      title: listing.title,
      category_id: listing.category_id || "MLB1000", // Default category if not set
      price: Number(listing.price),
      currency_id: listing.currency_id || "BRL",
      available_quantity: listing.available_quantity || 1,
      buying_mode: "buy_it_now",
      condition: listing.condition || "new",
      listing_type_id: listing.listing_type || "gold_special",
      description: { plain_text: listing.description || listing.product?.description || "" },
      pictures: images,
    };

    // Add shipping if configured
    if (listing.shipping && Object.keys(listing.shipping).length > 0) {
      itemPayload.shipping = listing.shipping;
    } else {
      // Default: mercado envios
      itemPayload.shipping = {
        mode: "me2",
        local_pick_up: false,
        free_shipping: false,
      };
    }

    // Add attributes if available
    if (listing.attributes && Array.isArray(listing.attributes) && listing.attributes.length > 0) {
      itemPayload.attributes = listing.attributes;
    } else {
      // Add basic attributes from product
      const attrs: any[] = [];
      if (listing.product?.brand) {
        attrs.push({ id: "BRAND", value_name: listing.product.brand });
      }
      if (listing.product?.sku) {
        attrs.push({ id: "SELLER_SKU", value_name: listing.product.sku });
      }
      if (attrs.length > 0) {
        itemPayload.attributes = attrs;
      }
    }

    console.log(`[meli-publish-listing] Publishing item: ${listing.title}`);

    // Call ML API
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
      const errorMsg = responseData?.message || responseData?.cause?.[0]?.message || "Erro ao publicar no Mercado Livre";
      console.error(`[meli-publish-listing] ML API error:`, responseData);

      await supabase
        .from("meli_listings")
        .update({
          status: "error",
          error_message: errorMsg,
          meli_response: responseData,
        })
        .eq("id", listingId);

      return jsonResponse({
        success: false,
        error: errorMsg,
        details: responseData?.cause || undefined,
      });
    }

    // Success - update listing with ML data
    const meliItemId = responseData.id;
    const permalink = responseData.permalink;

    console.log(`[meli-publish-listing] Published successfully: ${meliItemId}`);

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
  const images: any[] = [];

  // Use listing images first (if any)
  if (Array.isArray(listingImages) && listingImages.length > 0) {
    for (const img of listingImages) {
      const url = typeof img === "string" ? img : img.url || img.source;
      if (url) images.push({ source: url });
    }
  }

  // Fall back to product images
  if (images.length === 0 && productImages?.length) {
    for (const img of productImages) {
      if (img.url) images.push({ source: img.url });
    }
  }

  return images.slice(0, 10); // ML limit: 10 images
}

async function pauseListing(accessToken: string, listing: any, supabase: any) {
  if (!listing.meli_item_id) {
    return jsonResponse({ success: false, error: "Anúncio não publicado" });
  }

  const res = await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "paused" }),
  });

  const data = await res.json();
  if (!res.ok) {
    return jsonResponse({ success: false, error: data.message || "Erro ao pausar" });
  }

  await supabase
    .from("meli_listings")
    .update({ status: "paused", meli_response: data })
    .eq("id", listing.id);

  return jsonResponse({ success: true, message: "Anúncio pausado" });
}

async function activateListing(accessToken: string, listing: any, supabase: any) {
  if (!listing.meli_item_id) {
    return jsonResponse({ success: false, error: "Anúncio não publicado" });
  }

  const res = await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "active" }),
  });

  const data = await res.json();
  if (!res.ok) {
    return jsonResponse({ success: false, error: data.message || "Erro ao reativar" });
  }

  await supabase
    .from("meli_listings")
    .update({ status: "published", meli_response: data })
    .eq("id", listing.id);

  return jsonResponse({ success: true, message: "Anúncio reativado" });
}

async function updateListing(accessToken: string, listing: any, supabase: any) {
  if (!listing.meli_item_id) {
    return jsonResponse({ success: false, error: "Anúncio não publicado" });
  }

  // ML allows updating: price, available_quantity, description, pictures, shipping
  const updatePayload: any = {
    price: Number(listing.price),
    available_quantity: listing.available_quantity,
  };

  const res = await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  const data = await res.json();
  if (!res.ok) {
    return jsonResponse({ success: false, error: data.message || "Erro ao atualizar" });
  }

  // Also update description separately (ML requires separate endpoint)
  if (listing.description) {
    await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}/description`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plain_text: listing.description }),
    });
  }

  await supabase
    .from("meli_listings")
    .update({ meli_response: data })
    .eq("id", listing.id);

  return jsonResponse({ success: true, message: "Anúncio atualizado no Mercado Livre" });
}
