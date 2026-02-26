import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "v1.8.0"; // Use category max_title_length for title generation

const DEFAULT_MAX_TITLE_LENGTH = 120;

// Fetch the real max_title_length from ML category API
async function getCategoryMaxTitleLength(categoryId: string | null): Promise<number> {
  if (!categoryId) return DEFAULT_MAX_TITLE_LENGTH;
  try {
    const res = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`);
    if (res.ok) {
      const data = await res.json();
      const maxLen = data.settings?.max_title_length;
      if (maxLen && typeof maxLen === 'number' && maxLen > 0) {
        console.log(`[meli-bulk] Category ${categoryId} max_title_length: ${maxLen}`);
        return maxLen;
      }
    }
  } catch (err) {
    console.warn(`[meli-bulk] Failed to fetch category ${categoryId} max_title_length:`, err);
  }
  return DEFAULT_MAX_TITLE_LENGTH;
}

// ---- Smart category selection helpers ----

// Known category domain keywords mapped to product type signals
const CATEGORY_DOMAIN_HINTS: Record<string, string[]> = {
  "beleza": ["balm", "sérum", "shampoo", "condicionador", "creme", "pomada", "gel", "óleo", "hidratante", "máscara capilar", "loção", "protetor", "desodorante", "perfume", "colônia", "barba", "cabelo", "capilar", "skincare", "maquiagem", "esmalte", "batom"],
  "saúde": ["suplemento", "vitamina", "colágeno", "proteína", "whey", "creatina", "termogênico"],
  "pet shop": ["ração", "petisco", "coleira", "brinquedo pet", "cama pet", "antipulga"],
  "casa": ["decoração", "almofada", "cortina", "tapete", "luminária", "vaso", "organizador"],
  "jardim": ["semente", "fertilizante", "vaso planta", "irrigação", "poda", "jardinagem"],
  "eletrônicos": ["celular", "smartphone", "fone", "carregador", "cabo usb", "adaptador", "notebook"],
  "esportes": ["tênis", "meia esportiva", "luva academia", "haltere", "corda", "bola"],
  "moda": ["camiseta", "calça", "bermuda", "vestido", "jaqueta", "saia", "blusa", "camisa"],
};

/**
 * Pick the best category from multiple domain_discovery results.
 * Uses brand context and product type to avoid absurd categorizations
 * like a grooming product ending up in "Jardim/Hidroponia".
 */
function pickBestCategory(
  results: Array<{ category_id: string; category_name?: string; domain_name?: string; domain_id?: string }>,
  productName: string,
  brand?: string,
  fullCategoryPaths?: Map<string, string>
): { category_id: string; category_name?: string; domain_name?: string } | null {
  if (!results.length) return null;
  if (results.length === 1) return results[0];

  const nameLower = productName.toLowerCase();
  const brandLower = (brand || "").toLowerCase();

  // Score each result
  const scored = results.map((r) => {
    let score = 0;
    const domainLower = (r.domain_name || r.domain_id || "").toLowerCase();
    const catNameLower = (r.category_name || "").toLowerCase();
    const fullPath = (fullCategoryPaths?.get(r.category_id) || "").toLowerCase();

    // Check if the domain/category aligns with product type
    for (const [domainHint, keywords] of Object.entries(CATEGORY_DOMAIN_HINTS)) {
      const productMatchesHint = keywords.some((kw) => nameLower.includes(kw));
      const categoryMatchesHint = domainLower.includes(domainHint) || catNameLower.includes(domainHint) || fullPath.includes(domainHint);

      if (productMatchesHint && categoryMatchesHint) {
        score += 10; // Strong match
      } else if (!productMatchesHint && categoryMatchesHint) {
        score -= 3;
      }
    }

    // Boost categories in human personal care path
    if (fullPath.includes("beleza") || fullPath.includes("cuidado pessoal") || fullPath.includes("barbearia") || fullPath.includes("cuidados com o cabelo")) {
      score += 5;
    }

    // Penalize pet shop, garden, etc. for non-pet/garden products
    const absurdDomains = ["hidroponia", "nutrientes para", "pet shop", "gatos", "cães", "aquário", "piscina", "ferramentas", "jardinagem"];
    for (const absurd of absurdDomains) {
      if ((domainLower.includes(absurd) || catNameLower.includes(absurd) || fullPath.includes(absurd)) && !nameLower.includes(absurd)) {
        score -= 10;
      }
    }

    return { ...r, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  console.log(`[meli-categories] Scored results:`, scored.map(s => `${s.category_name || s.domain_name}(${s.category_id}): score=${s.score}`).join(", "));

  // If best score is very negative, all results are bad
  if (scored[0].score <= -5) {
    console.log(`[meli-categories] All results scored poorly (best=${scored[0].score}), returning null for fallback`);
    return null;
  }

  return scored[0];
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;

  const sliced = value.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const bounded = lastSpace > 15 ? sliced.slice(0, lastSpace) : sliced;
  return bounded.replace(/[\s\-_,;:.]+$/g, "").trim();
}

function sanitizeGeneratedTitle(rawTitle: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH): string {
  const firstLine = rawTitle.split("\n")[0] || "";
  const noDecorators = firstLine.replace(/^['"*`\-\s]+|['"*`\-\s]+$/g, "");
  const normalized = normalizeWhitespace(noDecorators);
  return truncateAtWordBoundary(normalized, maxLength);
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDynamicMinTitleLength(productName: string): number {
  const baseLength = normalizeWhitespace(productName || "").length;
  return Math.max(24, Math.min(48, Math.floor(baseLength * 0.6)));
}

function hasSufficientProductCoverage(title: string, productName: string): boolean {
  const normalizedTitle = normalizeForComparison(title);
  const normalizedProduct = normalizeForComparison(productName);

  const stopwords = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "por", "a", "o", "em", "kit"]);
  const productKeywords = Array.from(new Set(
    normalizedProduct
      .split(" ")
      .filter((word) => word.length >= 4 && !stopwords.has(word))
  ));

  if (productKeywords.length === 0) return true;

  const requiredMatches = Math.min(2, productKeywords.length);
  const matches = productKeywords.filter((keyword) => normalizedTitle.includes(keyword)).length;

  return matches >= requiredMatches;
}

