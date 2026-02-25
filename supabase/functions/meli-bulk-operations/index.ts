import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v1.0.0";

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
    const { tenantId, action, productIds, offset = 0, limit = 10 } = body;

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

    // Get ML connection for category prediction
    const { data: mlConnection } = await supabase
      .from("marketplace_connections")
      .select("access_token")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .maybeSingle();

    const mlHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (mlConnection?.access_token) {
      mlHeaders["Authorization"] = `Bearer ${mlConnection.access_token}`;
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // ============ ACTION: bulk_create ============
    if (action === "bulk_create") {
      // Get all active products that don't have listings yet
      let query = supabase
        .from("products")
        .select("id, name, description, price, stock_quantity, sku, brand, gtin, barcode, weight, width, height, depth")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      if (productIds?.length) {
        query = query.in("id", productIds);
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
            const predictRes = await fetch(
              `https://api.mercadolibre.com/sites/MLB/category_predictor/predict?title=${encodeURIComponent(product.name)}`,
              { headers: mlHeaders }
            );
            if (predictRes.ok) {
              const pred = await predictRes.json();
              if (pred.id) {
                categoryId = pred.id;
                categoryName = pred.name || pred.id;
              }
            } else {
              await predictRes.text();
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
      if (!lovableApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Chave de IA não configurada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = supabase
        .from("meli_listings")
        .select("id, title, product_id, description, products(name, description, brand)")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "ready", "approved", "error"]);

      if (productIds?.length) {
        query = query.in("id", productIds);
      }

      const { data: listings, error: listErr } = await query.range(offset, offset + limit - 1);
      if (listErr) throw listErr;

      let updated = 0;
      const errors: string[] = [];

      for (const listing of (listings || [])) {
        try {
          const product = (listing as any).products;
          const productName = product?.name || listing.title;
          const context = [productName, product?.brand, product?.description?.slice(0, 300)].filter(Boolean).join("\n");

          const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `Gere UM título de anúncio para o Mercado Livre com no máximo 60 caracteres.
REGRAS: Sem emojis, sem CAPS LOCK (exceto siglas), sem preço/promoção, sem repetir palavras.
INCLUIR: marca + tipo + característica principal. SEO otimizado.
Retorne APENAS o título, sem aspas, sem explicação.`,
                },
                { role: "user", content: context },
              ],
              max_tokens: 128,
              temperature: 0.5,
            }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            errors.push(`${listing.title}: AI error ${aiRes.status}`);
            continue;
          }

          const aiData = await aiRes.json();
          const title = aiData.choices?.[0]?.message?.content?.trim()?.slice(0, 60) || "";

          if (title) {
            await supabase
              .from("meli_listings")
              .update({ title })
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

    // ============ ACTION: bulk_generate_descriptions ============
    if (action === "bulk_generate_descriptions") {
      if (!lovableApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Chave de IA não configurada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = supabase
        .from("meli_listings")
        .select("id, title, description, product_id, products(name, description)")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "ready", "approved", "error"]);

      if (productIds?.length) {
        query = query.in("id", productIds);
      }

      const { data: listings, error: listErr } = await query.range(offset, offset + limit - 1);
      if (listErr) throw listErr;

      let updated = 0;
      const errors: string[] = [];

      for (const listing of (listings || [])) {
        try {
          const product = (listing as any).products;
          const htmlSource = product?.description || listing.description || listing.title;

          if (!htmlSource?.trim()) {
            errors.push(`${listing.title}: Sem descrição fonte`);
            continue;
          }

          const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `Converta para texto plano compatível com o Mercado Livre.
REGRAS: Apenas texto plano, sem HTML/Markdown. PROIBIDO: telefones, WhatsApp, e-mails, links, URLs, emojis.
Use \\n para organizar. MAIÚSCULAS para títulos de seção.
Preserve informações técnicas, ANVISA, composições. Máx 5000 chars.
Retorne APENAS o texto da descrição.`,
                },
                {
                  role: "user",
                  content: `Produto: ${product?.name || listing.title}\n\nDescrição:\n${htmlSource}`,
                },
              ],
              max_tokens: 4096,
              temperature: 0.3,
            }),
          });

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
        .select("id, title, category_id, product_id, products(name)")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "ready", "approved", "error"]);

      if (productIds?.length) {
        query = query.in("id", productIds);
      }

      const { data: listings, error: listErr } = await query.range(offset, offset + limit - 1);
      if (listErr) throw listErr;

      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const listing of (listings || [])) {
        try {
          // Skip if already has category
          if (listing.category_id) {
            skipped++;
            continue;
          }

          const product = (listing as any).products;
          const searchTerm = product?.name || listing.title;

          const predictRes = await fetch(
            `https://api.mercadolibre.com/sites/MLB/category_predictor/predict?title=${encodeURIComponent(searchTerm)}`,
            { headers: mlHeaders }
          );

          if (predictRes.ok) {
            const pred = await predictRes.json();
            if (pred.id) {
              await supabase
                .from("meli_listings")
                .update({ category_id: pred.id })
                .eq("id", listing.id);
              updated++;
            } else {
              skipped++;
            }
          } else {
            await predictRes.text();
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
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ACTION: auto_suggest_category (single product) ============
    if (action === "auto_suggest_category") {
      const { productName } = body;
      if (!productName) {
        return new Response(
          JSON.stringify({ success: false, error: "productName obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const predictRes = await fetch(
        `https://api.mercadolibre.com/sites/MLB/category_predictor/predict?title=${encodeURIComponent(productName)}`,
        { headers: mlHeaders }
      );

      if (!predictRes.ok) {
        await predictRes.text();
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível prever categoria" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pred = await predictRes.json();
      if (!pred.id) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma categoria encontrada para este produto" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get full category path
      const catRes = await fetch(`https://api.mercadolibre.com/categories/${pred.id}`, { headers: mlHeaders });
      let categoryName = pred.name || pred.id;
      let pathStr = "";
      if (catRes.ok) {
        const catData = await catRes.json();
        categoryName = catData.name || categoryName;
        pathStr = (catData.path_from_root || []).map((p: any) => p.name).join(" > ");
      } else {
        await catRes.text();
      }

      return new Response(
        JSON.stringify({
          success: true,
          categoryId: pred.id,
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
