import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

// ===== VERSION =====
const VERSION = "3.7.0"; // v2.0.0 — números regulatórios (ANVISA/AFE/CONAMA) auto-preenchidos por nome do atributo
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

Deno.serve(async (req) => {
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
    console.log(`[meli-publish-listing] action=${action} listingId=${listingId}`);

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
      .select("*, product:products(name, sku, price, stock_quantity, description, weight, width, height, depth, brand, model, line, product_type, ai_product_type, gtin, regulatory_info, warranty_type, warranty_duration)")
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
    if (action === "delete") {
      return await deleteListingOnMeli(accessToken, listing, supabase);
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
      attrIds.add("BRAND");
    }
    if (!attrIds.has("GTIN") && listing.product?.gtin) {
      attributes.push({ id: "GTIN", value_name: listing.product.gtin });
      attrIds.add("GTIN");
    }
    if (!attrIds.has("SELLER_SKU") && listing.product?.sku) {
      attributes.push({ id: "SELLER_SKU", value_name: listing.product.sku });
      attrIds.add("SELLER_SKU");
    }
    
    // Note: PACKAGE_WEIGHT/WIDTH/HEIGHT/LENGTH are NOT modifiable via attributes on ML
    // They must be set via shipping dimensions, not attributes

    // Warranty via attributes (warranty field is deprecated on ML API)
    if (listing.product?.warranty_type && listing.product.warranty_type !== 'none') {
      if (!attrIds.has("WARRANTY_TYPE")) {
        const warrantyTypeValue = listing.product.warranty_type === 'vendor' ? 'Garantia do vendedor' : 'Garantia de fábrica';
        attributes.push({ id: "WARRANTY_TYPE", value_name: warrantyTypeValue });
        attrIds.add("WARRANTY_TYPE");
      }
      if (!attrIds.has("WARRANTY_TIME") && listing.product.warranty_duration) {
        attributes.push({ id: "WARRANTY_TIME", value_name: String(listing.product.warranty_duration).trim() });
        attrIds.add("WARRANTY_TIME");
      }
    }

    // Órgão regulatório (ANVISA) — preenchido abaixo dentro do loop de specs da categoria,
    // só quando o ML expuser um atributo equivalente nessa categoria.
    const _regRegime = String(listing.product?.regulatory_regime || "").toLowerCase();
    const _needsAnvisa = _regRegime.includes("anvisa");

    // ===== Auto-fill required category attributes =====
    // Fetch category attribute specs and complete what's missing using sensible fallbacks.
    const missingRequired: string[] = [];
    try {
      const attrSpecRes = await fetch(`https://api.mercadolibre.com/categories/${listing.category_id}/attributes`, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      if (attrSpecRes.ok) {
        const attrSpecs: any[] = await attrSpecRes.json();
        const brandValue = listing.product?.brand || null;

        for (const spec of attrSpecs) {
          const isRequired = Array.isArray(spec.tags)
            ? spec.tags.includes("required")
            : spec?.tags?.required === true;
          if (!isRequired) continue;
          if (attrIds.has(spec.id)) continue;

          // Try to autofill known attrs with sensible defaults
          let autoValue: string | null = null;
          switch (spec.id) {
            case "BRAND":
              autoValue = brandValue;
              break;
            case "LINE":
              // Linha do produto: prioriza products.line; nunca usa SKU.
              autoValue = listing.product?.line
                || listing.product?.product_type
                || listing.product?.ai_product_type
                || brandValue
                || "Não se aplica";
              break;
            case "MODEL":
              // Fallback: product_type (Shampoo, Balm, Loção...) when no specific model; never SKU
              autoValue = listing.product?.model
                || listing.product?.product_type
                || listing.product?.ai_product_type
                || brandValue
                || "Genérico";
              break;
            case "ITEM_CONDITION":
              autoValue = listing.condition === "used" ? "Usado" : "Novo";
              break;
            case "GTIN":
            case "EAN":
              autoValue = listing.product?.gtin || null;
              break;
            default:
              autoValue = null;
          }

          if (autoValue) {
            attributes.push({ id: spec.id, value_name: String(autoValue) });
            attrIds.add(spec.id);
            console.log(`[meli-publish-listing] Auto-filled required attr ${spec.id} = ${autoValue}`);
          } else {
            missingRequired.push(spec.name || spec.id);
          }
        }

        // Órgão regulatório (ANVISA): preenche se a categoria expuser e o regime do cadastro for ANVISA.
        if (_needsAnvisa) {
          const REG_CANDIDATES = new Set([
            "REGULATORY_AGENCY","SANITARY_REGISTRY_AGENCY","HEALTH_REGISTRATION_INSTITUTION",
            "REGULATORY_BODY","ANVISA_REGISTRY_INSTITUTION",
          ]);
          for (const spec of attrSpecs) {
            if (!REG_CANDIDATES.has(String(spec.id).toUpperCase())) continue;
            if (attrIds.has(spec.id)) continue;
            attributes.push({ id: spec.id, value_name: "ANVISA" });
            attrIds.add(spec.id);
            console.log(`[meli-publish-listing] Auto-filled ANVISA in ${spec.id}`);
          }
        }

        // Números regulatórios (ANVISA / AFE / CONAMA) — match por NOME do atributo
        // (IDs variam por categoria do ML). Fonte: products.regulatory_info.
        const regInfo: any = (listing.product as any)?.regulatory_info || {};
        const anvisaNum = typeof regInfo.anvisa === "string" ? regInfo.anvisa.trim() : "";
        const afeNum = typeof regInfo.afe === "string" ? regInfo.afe.trim() : "";
        const conamaNum = typeof regInfo.conama === "string" ? regInfo.conama.trim() : "";
        const normName = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const spec of attrSpecs) {
          if (attrIds.has(spec.id)) continue;
          const nm = normName(spec.name || "");
          const isAnvisaNumber = nm.includes("anvisa") && (nm.includes("numero") || nm.includes("notifica") || nm.includes("comunica") || nm.includes("registro") || nm.includes("documento"));
          const isAfeNumber = nm.includes("afe") && (nm.includes("certificad") || nm.includes("numero") || nm.includes("autorizac"));
          const isConamaNumber = nm.includes("conama");
          let val: string | null = null;
          if (isAnvisaNumber && anvisaNum) val = anvisaNum;
          else if (isAfeNumber && afeNum) val = afeNum;
          else if (isConamaNumber && conamaNum) val = conamaNum;
          if (val) {
            attributes.push({ id: spec.id, value_name: val });
            attrIds.add(spec.id);
            console.log(`[meli-publish-listing] Auto-filled regulatory number ${spec.id}="${val}"`);
          }
        }

        // ===== Sanitize attributes against fixed-value lists =====
        // Suporta single-value, multi-value e marcador "Não se aplica" (v1.9.0).
        const FREE_FORM_IDS = new Set(["BRAND", "GTIN", "EAN", "MODEL", "SELLER_SKU", "WARRANTY_TIME"]);
        const specById = new Map<string, any>();
        for (const s of attrSpecs) specById.set(s.id, s);
        const norm = (v: any) => String(v ?? "").toLowerCase().trim();
        const isMulti = (s: any) => {
          if (!s) return false;
          const tags = s.tags || {};
          if (tags.multivalued === true) return true;
          const vmq = s.value_max_quantity;
          return typeof vmq === "number" && vmq > 1;
        };
        const isNaName = (n: any) => {
          const x = norm(n).replace(/[^a-z]/g, "");
          return x === "naoseaplica" || x === "noaplica" || x === "na";
        };
        // ML exige value_name = null em "not applicable". Enviamos apenas value_id.
        const naMarker = (spec: any) => {
          if (spec && Array.isArray(spec.values)) {
            const hit = spec.values.find((v: any) => isNaName(v.name));
            if (hit) return { id: spec.id, value_id: hit.id };
          }
          // Fallback universal aceito pelo ML
          return { id: spec?.id, value_id: "-1" };
        };
        // Atributos onde "Não se aplica" não é aceito — usar fallback determinístico.
        const NA_FORBIDDEN_DEFAULTS: Record<string, () => string | null> = {
          UNITS_PER_PACK: () => String(Math.max(1, Number((listing.product as any)?.units_per_package) || 1)),
        };

        const cleaned: any[] = [];
        for (const attr of attributes) {
          const spec = specById.get(attr.id);
          if (!spec) {
            console.log(`[meli-publish-listing] Dropping attr ${attr.id} (no spec in category)`);
            continue;
          }
          const idUp = String(attr.id).toUpperCase();
          // Marcador "Não se aplica" (v1.9.0) — vem do painel
          if ((attr as any).not_applicable === true || isNaName(attr.value_name)) {
            const forced = NA_FORBIDDEN_DEFAULTS[idUp]?.();
            if (forced) {
              // Tenta casar contra a lista oficial; se não houver lista, vai como texto livre.
              if (Array.isArray(spec.values) && spec.values.length > 0) {
                const hit = spec.values.find((v: any) => norm(v.name) === norm(forced));
                cleaned.push(hit ? { id: spec.id, value_id: hit.id, value_name: hit.name } : { id: spec.id, value_name: forced });
              } else {
                cleaned.push({ id: spec.id, value_name: forced });
              }
              continue;
            }
            cleaned.push(naMarker(spec));
            continue;
          }
          // Caso multi: usar attr.values (array) e casar cada um contra a lista.
          if (Array.isArray((attr as any).values) && (attr as any).values.length > 0) {
            const out: any[] = [];
            const allowed = Array.isArray(spec.values) ? spec.values : [];
            for (const v of (attr as any).values) {
              if (allowed.length === 0) { out.push({ name: v.name }); continue; }
              const hit = allowed.find((s2: any) => norm(s2.name) === norm(v.name));
              if (hit) out.push({ id: hit.id, name: hit.name });
            }
            if (out.length > 0) {
              cleaned.push({ id: attr.id, values: out });
            } else {
              cleaned.push(naMarker(spec));
            }
            continue;
          }
          if (Array.isArray(spec.values) && spec.values.length > 0) {
            // Se for multi-valued mas veio só value_name com vírgulas, expandir
            if (isMulti(spec) && typeof attr.value_name === "string" && attr.value_name.includes(",")) {
              const pieces = attr.value_name.split(",").map((s: string) => s.trim()).filter(Boolean);
              const out: any[] = [];
              for (const p of pieces) {
                const hit = spec.values.find((v: any) => norm(v.name) === norm(p));
                if (hit) out.push({ id: hit.id, name: hit.name });
              }
              if (out.length > 0) {
                cleaned.push({ id: attr.id, values: out });
                continue;
              }
            }
            const hit = spec.values.find((v: any) => norm(v.name) === norm(attr.value_name));
            if (hit) {
              cleaned.push({ id: attr.id, value_id: hit.id, value_name: hit.name });
            } else if (FREE_FORM_IDS.has(String(attr.id).toUpperCase())) {
              console.log(`[meli-publish-listing] Keeping free-form attr ${attr.id}="${attr.value_name}"`);
              cleaned.push({ id: attr.id, value_name: attr.value_name });
            } else {
              console.log(`[meli-publish-listing] Replacing invalid attr ${attr.id}="${attr.value_name}" with N/A marker`);
              cleaned.push(naMarker(spec));
            }
          } else {
            cleaned.push(attr);
          }
        }
        attributes.length = 0;
        attributes.push(...cleaned);
      }
    } catch (specErr) {
      console.log(`[meli-publish-listing] Category attribute spec fetch skipped:`, specErr);
    }

    if (missingRequired.length > 0) {
      const errMsg = `Esta categoria do Mercado Livre exige os seguintes campos obrigatórios que não estão no cadastro do produto: ${missingRequired.join(", ")}. Preencha-os no cadastro do produto e tente novamente.`;
      await supabase.from("meli_listings").update({ status: "error", error_message: errMsg }).eq("id", listingId);
      return jsonResponse({ success: false, error: errMsg, code: "missing_required_attributes", missing: missingRequired });
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
      const friendlyMsg = humanizeMeliError(errorMsg, causes);
      console.error(`[meli-publish-listing] ML API error ${publishRes.status}:`, JSON.stringify(responseData).slice(0, 1000));

      await supabase
        .from("meli_listings")
        .update({
          status: "error",
          error_message: friendlyMsg.slice(0, 500),
          meli_response: responseData,
        })
        .eq("id", listingId);

      return jsonResponse({
        success: false,
        error: friendlyMsg,
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
    return errorResponse(error, corsHeaders, { module: 'mercadolivre', action: 'publish-listing' });
  }
});

// ===================== Helper Functions =====================

/**
 * Converte mensagens técnicas do ML em texto amigável em PT-BR para o lojista.
 */
function humanizeMeliError(raw: string, causes: any[]): string {
  const all = [
    raw,
    ...(Array.isArray(causes) ? causes.map((c) => c?.message || c?.code || "").filter(Boolean) : []),
  ].join(" \n ");

  const bullets: string[] = [];
  const seen = new Set<string>();
  const add = (msg: string) => {
    if (msg && !seen.has(msg)) { seen.add(msg); bullets.push(msg); }
  };

  if (/value name must be null in not applicable attribute\s+([A-Z_]+)/i.test(all)) {
    const matches = [...all.matchAll(/value name must be null in not applicable attribute\s+([A-Z_]+)/gi)];
    for (const m of matches) {
      add(`A característica "${prettyAttrName(m[1])}" foi marcada como "Não se aplica" mas o Mercado Livre exige um valor real. Edite a característica no painel ou preencha no cadastro do produto.`);
    }
  }
  if (/UNITS_PER_PACK/i.test(all) && /(Unidade|sale_format|formato de venda)/i.test(all)) {
    add('A característica "Unidades por kit" precisa ser pelo menos 1 quando o "Formato de venda" é "Unidade". Ajuste no painel de características.');
  }
  if (/Número de registro de produto na Anvisa.*incorreto/i.test(all) || /Número de notificação.*Anvisa.*incorreto/i.test(all)) {
    add('O número da ANVISA do produto está em formato inválido para o Mercado Livre. Revise o número no cadastro do produto (aba Fiscal/Regulatório).');
  }
  if (/Número de certificado da AFE.*incorreto/i.test(all)) {
    add('O número do certificado AFE está em formato inválido. Revise no cadastro do produto.');
  }
  if (/missing required attribute|atributo obrigat[oó]rio/i.test(all)) {
    add('Faltam características obrigatórias da categoria. Reabra o anúncio e revise o painel de características.');
  }
  if (/title.*(too long|invalid|exceeds)/i.test(all)) {
    add('O título do anúncio é inválido ou ultrapassa o limite de 60 caracteres.');
  }
  if (/price.*(invalid|missing)/i.test(all)) {
    add('O preço do anúncio é inválido ou está faltando.');
  }

  if (bullets.length === 0) {
    return "Não foi possível publicar o anúncio. Revise o cadastro do produto e as características antes de tentar de novo.";
  }
  return `Não foi possível publicar:\n• ${bullets.join("\n• ")}`;
}

function prettyAttrName(id: string): string {
  const dict: Record<string, string> = {
    FRAGRANCE: "Fragrância",
    HAIR_TREATMENT_PRESENTATION: "Formato de tratamento capilar",
    UNITS_PER_PACK: "Unidades por kit",
    ACTIVE_INGREDIENTS: "Ingredientes ativos",
    BRAND: "Marca",
    MODEL: "Modelo",
    GTIN: "Código de barras",
  };
  return dict[id.toUpperCase()] || id.toLowerCase().replace(/_/g, " ");
}


/**
 * Sanitiza atributos contra os values fixos da categoria do ML.
 * Remove atributos cujo value_name não existe na lista oficial.
 * Quando bate, normaliza para usar o value_id oficial do ML.
 */
async function sanitizeAttributesForCategory(
  accessToken: string,
  categoryId: string,
  attrs: any[],
): Promise<any[]> {
  try {
    const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}/attributes`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return attrs;
    const specs: any[] = await res.json();
    const byId = new Map<string, any>(specs.map((s) => [s.id, s]));
    const norm = (v: any) => String(v ?? "").toLowerCase().trim();
    const FREE_FORM_IDS = new Set(["BRAND", "GTIN", "EAN", "MODEL", "SELLER_SKU"]);
    const cleaned: any[] = [];
    for (const attr of attrs) {
      const spec = byId.get(attr.id);
      if (spec && Array.isArray(spec.values) && spec.values.length > 0) {
        const hit = spec.values.find((v: any) => norm(v.name) === norm(attr.value_name));
        if (hit) {
          cleaned.push({ id: attr.id, value_id: hit.id, value_name: hit.name });
        } else if (FREE_FORM_IDS.has(String(attr.id).toUpperCase())) {
          console.log(`[meli-publish-listing] sanitize: keeping free-form ${attr.id}="${attr.value_name}"`);
          cleaned.push({ id: attr.id, value_name: attr.value_name });
        } else {
          console.log(`[meli-publish-listing] sanitize: dropping ${attr.id}="${attr.value_name}" (not allowed)`);
          continue;
        }
      } else {
        cleaned.push(attr);
      }
    }
    return cleaned;
  } catch (e) {
    console.log("[meli-publish-listing] sanitize skipped:", e);
    return attrs;
  }
}


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
    title: listing.title,
    price: Number(listing.price),
    available_quantity: listing.available_quantity,
  };

  // Update images if available
  const images = buildImagesList(listing.images, productImages);
  if (images.length > 0) {
    updatePayload.pictures = images;
  }

  // Update attributes (MODEL, BRAND, etc.) if saved on the listing — sanitize against ML category specs
  if (Array.isArray(listing.attributes) && listing.attributes.length > 0 && listing.category_id) {
    const sanitized = await sanitizeAttributesForCategory(accessToken, listing.category_id, listing.attributes);
    if (sanitized.length > 0) {
      updatePayload.attributes = sanitized;
    }
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

async function deleteListingOnMeli(accessToken: string, listing: any, supabase: any) {
  if (!listing.meli_item_id) {
    const { error: delErr } = await supabase.from("meli_listings").delete().eq("id", listing.id);
    if (delErr) return jsonResponse({ success: false, error: "Falha ao remover anúncio local" });
    return jsonResponse({ success: true, message: "Anúncio removido" });
  }

  let mlClosed = false;
  let mlDeletedIncomplete = false;
  let mlSkippedReason: string | null = null;

  try {
    if (listing.status === "published") {
      await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
    }

    const closeRes = await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    const closeData = await closeRes.json().catch(() => ({}));

    if (closeRes.ok) {
      mlClosed = true;
    } else {
      const msg = String(closeData?.message || "").toLowerCase();
      const isUnapproved =
        msg.includes("aprovado") ||
        msg.includes("approved") ||
        msg.includes("must be active") ||
        msg.includes("under_review") ||
        msg.includes("under review") ||
        msg.includes("inactive");

      if (isUnapproved) {
        // Tenta excluir o item incompleto/em revisão para sumir do painel do ML também.
        try {
          const delRes = await fetch(`https://api.mercadolibre.com/items/${listing.meli_item_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          });
          if (delRes.ok || delRes.status === 204) {
            mlDeletedIncomplete = true;
          } else {
            const delData = await delRes.json().catch(() => ({}));
            console.log(`[meli-publish-listing] DELETE incomplete failed: ${delRes.status}`, delData);
            mlSkippedReason = "Removido aqui, mas o anúncio pode continuar como incompleto no painel do Mercado Livre. Se necessário, exclua manualmente lá.";
          }
        } catch (delErr) {
          console.log(`[meli-publish-listing] DELETE incomplete threw:`, delErr);
          mlSkippedReason = "Removido aqui, mas o anúncio pode continuar como incompleto no painel do Mercado Livre. Se necessário, exclua manualmente lá.";
        }
      } else {
        return jsonResponse({
          success: false,
          error: closeData?.message || "Erro ao encerrar anúncio no Mercado Livre",
          details: closeData,
        });
      }
    }
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || "Erro de rede ao encerrar no ML" });
  }

  const { error: delErr } = await supabase.from("meli_listings").delete().eq("id", listing.id);
  if (delErr) {
    return jsonResponse({
      success: false,
      error: (mlClosed || mlDeletedIncomplete)
        ? "Anúncio removido no ML, mas falhou remover localmente"
        : "Falha ao remover anúncio local",
    });
  }

  const finalMsg = mlClosed
    ? "Anúncio encerrado no Mercado Livre e removido"
    : mlDeletedIncomplete
    ? "Anúncio incompleto excluído do Mercado Livre e removido"
    : mlSkippedReason || "Anúncio removido";

  return jsonResponse({
    success: true,
    message: finalMsg,
    ml_closed: mlClosed,
    ml_deleted_incomplete: mlDeletedIncomplete,
    ml_skipped_reason: mlSkippedReason,
  });
}