function isLikelyTruncatedEnding(title: string, productName?: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;

  if (/[\-_,/:;]$/.test(trimmed)) return true;
  if (/-[A-Za-zÀ-ÿ]{1,4}$/.test(trimmed)) return true;

  const lastWord = trimmed.split(/\s+/).pop() || "";
  const normalizedLastWord = normalizeForComparison(lastWord);
  const allowedShortWords = new Set(["ml", "kg", "g", "l", "cm", "mm", "dia", "kit", "gel", "wax"]);

  if (/\d/.test(normalizedLastWord)) return false;
  if (allowedShortWords.has(normalizedLastWord)) return false;

  // Check if last word is a prefix of a longer word in the product name/brand context
  if (productName && normalizedLastWord.length >= 3) {
    const contextWords = normalizeForComparison(productName).split(" ").filter(w => w.length > normalizedLastWord.length);
    for (const contextWord of contextWords) {
      if (contextWord.startsWith(normalizedLastWord) && contextWord !== normalizedLastWord) {
        return true; // e.g. "Respe" is prefix of "Respeite" → truncated
      }
    }
  }

  return normalizedLastWord.length > 0 && normalizedLastWord.length <= 3;
}

function isValidGeneratedTitle(title: string, productName: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH): boolean {
  if (!title) return false;
  if (title.length > maxLength) return false;
  if (title.split(/\s+/).length < 3) return false;

  const minLength = getDynamicMinTitleLength(productName);
  if (title.length < minLength) return false;

  if (isLikelyTruncatedEnding(title, productName)) return false;
  if (!hasSufficientProductCoverage(title, productName)) return false;

  const lastWord = title.split(/\s+/).pop()?.toLowerCase() || "";
  const danglingWords = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "por", "a", "o", "em"]);
  return !danglingWords.has(lastWord);
}

function extractBenefitKeyword(context: string): string {
  const lower = context.toLowerCase();
  if (lower.includes("anti-queda") || lower.includes("antiqueda")) return "Anti-queda";
  if (lower.includes("hidrat")) return "Hidratante";
  if (lower.includes("fortalec")) return "Fortalecedor";
  if (lower.includes("cresciment")) return "Crescimento Capilar";
  if (lower.includes("limpeza")) return "Limpeza Profunda";
  if (lower.includes("vitamina c")) return "Vitamina C";
  return "Uso Diário";
}

