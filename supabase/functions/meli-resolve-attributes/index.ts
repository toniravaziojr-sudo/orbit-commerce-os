// =============================================
// meli-resolve-attributes — Etapa 5A do plano de classificação universal
// Recebe { tenantId, productId, categoryId } e devolve um painel pronto:
// { attributes: [{ id, name, value_name, value_id, status, source, required, message }] }
//
// Status:
//   - filled : valor confiável vindo do cadastro, derivação ou dicionário.
//   - review : sugestão da IA (precisa confirmação humana).
//   - missing: obrigatório do ML sem valor confiável e sem palpite seguro.
//
// IA: Gemini nativo (com fallback) via _shared/ai-router.ts.
// Sem chamada direta ao Lovable Gateway.
// =============================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletionJSON } from "../_shared/ai-router.ts";

const VERSION = "1.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface MeliAttrSpec {
  id: string;
  name: string;
  tags?: Record<string, boolean>;
  value_type?: string;
  values?: Array<{ id: string; name: string }>;
}

interface ResolvedAttr {
  id: string;
  name: string;
  value_name?: string;
  value_id?: string;
  status: "filled" | "review" | "missing";
  source: "product" | "derivation" | "dictionary" | "ai" | "none";
  required: boolean;
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autorizado" });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ success: false, error: "Sessão inválida" });

    const { tenantId, productId, categoryId, listingId } = await req.json();
    if (!tenantId || !productId || !categoryId) {
      return json({ success: false, error: "tenantId, productId e categoryId são obrigatórios" });
    }

    const { data: userRole } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
    if (!userRole) return json({ success: false, error: "Sem acesso ao tenant" });

    // ---- 1. Carregar produto + composição + categoria universal --------
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select(`
        id, name, sku, description, short_description, price, weight, width, height, depth,
        brand, model, line, gtin, warranty_duration, warranty_type, product_format,
        regulatory_regime, universal_category_id, net_content_value, net_content_unit, gender_audience, product_type,
        ai_product_type, ai_main_function,
        dermatologically_tested, hypoallergenic, cruelty_free, vegan, has_fragrance,
        fragrance_name, recommended_hair_types, treatment_types, expected_effects
      `)
      .eq("id", productId).eq("tenant_id", tenantId).maybeSingle();
    if (pErr) {
      console.error("[meli-resolve-attributes] falha ao carregar produto:", pErr);
      return json({ success: false, error: "Não foi possível carregar o cadastro do produto", code: "product_lookup_failed" });
    }
    if (!product) return json({ success: false, error: "Produto não encontrado", code: "product_not_found" });

    let listingCondition = "new";
    if (listingId) {
      const { data: listing } = await supabase
        .from("meli_listings")
        .select("condition")
        .eq("id", listingId)
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .maybeSingle();
      listingCondition = listing?.condition || listingCondition;
    }

    const { data: components } = await supabase
      .from("product_components")
      .select("component_product_id, quantity, component:products!component_product_id(weight, net_content_value, net_content_unit)")
      .eq("parent_product_id", productId);

    let universalCategory: any = null;
    if (product.universal_category_id) {
      const { data: uc } = await supabase
        .from("system_universal_categories")
        .select("id, slug, name, regulatory_regime")
        .eq("id", product.universal_category_id).maybeSingle();
      universalCategory = uc;
    }

    // ---- 2. Buscar specs da categoria no ML ----------------------------
    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("access_token")
      .eq("tenant_id", tenantId).eq("marketplace", "mercadolivre").maybeSingle();
    if (!connection?.access_token) {
      return json({ success: false, error: "Mercado Livre não conectado" });
    }
    const attrRes = await fetch(`https://api.mercadolibre.com/categories/${categoryId}/attributes`, {
      headers: { Authorization: `Bearer ${connection.access_token}` },
    });
    if (!attrRes.ok) {
      return json({ success: false, error: `ML retornou ${attrRes.status} ao buscar atributos da categoria` });
    }
    const meliAttrs: MeliAttrSpec[] = await attrRes.json();

    // ---- 3. Dicionário universal ---------------------------------------
    const { data: dict } = await supabase
      .from("system_marketplace_attribute_dictionary")
      .select("universal_key, meli_id, value_map")
      .not("meli_id", "is", null);
    const dictByMeliId = new Map<string, any>();
    (dict ?? []).forEach((d: any) => dictByMeliId.set(d.meli_id, d));

