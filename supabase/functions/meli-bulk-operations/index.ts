import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const VERSION = "v1.2.0"; // bulk_auto_categories returns resolved category names/paths

// VERSION moved to top

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
              title: (product.name || "").slice(0, 60),
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
        .select("id, title, product_id, description, products(name, description, brand, short_description, sku, weight, width, height, depth, gtin, barcode)")
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
          const productName = product?.name || listing.title;
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
            const aiRes = await aiChatCompletion(
              "google/gemini-2.5-flash",
              {
                messages: [
                  {
                    role: "system",
                    content: `Você é um especialista em SEO de títulos para o Mercado Livre Brasil.

TAREFA: Gere exatamente UM título otimizado para buscas, com no máximo 60 caracteres.

REGRAS OBRIGATÓRIAS:
1. O título DEVE começar pelo TIPO DE PRODUTO (ex: Balm, Sérum, Kit, Camiseta)
2. NUNCA comece pela marca sozinha — a marca vem DEPOIS do tipo de produto
3. O título deve ter entre 30 e 60 caracteres — aproveite o espaço para incluir diferenciais e benefícios do produto
4. Sem emojis, sem CAPS LOCK (exceto siglas como UV, LED), sem preço/promoção
5. Sem repetir palavras
6. Incluir: tipo de produto + diferenciais/benefícios + marca (se couber)
7. SEMPRE adicione o principal BENEFÍCIO ou FUNÇÃO do produto (ex: Anti-queda, Hidratante, Fortalecedor, Limpeza Profunda)
8. Use informações da descrição e resumo para identificar o que o produto FAZ e inclua no título
9. NUNCA truncar nomes ou marcas — se não cabe, omita a marca em vez de cortar pela metade
10. Priorize termos de busca que compradores usariam para encontrar este produto
11. NÃO inclua código de barras, EAN ou GTIN no título
12. O título DEVE ser uma frase COMPLETA — NUNCA termine com hífen, vírgula ou palavra cortada
13. ANALISE a descrição completa para entender a FUNÇÃO PRINCIPAL do produto antes de gerar o título

EXEMPLOS CORRETOS:
- "Balm Pós-Banho Anti-queda Crescimento Capilar 60g" (50 chars) — inclui benefício "Anti-queda" + função
- "Sérum Facial Vitamina C 30ml Anti-idade Clareador" (50 chars) — inclui benefícios
- "Shampoo Fortalecedor Antiqueda Clear Men 400ml" (47 chars) — inclui função
- "Creme Hidratante Corporal Pele Seca Nivea 400ml" (48 chars) — inclui para quem é

EXEMPLOS ERRADOS (NÃO FAÇA ISSO):
- "Balm Pós-Banho Calvície Zero Dia" (sem benefício, genérico demais)
- "Balm Cabelo Barba Anti-" (TRUNCADO — PROIBIDO, nunca termine com hífen ou palavra cortada)
- "Balm Respeite o" (título truncado, incompleto — PROIBIDO)
- "Nike Tênis" (marca antes do produto)
- "Balm" (muito curto, sem contexto)

VALIDAÇÃO FINAL ANTES DE RESPONDER:
- O título tem pelo menos 30 caracteres? Se não, adicione mais detalhes.
- O título termina com uma palavra completa? Se não, reescreva.
- O título inclui o benefício principal do produto? Se não, adicione.
- O título faz sentido para alguém buscando esse produto? Se não, reformule.

Retorne APENAS o título completo, sem aspas, sem explicações.`,
                  },
                  { role: "user", content: context },
                ],
                max_tokens: 256,
                temperature: attempt === 1 ? 0.3 : 0.5 + (attempt * 0.1),
              },
              {
                supabaseUrl,
                supabaseServiceKey,
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
            lastRawTitle = rawTitle;
            // Clean up: remove quotes, asterisks, etc.
            const title = rawTitle.replace(/^["'*]+|["'*]+$/g, "").trim().slice(0, 60);

            // Validate title quality
            const isTruncated = /[-,\s]$/.test(title) || /\s\w{1,2}$/.test(title);
            const isTooShort = title.length < 25;
            const hasNoContext = title.split(/\s+/).length < 3;
            const isGoodTitle = !isTruncated && !isTooShort && !hasNoContext && title.length > 0;

            console.log(`[meli-bulk-titles] Attempt ${attempt}/${MAX_TITLE_ATTEMPTS} for "${productName}" → "${title}" (${title.length} chars, good=${isGoodTitle}, truncated=${isTruncated})`);

            if (isGoodTitle) {
              finalTitle = title;
              break;
            }

            if (attempt === MAX_TITLE_ATTEMPTS) {
              // Last attempt failed validation — use best effort or fallback
              finalTitle = !isTooShort && !hasNoContext ? title.replace(/[-,\s]+$/, "") : "";
            }
          }

          // Final fallback: use product name if all attempts failed
          if (!finalTitle || finalTitle.length < 15) {
            finalTitle = (productName || listing.title).slice(0, 60);
            console.log(`[meli-bulk-titles] All ${MAX_TITLE_ATTEMPTS} attempts failed for "${productName}", falling back to product name: "${finalTitle}" (last raw: "${lastRawTitle}")`);
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

          const discoveryRes = await fetch(
            `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(searchTerm)}`,
            { headers: mlHeaders }
          );

          if (discoveryRes.ok) {
            const discoveryData = await discoveryRes.json();
            if (Array.isArray(discoveryData) && discoveryData[0]?.category_id) {
              const categoryId = discoveryData[0].category_id;

              await supabase
                .from("meli_listings")
                .update({ category_id: categoryId })
                .eq("id", listing.id);

              // Resolve full category name and path
              let catName = discoveryData[0].category_name || discoveryData[0].domain_name || categoryId;
              let catPath = "";
              try {
                const catRes = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`, { headers: mlHeaders });
                if (catRes.ok) {
                  const catData = await catRes.json();
                  catName = catData.name || catName;
                  catPath = (catData.path_from_root || []).map((p: any) => p.name).join(" > ");
                }
              } catch { /* skip path resolution */ }

              resolvedCategories.push({ listingId: listing.id, categoryId, categoryName: catName, categoryPath: catPath });
              updated++;
            } else {
              skipped++;
            }
          } else {
            await discoveryRes.text();
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
        const discoveryUrl = `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=3&q=${encodeURIComponent(searchTerm)}`;
        console.log(`[auto_suggest] Trying domain_discovery: ${discoveryUrl}`);
        const discoveryRes = await fetch(discoveryUrl, { headers: mlHeaders });
        console.log(`[auto_suggest] Discovery status: ${discoveryRes.status}`);
        
        if (discoveryRes.ok) {
          const discoveryData = await discoveryRes.json();
          console.log(`[auto_suggest] Discovery result:`, JSON.stringify(discoveryData).slice(0, 300));
          if (Array.isArray(discoveryData) && discoveryData[0]?.category_id) {
            categoryId = discoveryData[0].category_id;
            categoryName = discoveryData[0].category_name || discoveryData[0].domain_name || categoryId;
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