function buildFallbackTitle(productName: string, context: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH): string {
  const base = sanitizeGeneratedTitle(productName || "Produto", maxLength);
  if (isValidGeneratedTitle(base, productName || "Produto", maxLength)) return base;

  const benefit = extractBenefitKeyword(context);
  const withBenefit = sanitizeGeneratedTitle(`${base} ${benefit}`, maxLength);
  if (isValidGeneratedTitle(withBenefit, productName || "Produto", maxLength)) return withBenefit;

  const finalFallback = sanitizeGeneratedTitle(`${base} Produto Original`, maxLength);
  return finalFallback || "Produto Original";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[meli-bulk-operations][${VERSION}] Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { tenantId, action, productIds, listingIds, offset = 0, limit = 10 } = body;
    // Support both listingIds (from Creator) and productIds (legacy) for filtering
    const filterIds = listingIds || productIds;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify tenant access
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso a este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ML connection for category prediction (with auto-refresh if expired)
    const { data: mlConnection } = await supabase
      .from("marketplace_connections")
      .select("id, access_token, refresh_token, expires_at")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .maybeSingle();

    const mlHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (mlConnection?.access_token) {
      let accessToken = mlConnection.access_token;
      
      // Auto-refresh if token is expired
      if (mlConnection.expires_at && new Date(mlConnection.expires_at) < new Date()) {
        console.log(`[meli-bulk-operations] Token expired, attempting auto-refresh...`);
        try {
          const refreshRes = await fetch(`${supabaseUrl}/functions/v1/meli-token-refresh`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ connectionId: mlConnection.id }),
          });
          
          if (refreshRes.ok) {
            const { data: refreshedConn } = await supabase
              .from("marketplace_connections")
              .select("access_token")
              .eq("id", mlConnection.id)
              .single();
            
            if (refreshedConn?.access_token) {
              accessToken = refreshedConn.access_token;
              console.log(`[meli-bulk-operations] Token refreshed successfully`);
            }
          } else {
            console.log(`[meli-bulk-operations] Token refresh failed: ${refreshRes.status}`);
          }
        } catch (refreshErr) {
          console.error(`[meli-bulk-operations] Token refresh error:`, refreshErr);
        }
      }
      
      mlHeaders["Authorization"] = `Bearer ${accessToken}`;
    }

    // AI router handles key resolution automatically

    // ============ ACTION: bulk_create ============
    if (action === "bulk_create") {
      // Get all active products that don't have listings yet
      let query = supabase
        .from("products")
        .select("id, name, description, price, stock_quantity, sku, brand, gtin, barcode, weight, width, height, depth")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      if (filterIds?.length) {
        query = query.in("id", filterIds);
      }

      const { data: products, error: prodErr } = await query.range(offset, offset + limit - 1);
      if (prodErr) throw prodErr;

      // Get existing listings to exclude
      const existingIds = new Set<string>();
      const { data: existing } = await supabase
        .from("meli_listings")
        .select("product_id")
        .eq("tenant_id", tenantId);
      (existing || []).forEach(e => existingIds.add(e.product_id));

      const toCreate = (products || []).filter(p => !existingIds.has(p.id));

      // Get primary images
      const pIds = toCreate.map(p => p.id);
      let imageMap = new Map<string, string>();
      if (pIds.length > 0) {
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, url")
          .in("product_id", pIds)
          .eq("is_primary", true);
        (images || []).forEach(img => imageMap.set(img.product_id, img.url));
      }

      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const product of toCreate) {
        try {
          // Auto-predict category
          let categoryId = "";
          let categoryName = "";
          try {
            const discoveryRes = await fetch(
              `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(product.name)}`,
              { headers: mlHeaders }
            );
            if (discoveryRes.ok) {
              const discoveryData = await discoveryRes.json();
              if (Array.isArray(discoveryData) && discoveryData[0]?.category_id) {
                categoryId = discoveryData[0].category_id;
                categoryName = discoveryData[0].category_name || discoveryData[0].domain_name || categoryId;
              }
            } else {
              await discoveryRes.text();
            }
          } catch { /* skip category prediction */ }

          const attrs: any[] = [];
          if (product.brand) attrs.push({ id: "BRAND", value_name: product.brand });
          if (product.gtin || product.barcode) attrs.push({ id: "GTIN", value_name: product.gtin || product.barcode });

          const imgUrl = imageMap.get(product.id);

          const { error: insertErr } = await supabase
            .from("meli_listings")
            .insert({
              tenant_id: tenantId,
              product_id: product.id,
              title: sanitizeGeneratedTitle(product.name || ""),
              description: "",
              price: product.price,
              available_quantity: product.stock_quantity || 1,
              listing_type: "gold_special",
              condition: "new",
              category_id: categoryId || null,
              currency_id: "BRL",
              images: imgUrl ? [{ url: imgUrl }] : [],
              attributes: attrs,
              shipping: { mode: "me2", local_pick_up: false, free_shipping: false },
              status: "draft",
            });

          if (insertErr) {
            if (insertErr.message?.includes("idx_meli_listings_tenant_product")) {
              skipped++;
            } else {
              errors.push(`${product.name}: ${insertErr.message}`);
            }
          } else {
            created++;
          }
        } catch (err) {
          errors.push(`${product.name}: ${err instanceof Error ? err.message : "Erro"}`);
        }
      }

      // Count remaining
      let totalQuery = supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "active");
      const { count: totalProducts } = await totalQuery;

      return new Response(
        JSON.stringify({
          success: true,
          created,
          skipped,
          errors,
          processed: toCreate.length,
          totalProducts: totalProducts || 0,
          hasMore: (products || []).length === limit,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ACTION: bulk_generate_titles ============
    if (action === "bulk_generate_titles") {
      resetAIRouterCache();

      let query = supabase
        .from("meli_listings")
        .select("id, title, product_id, category_id, description, products(name, description, brand, short_description, sku, weight, width, height, depth, gtin, barcode)")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "ready", "approved", "error"]);

      if (filterIds?.length) {
        query = query.in("id", filterIds);
      }

      const { data: listings, error: listErr } = await query.range(offset, offset + limit - 1);
      if (listErr) throw listErr;

      let updated = 0;
      const errors: string[] = [];

      // Cache category max_title_length to avoid repeated API calls
      const categoryLimitCache = new Map<string, number>();

      for (const listing of (listings || [])) {
        try {
          const product = (listing as any).products;
          const productName = product?.name || listing.title;
          const categoryId = (listing as any).category_id;

          // Get category-specific max title length
          let maxTitleLen = DEFAULT_MAX_TITLE_LENGTH;
          if (categoryId) {
            if (categoryLimitCache.has(categoryId)) {
              maxTitleLen = categoryLimitCache.get(categoryId)!;
            } else {
              maxTitleLen = await getCategoryMaxTitleLength(categoryId);
              categoryLimitCache.set(categoryId, maxTitleLen);
            }
          }
          console.log(`[meli-bulk-titles] Using max_title_length=${maxTitleLen} for category=${categoryId || "none"}`);

          // Strip HTML for cleaner context
          const cleanDesc = (product?.description || product?.short_description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
          const shortDesc = (product?.short_description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
          const contextParts = [`Nome do produto: ${productName}`];
          if (product?.brand) contextParts.push(`Marca: ${product.brand}`);
          if (product?.sku) contextParts.push(`SKU: ${product.sku}`);
          if (product?.weight) contextParts.push(`Peso: ${product.weight}g`);
          if (shortDesc) contextParts.push(`Resumo/Benefícios: ${shortDesc}`);
          if (cleanDesc) contextParts.push(`Descrição completa do produto: ${cleanDesc}`);
          const context = contextParts.join("\n");
          console.log(`[meli-bulk-titles] Context for "${productName}": ${context.slice(0, 200)}...`);

          // Title generation with retry logic
          const MAX_TITLE_ATTEMPTS = 3;
          let finalTitle = "";
          let lastRawTitle = "";



          for (let attempt = 1; attempt <= MAX_TITLE_ATTEMPTS; attempt++) {
            const minLength = getDynamicMinTitleLength(productName || listing.title || "Produto");
            const hardMinLength = Math.max(minLength, maxTitleLen <= 60 ? 20 : 35); // Adjust min for short-limit categories
            const feedbackSection = attempt > 1
              ? `\n\nTENTATIVA ANTERIOR REJEITADA: "${lastRawTitle || "(vazio)"}"\nMotivo: título muito curto ou com palavra final cortada.\nGere uma versão MAIS LONGA e COMPLETA, com pelo menos ${hardMinLength} caracteres, incluindo benefícios do produto e palavras-chave de busca.`
              : "";

            const userMessage = `Gere UM título otimizado para o Mercado Livre com base nestes dados do produto:

${context}

IMPORTANTE:
- O título DEVE ter entre ${hardMinLength} e ${maxTitleLen} caracteres (LIMITE MÁXIMO DA CATEGORIA: ${maxTitleLen})
- Inclua: tipo do produto + marca + principal benefício/função + característica diferenciadora
- NÃO abrevie palavras e NÃO corte o título no meio de uma palavra
${maxTitleLen <= 60 ? '- ATENÇÃO: Esta categoria tem limite CURTO de ' + maxTitleLen + ' caracteres. Seja conciso mas informativo.\n- Priorize: tipo + marca + benefício principal. Omita detalhes secundários.' : '- Exemplo de bom título para este tipo de produto: "Balm Pós-Banho Respeite o Homem Calvície Zero Tratamento Diário"'}

Retorne APENAS o título completo, sem aspas e sem explicações.${feedbackSection}`;

            const aiRes = await aiChatCompletion(
              "google/gemini-2.5-pro",
              {
                messages: [
                  {
                    role: "system",
                    content: `Você é um copywriter especialista em títulos de anúncios para o Mercado Livre Brasil. Seu objetivo é criar títulos que VENDEM e são encontrados nas buscas.

FORMATO DO TÍTULO:
[Tipo do Produto] [Marca] [Função/Benefício Principal] [Detalhe Diferenciador] [Peso/Quantidade se aplicável]

REGRAS:
1. Comece SEMPRE pelo tipo de produto (Balm, Kit, Sérum, Camiseta, etc.)
2. Inclua a marca completa (nunca abrevie)
3. Adicione o principal benefício (Antiqueda, Hidratante, Anti-calvície, etc.)
4. TODAS as palavras devem estar COMPLETAS — jamais truncar
5. O título deve ter NO MÁXIMO ${maxTitleLen} caracteres (limite da categoria)
6. Sem emojis, sem CAPS LOCK, sem preço, sem código de barras
7. Sem repetir palavras
8. Se for kit, mencione a quantidade e o que está incluso

Retorne APENAS o título, nada mais.`,
                  },
                  { role: "user", content: userMessage },
                ],
                max_tokens: 256,
                temperature: attempt === 1 ? 0.35 : attempt === 2 ? 0.5 : 0.65,
              },
              {
                supabaseUrl,
                supabaseServiceKey,
                preferProvider: 'openai',
                logPrefix: "[meli-bulk-titles]",
              }
            );

            if (!aiRes.ok) {
              const errText = await aiRes.text();
              console.log(`[meli-bulk-titles] AI error on attempt ${attempt}: ${aiRes.status}`);
              if (attempt === MAX_TITLE_ATTEMPTS) {
                errors.push(`${listing.title}: AI error ${aiRes.status}`);
              }
              continue;
            }

            const aiData = await aiRes.json();
            const rawTitle = aiData.choices?.[0]?.message?.content?.trim() || "";
            const finishReason = aiData.choices?.[0]?.finish_reason || "unknown";
            console.log(`[meli-bulk-titles] Raw AI response: finish_reason=${finishReason}, content="${rawTitle.slice(0, 150)}", model=${aiData.model || "?"}`);
            lastRawTitle = rawTitle;
            const title = sanitizeGeneratedTitle(rawTitle, maxTitleLen);

            // Validate title quality with category-specific max length
            const isGoodTitle = isValidGeneratedTitle(title, productName || listing.title || "Produto", maxTitleLen);

            console.log(`[meli-bulk-titles] Attempt ${attempt}/${MAX_TITLE_ATTEMPTS} for "${productName}" → "${title}" (${title.length}/${maxTitleLen} chars, good=${isGoodTitle})`);

            if (isGoodTitle) {
              finalTitle = title;
              break;
            }

            if (attempt === MAX_TITLE_ATTEMPTS) {
              // Do NOT persist invalid title — use robust fallback instead
              console.log(`[meli-bulk-titles] All ${MAX_TITLE_ATTEMPTS} attempts failed validation for "${productName}", using fallback`);
            }
          }

          // Final fallback: use buildFallbackTitle if all attempts failed
          if (!finalTitle || !isValidGeneratedTitle(finalTitle, productName || listing.title || "Produto", maxTitleLen)) {
            const context = contextParts.join("\n");
            finalTitle = buildFallbackTitle(productName || listing.title || "Produto Original", context, maxTitleLen);
            console.log(`[meli-bulk-titles] Fallback title for "${productName}": "${finalTitle}" (last raw: "${lastRawTitle}")`);
          }
          
          await supabase
            .from("meli_listings")
            .update({ title: finalTitle })
            .eq("id", listing.id);
          updated++;
        } catch (err) {
          errors.push(`${listing.title}: ${err instanceof Error ? err.message : "Erro"}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated,
          errors,
          processed: (listings || []).length,
          hasMore: (listings || []).length === limit,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ACTION: bulk_generate_descriptions ============
    if (action === "bulk_generate_descriptions") {
      resetAIRouterCache();

      let query = supabase
        .from("meli_listings")
        .select("id, title, description, product_id, products(name, description, short_description, brand, sku, weight, width, height, depth, gtin, barcode)")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "ready", "approved", "error"]);

      if (filterIds?.length) {
        query = query.in("id", filterIds);
      }

      const { data: listings, error: listErr } = await query.range(offset, offset + limit - 1);
      if (listErr) throw listErr;

      let updated = 0;
      const errors: string[] = [];

      for (const listing of (listings || [])) {
        try {
          const product = (listing as any).products;
          const htmlSource = product?.description || listing.description || "";
          const shortDescLocal = product?.short_description || "";

          if (!htmlSource?.trim() && !shortDescLocal?.trim()) {
            errors.push(`${listing.title}: Sem descrição fonte`);
            continue;
          }

          // Build rich context for AI — WITHOUT barcode/EAN/GTIN
          const productContext: string[] = [];
          if (product?.name) productContext.push(`Produto: ${product.name}`);
          if (product?.brand) productContext.push(`Marca: ${product.brand}`);
          if (product?.sku) productContext.push(`SKU: ${product.sku}`);
          if (product?.weight) productContext.push(`Peso: ${product.weight}g`);
          if (product?.width && product?.height && product?.depth) {
            productContext.push(`Dimensões: ${product.width} x ${product.height} x ${product.depth} cm`);
          }
          // NOTE: EAN/GTIN/barcode NOT included — goes as ML attribute, not in description text

          const fullSource = productContext.length > 0
            ? `${productContext.join("\n")}\n\nDescrição original:\n${htmlSource || shortDescLocal}`
            : htmlSource || shortDescLocal;

          const aiRes = await aiChatCompletion(
            "google/gemini-2.5-flash",
            {
              messages: [
                {
                  role: "system",
                  content: `Converta para texto plano compatível com o Mercado Livre.
REGRAS: Apenas texto plano, sem HTML/Markdown. PROIBIDO: telefones, WhatsApp, e-mails, links, URLs, emojis, códigos de barras, EAN, GTIN.
Use \\n para organizar. MAIÚSCULAS para títulos de seção.
Preserve informações técnicas, ANVISA, composições. Máx 5000 chars.
Inclua especificações técnicas do produto (peso, dimensões) se disponíveis.
NÃO inclua código de barras, EAN ou GTIN na descrição — esses dados vão como atributos separados do anúncio.
Retorne APENAS o texto da descrição.`,
                },
                {
                  role: "user",
                  content: fullSource,
                },
              ],
              max_tokens: 4096,
              temperature: 0.3,
            },
            {
              supabaseUrl,
              supabaseServiceKey,
              logPrefix: "[meli-bulk-descriptions]",
            }
          );

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            errors.push(`${listing.title}: AI error ${aiRes.status}`);
            continue;
          }

          const aiData = await aiRes.json();
          const description = aiData.choices?.[0]?.message?.content?.trim() || "";

          if (description) {
            await supabase
              .from("meli_listings")
              .update({ description })
              .eq("id", listing.id);
            updated++;
          }
        } catch (err) {
          errors.push(`${listing.title}: ${err instanceof Error ? err.message : "Erro"}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated,
          errors,
          processed: (listings || []).length,
          hasMore: (listings || []).length === limit,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ACTION: bulk_auto_categories ============
    if (action === "bulk_auto_categories") {
      let query = supabase
        .from("meli_listings")
        .select("id, title, category_id, product_id, products(name, description, short_description, brand)")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "ready", "approved", "error"]);

      if (filterIds?.length) {
        query = query.in("id", filterIds);
      }

      const { data: listings, error: listErr } = await query.range(offset, offset + limit - 1);
      if (listErr) throw listErr;

      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];
      const resolvedCategories: Array<{ listingId: string; categoryId: string; categoryName: string; categoryPath: string }> = [];

      for (const listing of (listings || [])) {
        try {
          // Skip if already has category
          if (listing.category_id) {
            // Still resolve name/path for frontend display
            let catName = "";
            let catPath = "";
            try {
              const catRes = await fetch(`https://api.mercadolibre.com/categories/${listing.category_id}`, { headers: mlHeaders });
              if (catRes.ok) {
                const catData = await catRes.json();
                catName = catData.name || listing.category_id;
                catPath = (catData.path_from_root || []).map((p: any) => p.name).join(" > ");
              }
            } catch { /* skip */ }
            resolvedCategories.push({
              listingId: listing.id,
              categoryId: listing.category_id,
              categoryName: catName || listing.category_id,
              categoryPath: catPath,
            });
            skipped++;
            continue;
          }

          const product = (listing as any).products;
          const productName = product?.name || listing.title;
          // Build smarter search term: extract key product function/type from description
          const shortDesc = (product?.short_description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          const fullDesc = (product?.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          // Use product name + key terms from short description for better categorization
          const descKeywords = shortDesc.slice(0, 150) || fullDesc.slice(0, 150);
          const searchTerm = descKeywords 
            ? `${productName} ${descKeywords}`.slice(0, 200)
            : productName;

          const brandName = product?.brand || "";
          console.log(`[meli-categories] Product: "${productName}", Brand: "${brandName}", SearchTerm: "${searchTerm.slice(0, 80)}..."`);

          let categoryFound = false;

          const discoveryRes = await fetch(
            `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=5&q=${encodeURIComponent(searchTerm)}`,
            { headers: mlHeaders }
          );

          if (discoveryRes.ok) {
            const discoveryData = await discoveryRes.json();
            if (Array.isArray(discoveryData) && discoveryData.length > 0) {
              // Resolve full paths for better scoring
              const pathMap = new Map<string, string>();
              for (const d of discoveryData) {
                try {
                  const catRes = await fetch(`https://api.mercadolibre.com/categories/${d.category_id}`, { headers: mlHeaders });
                  if (catRes.ok) {
                    const catData = await catRes.json();
                    pathMap.set(d.category_id, (catData.path_from_root || []).map((p: any) => p.name).join(" > "));
                  }
                } catch { /* skip */ }
              }

              const bestMatch = pickBestCategory(discoveryData, productName, brandName, pathMap);
              if (bestMatch) {
                const categoryId = bestMatch.category_id;
                await supabase.from("meli_listings").update({ category_id: categoryId }).eq("id", listing.id);
                const catPath = pathMap.get(categoryId) || "";
                const catName = catPath ? catPath.split(" > ").pop()! : (bestMatch.category_name || bestMatch.domain_name || categoryId);
                resolvedCategories.push({ listingId: listing.id, categoryId, categoryName: catName, categoryPath: catPath });
                updated++;
                categoryFound = true;
              }
            }
          } else {
            await discoveryRes.text();
          }

          // Fallback: simpler search with product name + brand only
          if (!categoryFound && brandName) {
            const fallbackTerm = `${productName} ${brandName}`.slice(0, 120);
            console.log(`[meli-categories] Fallback search: "${fallbackTerm}"`);
            try {
              const fbRes = await fetch(
                `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=5&q=${encodeURIComponent(fallbackTerm)}`,
                { headers: mlHeaders }
              );
              if (fbRes.ok) {
                const fbData = await fbRes.json();
                if (Array.isArray(fbData) && fbData.length > 0) {
                  const fbPathMap = new Map<string, string>();
                  for (const d of fbData) {
                    try {
                      const catRes = await fetch(`https://api.mercadolibre.com/categories/${d.category_id}`, { headers: mlHeaders });
                      if (catRes.ok) {
                        const catData = await catRes.json();
                        fbPathMap.set(d.category_id, (catData.path_from_root || []).map((p: any) => p.name).join(" > "));
                      }
                    } catch { /* skip */ }
                  }
                  const bestFb = pickBestCategory(fbData, productName, brandName, fbPathMap);
                  if (bestFb) {
                    const categoryId = bestFb.category_id;
                    await supabase.from("meli_listings").update({ category_id: categoryId }).eq("id", listing.id);
                    const catPath = fbPathMap.get(categoryId) || "";
                    const catName = catPath ? catPath.split(" > ").pop()! : (bestFb.category_name || bestFb.domain_name || categoryId);
                    resolvedCategories.push({ listingId: listing.id, categoryId, categoryName: catName, categoryPath: catPath });
                    updated++;
                    categoryFound = true;
                  }
                }
              }
            } catch { /* skip fallback */ }
          }

          if (!categoryFound) {
            skipped++;
          }
        } catch (err) {
          errors.push(`${listing.title}: ${err instanceof Error ? err.message : "Erro"}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated,
          skipped,
          errors,
          processed: (listings || []).length,
          hasMore: (listings || []).length === limit,
          resolvedCategories,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ACTION: auto_suggest_category (single product) ============
    if (action === "auto_suggest_category") {
      const { productName, productDescription } = body;
      if (!productName) {
        return new Response(
          JSON.stringify({ success: false, error: "productName obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let categoryId = "";
      let categoryName = "";
      let pathStr = "";

      // Build smarter search term using description context
      const descKeywords = (productDescription || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);
      const searchTerm = descKeywords ? `${productName} ${descKeywords}`.slice(0, 200) : productName;

      // Strategy 1: domain_discovery/search with enriched search term
      try {
        const discoveryUrl = `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=5&q=${encodeURIComponent(searchTerm)}`;
        console.log(`[auto_suggest] Trying domain_discovery: ${discoveryUrl}`);
        const discoveryRes = await fetch(discoveryUrl, { headers: mlHeaders });
        console.log(`[auto_suggest] Discovery status: ${discoveryRes.status}`);
        
        if (discoveryRes.ok) {
          const discoveryData = await discoveryRes.json();
          console.log(`[auto_suggest] Discovery result:`, JSON.stringify(discoveryData).slice(0, 500));
          if (Array.isArray(discoveryData) && discoveryData.length > 0) {
            const bestMatch = pickBestCategory(discoveryData, productName);
            if (bestMatch) {
              categoryId = bestMatch.category_id;
              categoryName = bestMatch.category_name || bestMatch.domain_name || categoryId;
            }
          }
        } else {
          const errBody = await discoveryRes.text();
          console.log(`[auto_suggest] Discovery error body: ${errBody.slice(0, 200)}`);
        }
      } catch (e) {
        console.log(`[auto_suggest] Discovery exception: ${e}`);
      }

      // Strategy 2: Fallback via search API
      if (!categoryId) {
        try {
          const searchUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(productName)}&limit=5`;
          console.log(`[auto_suggest] Trying search fallback: ${searchUrl}`);
          const searchRes = await fetch(searchUrl, { headers: mlHeaders });
          
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            
            // Get category from filters
            const catFilter = (searchData.available_filters || []).find((f: any) => f.id === "category")
              || (searchData.filters || []).find((f: any) => f.id === "category");
            
            if (catFilter?.values?.length > 0) {
              // Pick the top category by results count
              const topCat = catFilter.values.sort((a: any, b: any) => (b.results || 0) - (a.results || 0))[0];
              categoryId = topCat.id;
              categoryName = topCat.name;
              console.log(`[auto_suggest] Search fallback found: ${categoryId} - ${categoryName}`);
            } else if (searchData.results?.length > 0) {
              // Use first result's category
              categoryId = searchData.results[0].category_id;
              console.log(`[auto_suggest] Using first result category: ${categoryId}`);
            }
          }
        } catch (e) {
          console.log(`[auto_suggest] Search fallback exception: ${e}`);
        }
      }

      if (!categoryId) {
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível identificar a categoria. Tente buscar manualmente." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get full category path
      try {
        const catRes = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`, { headers: mlHeaders });
        if (catRes.ok) {
          const catData = await catRes.json();
          categoryName = catData.name || categoryName;
          pathStr = (catData.path_from_root || []).map((p: any) => p.name).join(" > ");
        }
      } catch { /* skip path resolution */ }

      return new Response(
        JSON.stringify({
          success: true,
          categoryId,
          categoryName,
          path: pathStr,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[meli-bulk-operations] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