    // ---- 4. Derivações ---------------------------------------------------
    const compArr = (components ?? []).map((c: any) => ({
      component_product_id: c.component_product_id,
      quantity: Number(c.quantity) || 0,
      component: c.component,
    }));
    const hasComp = product.product_format === "with_composition" && compArr.length > 0;
    const isKit = hasComp;
    const unitsPerPackage = hasComp
      ? compArr.reduce((s, c) => s + c.quantity, 0) || 1
      : 1;
    let netWeightG: number | null = null;
    if (product.weight && Number(product.weight) > 0) netWeightG = Number(product.weight);
    else if (hasComp) {
      const sum = compArr.reduce((s, c) => s + (Number(c.component?.weight) || 0) * c.quantity, 0);
      if (sum > 0) netWeightG = sum;
    }
    const regulatoryRegime = product.regulatory_regime ?? universalCategory?.regulatory_regime ?? null;
    const warrantyText = product.warranty_duration
      ? `${product.warranty_duration}${product.warranty_type ? ` (${product.warranty_type})` : ""} de garantia`
      : null;

    // ---- 5. Resolução determinística por atributo -----------------------
    const resolved: ResolvedAttr[] = [];
    const aiPending: MeliAttrSpec[] = [];

    // Atributos cosméticos tri-state (Sim / Não / Não se aplica).
    // Mesmo quando não obrigatórios pela categoria, devem SEMPRE ser preenchidos
    // (fallback "Não" pela IA quando não houver base) para evitar a seção
    // "Características secundárias incompletas" no painel do ML.
    const COSMETIC_TRISTATE = new Set([
      "DERMATOLOGICALLY_TESTED", "HYPOALLERGENIC",
      "IS_CRUELTY_FREE", "CRUELTY_FREE",
      "IS_VEGAN", "VEGAN",
      "WITH_FRAGRANCE", "HAS_FRAGRANCE",
      "IS_ORGANIC", "ORGANIC",
      "IS_PARABEN_FREE", "PARABEN_FREE", "WITH_PARABEN", "CONTAINS_PARABEN",
      "IS_NATURAL", "NATURAL_PRODUCT",
      "IS_GLUTEN_FREE", "GLUTEN_FREE",
    ]);

