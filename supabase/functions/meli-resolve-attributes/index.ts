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

const VERSION = "1.0.0";

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

    const { tenantId, productId, categoryId } = await req.json();
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
        id, name, sku, description, short_description, price, weight, width, height, length,
        brand, gtin, condition, warranty, warranty_months, product_format,
        regulatory_regime, universal_category_id, net_content_value, net_content_unit, gender_audience,
        ai_product_type, ai_main_function
      `)
      .eq("id", productId).eq("tenant_id", tenantId).maybeSingle();
    if (pErr || !product) return json({ success: false, error: "Produto não encontrado" });

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
    const warrantyText = (product.warranty?.trim?.()
      || (product.warranty_months ? `${product.warranty_months} ${product.warranty_months === 1 ? "mês" : "meses"} de garantia` : null));

    // ---- 5. Resolução determinística por atributo -----------------------
    const resolved: ResolvedAttr[] = [];
    const aiPending: MeliAttrSpec[] = [];

    for (const a of meliAttrs) {
      const required = !!a.tags?.required || !!a.tags?.catalog_required;
      let value_name: string | undefined;
      let source: ResolvedAttr["source"] = "none";

      // 5.1 dicionário universal
      const dictEntry = dictByMeliId.get(a.id);
      if (dictEntry?.universal_key) {
        const k = dictEntry.universal_key as string;
        const map: Record<string, any> = {
          brand: product.brand,
          gtin: product.gtin,
          ean: product.gtin,
          model: product.sku,
          sku: product.sku,
          condition: product.condition || "new",
          gender: product.gender_audience,
          regulatory_regime: regulatoryRegime,
          net_content_value: product.net_content_value,
          net_content_unit: product.net_content_unit,
          weight_grams: netWeightG,
          is_kit: isKit ? "Sim" : "Não",
          units_per_package: unitsPerPackage,
          warranty: warrantyText,
          product_type: product.ai_product_type,
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
        else if (id === "MODEL" && product.sku) { value_name = product.sku; source = "product"; }
        else if (id === "ITEM_CONDITION") { value_name = "Novo"; source = "derivation"; }
        else if ((id === "IS_KIT" || id === "PACKAGE_LENGTH") && isKit) {
          if (id === "IS_KIT") { value_name = "Sim"; source = "derivation"; }
        }
        else if (id === "UNITS_PER_PACKAGE" && unitsPerPackage > 1) {
          value_name = String(unitsPerPackage); source = "derivation";
        }
        else if (id === "WEIGHT" && netWeightG) { value_name = String(netWeightG); source = "derivation"; }
      }

      // Match valor contra lista oficial do ML quando aplicável
      let value_id: string | undefined;
      if (value_name && a.values?.length) {
        const norm = value_name.toLowerCase().trim();
        const hit = a.values.find(v => v.name.toLowerCase().trim() === norm);
        if (hit) value_id = hit.id;
      }

      if (value_name) {
        resolved.push({
          id: a.id, name: a.name, value_name, value_id,
          status: "filled", source, required,
        });
      } else if (required || a.tags?.allow_variations === false) {
        aiPending.push(a);
      }
      // não-obrigatório sem valor: ignora (não polui painel)
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