    for (const a of meliAttrs) {
      const required = !!a.tags?.required || !!a.tags?.catalog_required;
      let value_name: string | undefined;
      let source: ResolvedAttr["source"] = "none";

      // 5.1 dicionário universal
      const dictEntry = dictByMeliId.get(a.id);
      if (dictEntry?.universal_key) {
        const k = dictEntry.universal_key as string;
        const productTypeFallback = (product.model && String(product.model).trim())
          || product.product_type
          || product.ai_product_type
          || "Genérico";
        const lineFallback = (product.line && String(product.line).trim())
          || product.product_type
          || product.ai_product_type
          || null;
        const map: Record<string, any> = {
          brand: product.brand,
          gtin: product.gtin,
          ean: product.gtin,
          model: productTypeFallback,
          line: lineFallback,
          sku: product.sku,
          condition: listingCondition,
          gender: product.gender_audience,
          regulatory_regime: regulatoryRegime,
          net_content_value: product.net_content_value,
          net_content_unit: product.net_content_unit,
          weight_grams: netWeightG,
          is_kit: isKit ? "Sim" : "Não",
          units_per_package: unitsPerPackage,
          warranty: warrantyText,
          product_type: product.product_type || product.ai_product_type,
          main_function: product.ai_main_function,
        };
        const v = map[k];
        if (v != null && String(v).trim()) {
          value_name = String(v);
          source = "dictionary";
        }
      }

      // 5.2 heurística determinística por nome do atributo
      if (!value_name) {
        const id = a.id.toUpperCase();
        if (id === "BRAND" && product.brand) { value_name = product.brand; source = "product"; }
        else if ((id === "GTIN" || id === "EAN") && product.gtin) { value_name = product.gtin; source = "product"; }
        else if (id === "MODEL") {
          const modelValue = (product.model && String(product.model).trim())
            || product.product_type
            || product.ai_product_type
            || "Genérico";
          value_name = String(modelValue);
          source = product.model ? "product" : "derivation";
        }
        else if (id === "LINE") {
          // Linha: cadastro tem prioridade; senão, deixa para IA sugerir com base no contexto.
          if (product.line && String(product.line).trim()) {
            value_name = String(product.line).trim();
            source = "product";
          }
          // sem fallback determinístico — IA decide entre product_type ou "Não se aplica"
        }
        else if (id === "ITEM_CONDITION") { value_name = listingCondition === "used" ? "Usado" : listingCondition === "not_specified" ? "Não especificado" : "Novo"; source = "derivation"; }
        else if ((id === "IS_KIT" || id === "PACKAGE_LENGTH") && isKit) {
          if (id === "IS_KIT") { value_name = "Sim"; source = "derivation"; }
        }
        else if (id === "UNITS_PER_PACKAGE" && unitsPerPackage > 1) {
          value_name = String(unitsPerPackage); source = "derivation";
        }
        else if (id === "WEIGHT" && netWeightG) { value_name = String(netWeightG); source = "derivation"; }
        // --- Atributos cosméticos (tri-state Sim/Não/Não se aplica) ---
        else if (id === "DERMATOLOGICALLY_TESTED" && product.dermatologically_tested) {
          value_name = product.dermatologically_tested === "yes" ? "Sim" : product.dermatologically_tested === "no" ? "Não" : "Não se aplica";
          source = "product";
        }
        else if (id === "HYPOALLERGENIC" && product.hypoallergenic) {
          value_name = product.hypoallergenic === "yes" ? "Sim" : product.hypoallergenic === "no" ? "Não" : "Não se aplica";
          source = "product";
        }
        else if ((id === "IS_CRUELTY_FREE" || id === "CRUELTY_FREE") && product.cruelty_free) {
          value_name = product.cruelty_free === "yes" ? "Sim" : product.cruelty_free === "no" ? "Não" : "Não se aplica";
          source = "product";
        }
        else if ((id === "IS_VEGAN" || id === "VEGAN") && product.vegan) {
          value_name = product.vegan === "yes" ? "Sim" : product.vegan === "no" ? "Não" : "Não se aplica";
          source = "product";
        }
        else if ((id === "WITH_FRAGRANCE" || id === "HAS_FRAGRANCE") && product.has_fragrance) {
          value_name = product.has_fragrance === "yes" ? "Sim" : product.has_fragrance === "no" ? "Não" : "Não se aplica";
          source = "product";
        }
        else if (id === "FRAGRANCE" && product.fragrance_name) {
          value_name = product.fragrance_name; source = "product";
        }
        else if ((id === "HAIR_TYPES" || id === "HAIR_TYPE") && Array.isArray(product.recommended_hair_types) && product.recommended_hair_types.length > 0) {
          const hairMap: Record<string, string> = {
            oleoso: "Oleoso", seco: "Seco", misto: "Misto", normal: "Normal",
            cacheado: "Cacheado", liso: "Liso", todos: "Todos os tipos",
          };
          value_name = product.recommended_hair_types.map((h: string) => hairMap[h] || h).join(", ");
          source = "product";
        }
        else if ((id === "HAIR_TREATMENT_TYPE" || id === "TREATMENT_TYPE" || id === "TREATMENT_FORMAT") && Array.isArray(product.treatment_types) && product.treatment_types.length > 0) {
          const trtMap: Record<string, string> = {
            antiqueda: "Antiqueda", crescimento: "Crescimento", hidratacao: "Hidratação",
            anticaspa: "Anticaspa", antioleosidade: "Antioleosidade", reconstrucao: "Reconstrução",
            fortalecimento: "Fortalecimento", limpeza: "Limpeza", pos_banho: "Pós-banho",
          };
          value_name = product.treatment_types.map((t: string) => trtMap[t] || t).join(", ");
          source = "product";
        }
        else if (id === "EFFECTS" && product.expected_effects) {
          value_name = product.expected_effects; source = "product";
        }
        else if (id === "PRODUCT_TYPE" && (product.product_type || product.ai_product_type)) {
          value_name = product.product_type || product.ai_product_type;
          source = product.product_type ? "product" : "derivation";
        }
      }

      // Match valor contra lista oficial do ML quando aplicável
      let value_id: string | undefined;
      let listMismatch = false;
      if (value_name && a.values?.length) {
        const norm = value_name.toLowerCase().trim();
        const hit = a.values.find(v => v.name.toLowerCase().trim() === norm);
        if (hit) value_id = hit.id;
        else listMismatch = true; // valor heurístico fora da lista oficial → não enviar livre
      }

      const isCosmeticTriState = COSMETIC_TRISTATE.has(a.id.toUpperCase());

      if (value_name && !listMismatch) {
        resolved.push({
          id: a.id, name: a.name, value_name, value_id,
          status: "filled", source, required,
        });
      } else if (required || a.tags?.allow_variations === false || listMismatch || isCosmeticTriState || a.id.toUpperCase() === "LINE") {
        // inclui:
        // - obrigatórios sem valor
        // - valores heurísticos fora da lista oficial (IA escolhe um válido)
        // - atributos cosméticos tri-state (sempre preencher para não deixar
        //   "Características secundárias incompletas" no anúncio do ML)
        // - LINE (linha do produto): IA sugere baseado no contexto se não houver cadastro
        aiPending.push(a);
      }
      // não-obrigatório sem valor válido: ignora (não polui painel)
    }

    // ---- 6. Pergunta à IA para cobrir o que sobrou (obrigatórios) ------
    if (aiPending.length > 0) {
      const compact = aiPending.slice(0, 25).map(a => ({
        id: a.id, name: a.name,
        values: a.values?.slice(0, 30).map(v => v.name) ?? null,
        value_type: a.value_type,
      }));
      const productContext = {
        nome: product.name,
        descricao: (product.short_description || product.description || "").slice(0, 800),
        marca: product.brand, gtin: product.gtin, sku: product.sku,
        peso_g: netWeightG, conteudo: product.net_content_value ? `${product.net_content_value}${product.net_content_unit ?? ""}` : null,
        tipo: product.ai_product_type, funcao: product.ai_main_function,
        publico: product.gender_audience, regime: regulatoryRegime,
        categoria_universal: universalCategory?.name,
        is_kit: isKit, unidades_por_embalagem: unitsPerPackage,
        cosmetico: {
          dermatologicamente_testado: product.dermatologically_tested,
          hipoalergenico: product.hypoallergenic,
          cruelty_free: product.cruelty_free,
          vegano: product.vegan,
          com_fragrancia: product.has_fragrance,
          fragrancia: product.fragrance_name,
          tipos_cabelo: product.recommended_hair_types,
          tratamentos: product.treatment_types,
          efeitos: product.expected_effects,
        },
      };
      const prompt = `Você preenche atributos de anúncio do Mercado Livre.
Dado o produto abaixo, sugira valores APENAS para os atributos listados.
Use exatamente um dos valores fornecidos em "values" quando existir; caso contrário, devolva texto curto em pt-BR.
Se realmente não houver base no produto, retorne "" (string vazia).

Produto: ${JSON.stringify(productContext)}

Atributos a preencher: ${JSON.stringify(compact)}

Responda JSON: {"answers":[{"id":"...","value":"..."}]}`;

      try {
        const { data } = await aiChatCompletionJSON(
          "google/gemini-2.5-flash",
          {
            messages: [
              { role: "system", content: "Você devolve apenas JSON válido conforme o esquema solicitado." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          },
          { supabaseUrl, supabaseServiceKey: serviceKey, logPrefix: "meli-resolve-attrs" },
        );
        const content = data?.choices?.[0]?.message?.content ?? "{}";
        const parsed = typeof content === "string" ? JSON.parse(content) : content;
        const answers: Array<{ id: string; value: string }> = parsed.answers ?? [];
        const byId = new Map(answers.map(a => [a.id, a.value]));

        for (const a of aiPending) {
          const suggested = (byId.get(a.id) ?? "").trim();
          const required = !!a.tags?.required || !!a.tags?.catalog_required;
          if (suggested) {
            let value_id: string | undefined;
            if (a.values?.length) {
              const norm = suggested.toLowerCase().trim();
              const hit = a.values.find(v => v.name.toLowerCase().trim() === norm);
              if (hit) value_id = hit.id;
            }
            resolved.push({
              id: a.id, name: a.name, value_name: suggested, value_id,
              status: "review", source: "ai", required,
              message: "Sugestão da IA — confirme antes de publicar.",
            });
          } else if (required) {
            resolved.push({
              id: a.id, name: a.name,
              status: "missing", source: "none", required: true,
              message: friendlyMissingMessage(a),
            });
          }
        }
      } catch (e) {
        // IA falhou → marca como missing os obrigatórios restantes
        for (const a of aiPending) {
          const required = !!a.tags?.required || !!a.tags?.catalog_required;
          if (required) resolved.push({
            id: a.id, name: a.name,
            status: "missing", source: "none", required: true,
            message: friendlyMissingMessage(a),
          });
        }
        console.error("[meli-resolve-attributes] IA falhou:", (e as Error).message);
      }
    }

    const summary = {
      filled: resolved.filter(r => r.status === "filled").length,
      review: resolved.filter(r => r.status === "review").length,
      missing: resolved.filter(r => r.status === "missing").length,
    };

    return json({
      success: true,
      version: VERSION,
      categoryId,
      attributes: resolved,
      summary,
      can_publish: summary.missing === 0,
    });
  } catch (err) {
    console.error("[meli-resolve-attributes] erro:", err);
    return json({ success: false, error: (err as Error).message });
  }
});

function friendlyMissingMessage(a: MeliAttrSpec): string {
  return `Preencha "${a.name}" no cadastro do produto ou diretamente no anúncio antes de publicar.`;
}
