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

const VERSION = "1.9.0";

// --------- Sanitização universal de valores vindos da IA ------------
// A IA pode devolver string, array, objeto, número, null ou undefined.
// Qualquer um desses deve virar string segura (ou string vazia).
function toSafeString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (Array.isArray(v)) return v.map(toSafeString).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.value === "string") return obj.value.trim();
    if (typeof obj.name === "string") return obj.name.trim();
    try { return JSON.stringify(v).slice(0, 200); } catch { return ""; }
  }
  try { return String(v).trim(); } catch { return ""; }
}

// Lista negra: marcas famosas que a IA tende a inventar quando o produto
// não tem marca cadastrada. Bloqueia qualquer sugestão dessas marcas pela IA.
const FAMOUS_BRAND_BLACKLIST = new Set([
  "loreal", "l'oreal", "loreal paris", "l'oreal paris", "lóreal", "lóreal paris",
  "nivea", "dove", "garnier", "pantene", "tresemme", "tresemmé",
  "head shoulders", "head & shoulders", "clear", "seda", "elseve",
  "natura", "boticario", "boticário", "avon", "eudora", "quem disse berenice",
  "johnson", "johnson's", "johnson e johnson",
  "vichy", "la roche posay", "neutrogena", "eucerin", "cetaphil",
  "kerastase", "kérastase", "redken", "wella", "schwarzkopf",
  "samsung", "apple", "lg", "sony", "philips", "motorola", "xiaomi",
  "nike", "adidas", "puma", "reebok",
]);

function isBlacklistedBrand(value: string): boolean {
  const norm = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 &']/g, "").trim();
  return FAMOUS_BRAND_BLACKLIST.has(norm);
}

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
  /** Valores múltiplos quando o atributo do ML é multivalorado (ex.: Tipos de cabelo, Formatos de tratamento). */
  values?: Array<{ id?: string; name: string }>;
  status: "filled" | "review" | "missing";
  source: "product" | "derivation" | "dictionary" | "ai" | "none";
  required: boolean;
  message?: string;
  /** v1.9.0: marcador "Não se aplica" — vai ao ML com o marcador oficial da categoria. */
  not_applicable?: boolean;
}

// Detecta atributos do ML que aceitam múltiplos valores (multi-seleção).
function isMultiValuedSpec(spec: MeliAttrSpec): boolean {
  const tags: any = spec.tags || {};
  if (tags.multivalued === true) return true;
  if (tags.allow_variations === true && Array.isArray(spec.values) && spec.values.length > 1) {
    // não confunde com variações de produto; segue regra abaixo
  }
  // ML também usa value_max_quantity > 1 em algumas categorias
  const vmq = (spec as any).value_max_quantity;
  if (typeof vmq === "number" && vmq > 1) return true;
  return false;
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
        regulatory_regime, regulatory_category, regulatory_info,
        universal_category_id, net_content_value, net_content_unit, gender_audience, product_type,
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

    const BLOCKED_ATTR_IDS = new Set([
      "PACKAGE_HEIGHT", "PACKAGE_WIDTH", "PACKAGE_LENGTH", "PACKAGE_WEIGHT",
      "SELLER_PACKAGE_HEIGHT", "SELLER_PACKAGE_WIDTH", "SELLER_PACKAGE_LENGTH", "SELLER_PACKAGE_WEIGHT",
    ]);

    const normalizeText = (value: string) => value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    const matchAllowedValue = (attr: MeliAttrSpec, candidate?: string | null) => {
      if (!candidate || !attr.values?.length) return null;
      const normCandidate = normalizeText(String(candidate));
      return attr.values.find(v => normalizeText(v.name) === normCandidate) ?? null;
    };

    const inferProductFormat = (attr: MeliAttrSpec) => {
      const seeds = [product.product_type, product.ai_product_type, product.name, universalCategory?.name]
        .filter(Boolean).join(" ");
      const norm = normalizeText(seeds);
      const candidates = [
        { test: ["balm", "balsamo", "bálsamo"], value: "Bálsamo" },
        { test: ["locao", "loção", "lotion"], value: "Loção" },
        { test: ["gel"], value: "Gel" },
        { test: ["creme"], value: "Creme" },
        { test: ["serum", "sérum"], value: "Sérum" },
        { test: ["spray"], value: "Spray" },
        { test: ["emulsao", "emulsão"], value: "Emulsão" },
        { test: ["aerossol", "aerosol"], value: "Aerossol" },
        { test: ["bastao", "bastão"], value: "Bastão" },
      ];
      for (const candidate of candidates) {
        if (candidate.test.some(t => norm.includes(normalizeText(t))) && matchAllowedValue(attr, candidate.value)) {
          return candidate.value;
        }
      }
      return null;
    };

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
      if (BLOCKED_ATTR_IDS.has(a.id) || a.tags?.read_only) continue;
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
        else if (id === "PRODUCT_FORMAT") {
          const inferred = inferProductFormat(a);
          if (inferred) { value_name = inferred; source = "derivation"; }
        }
        else if (id === "SALE_FORMAT") {
          value_name = isKit ? "Kit" : "Unidade";
          source = "derivation";
        }
        else if (id === "UNITS_PER_PACK" && unitsPerPackage > 1) {
          value_name = String(unitsPerPackage); source = "derivation";
        }
        else if (id === "PRODUCT_CONSERVATION") {
          value_name = "Temperatura ambiente";
          source = "derivation";
        }
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
            cacheado: "Cacheado", liso: "Liso", ralo: "Ralo", crespo: "Crespo",
            todos: "Todo tipo de cabelo",
          };
          value_name = product.recommended_hair_types.map((h: string) => hairMap[h] || h).join(", ");
          source = "product";
        }
        else if ((id === "HAIR_TREATMENT_TYPE" || id === "TREATMENT_TYPE" || id === "TREATMENT_FORMAT" || id === "HAIR_TREATMENT_FORMAT") && Array.isArray(product.treatment_types) && product.treatment_types.length > 0) {
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
        // --- Garantia (cadastro do produto) — v1.9.0: fallback "Sem garantia" quando vazio ---
        else if (id === "WARRANTY_TYPE") {
          if (product.warranty_type === "vendor") { value_name = "Garantia do vendedor"; source = "product"; }
          else if (product.warranty_type === "factory") { value_name = "Garantia de fábrica"; source = "product"; }
          else { value_name = "Sem garantia"; source = "derivation"; }
        }
        else if ((id === "WARRANTY_TIME" || id === "WARRANTY") && product.warranty_duration) {
          value_name = String(product.warranty_duration).trim();
          source = "product";
        }
        // --- Órgão regulatório (ANVISA para cosméticos) ---
        else if (
          (id === "REGULATORY_AGENCY" || id === "SANITARY_REGISTRY_AGENCY" ||
           id === "HEALTH_REGISTRATION_INSTITUTION" || id === "REGULATORY_BODY" ||
           id === "ANVISA_REGISTRY_INSTITUTION") &&
          regulatoryRegime && String(regulatoryRegime).toLowerCase().includes("anvisa")
        ) {
          value_name = "ANVISA";
          source = "product";
        }
        // --- Números regulatórios (ANVISA / AFE / CONAMA) por NOME do atributo da categoria ---
        // ML usa IDs diferentes por categoria (ex.: ANVISA_PRIOR_NOTIFICATION_COMMUNICATION_DOCUMENT_NUMBER,
        // ANVISA_PRODUCT_REGISTRATION_NUMBER, AFE_CERTIFICATION_NUMBER, CONAMA_LICENSE_NUMBER).
        // Casamos pelo nome humano para cobrir todas as variações.
        else {
          const regInfo = (product as any).regulatory_info || {};
          const anvisaNum = typeof regInfo.anvisa === "string" ? regInfo.anvisa.trim() : "";
          const afeNum = typeof regInfo.afe === "string" ? regInfo.afe.trim() : "";
          const conamaNum = typeof regInfo.conama === "string" ? regInfo.conama.trim() : "";
          const nameNorm = normalizeText(a.name || "");
          const isAnvisaNumber = nameNorm.includes("anvisa") && (
            nameNorm.includes("numero") || nameNorm.includes("notifica") ||
            nameNorm.includes("comunica") || nameNorm.includes("registro") ||
            nameNorm.includes("documento")
          );
          const isAfeNumber = nameNorm.includes("afe") && (nameNorm.includes("certificad") || nameNorm.includes("numero") || nameNorm.includes("autorizac"));
          const isConamaNumber = nameNorm.includes("conama");
          if (isAnvisaNumber && anvisaNum) { value_name = anvisaNum; source = "product"; }
          else if (isAfeNumber && afeNum) { value_name = afeNum; source = "product"; }
          else if (isConamaNumber && conamaNum) { value_name = conamaNum; source = "product"; }
        }
      }

      // Atributo multi-valor: monta lista de valores em vez de string única.
      const multiValued = isMultiValuedSpec(a);
      if (multiValued && value_name && value_name.includes(",")) {
        const pieces = value_name.split(",").map(s => s.trim()).filter(Boolean);
        const valuesArr: Array<{ id?: string; name: string }> = [];
        for (const p of pieces) {
          if (a.values?.length) {
            const hit = matchAllowedValue(a, p);
            if (hit) valuesArr.push({ id: hit.id, name: hit.name });
          } else {
            valuesArr.push({ name: p });
          }
        }
        if (valuesArr.length > 0) {
          resolved.push({
            id: a.id, name: a.name,
            value_name: valuesArr.map(v => v.name).join(", "),
            values: valuesArr,
            status: "filled", source, required,
          });
          continue;
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
      // Atributos onde o ML aceita texto LIVRE mesmo quando a categoria publica
      // uma "lista sugerida". Marca da loja própria nunca está nessa lista, mas
      // o ML aceita; idem GTIN/EAN/MODEL/SELLER_SKU vindos do cadastro.
      const idUp = a.id.toUpperCase();
      const FREE_FORM_FROM_PRODUCT = new Set(["BRAND", "GTIN", "EAN", "MODEL", "SELLER_SKU"]);
      const isFreeFormFromProduct =
        FREE_FORM_FROM_PRODUCT.has(idUp) && (source === "product" || source === "derivation");

      if (value_name && (!listMismatch || isFreeFormFromProduct)) {
        resolved.push({
          id: a.id, name: a.name, value_name, value_id,
          status: "filled", source, required,
        });
      } else {
        if (a.tags?.hidden && !required && !isCosmeticTriState) continue;
        // Envia TODOS os atributos sem valor determinístico para a IA tentar preencher.
        // Inclui opcionais — essencial para nota de qualidade do anúncio (características
        // secundárias). IA retorna "" quando não há base e o atributo é descartado.
        aiPending.push(a);
      }
    }






    // ---- 6. Pergunta à IA para cobrir TODOS os atributos sem valor ------
    // Processa em lotes de 25 para não estourar contexto e dar melhor qualidade.
    if (aiPending.length > 0) {
      const regInfo: any = (product as any).regulatory_info || {};
      const productContext = {
        nome: product.name,
        descricao_curta: (product.short_description || "").slice(0, 600),
        descricao_longa: (product.description || "").replace(/<[^>]*>/g, " ").slice(0, 1500),
        marca: product.brand, linha: product.line, modelo: product.model,
        gtin: product.gtin, sku: product.sku,
        peso_g: netWeightG,
        dimensoes_cm: { largura: product.width, altura: product.height, profundidade: product.depth },
        conteudo: product.net_content_value ? `${product.net_content_value} ${product.net_content_unit ?? ""}`.trim() : null,
        tipo_cadastro: product.product_type,
        tipo_ia: product.ai_product_type,
        funcao_principal: product.ai_main_function,
        publico: product.gender_audience,
        regime_regulatorio: regulatoryRegime,
        categoria_regulatoria: (product as any).regulatory_category,
        numeros_regulatorios: {
          anvisa: regInfo.anvisa || null,
          afe: regInfo.afe || null,
          conama: regInfo.conama || null,
        },
        garantia: warrantyText,
        categoria_universal: universalCategory?.name,
        is_kit: isKit, unidades_por_embalagem: unitsPerPackage,
        composicao: compArr.length > 0 ? compArr.map(c => ({ qtd: c.quantity, peso_g: c.component?.weight, conteudo: c.component?.net_content_value })) : null,
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
      const requiredClosedListIds = aiPending
        .filter(a => (a.tags?.required || a.tags?.catalog_required) && (a.values?.length ?? 0) > 0)
        .map(a => a.id);

      // batches de 25 atributos
      const BATCH = 25;
      const batches: MeliAttrSpec[][] = [];
      for (let i = 0; i < aiPending.length; i += BATCH) {
        batches.push(aiPending.slice(i, i + BATCH));
      }
      const allAnswers = new Map<string, string>();

      for (const batch of batches) {
        const compact = batch.map(a => ({
          id: a.id, name: a.name,
          values: a.values?.slice(0, 30).map(v => v.name) ?? null,
          value_type: a.value_type,
          multi: isMultiValuedSpec(a),
        }));
        const cosmeticIdsInBatch = compact
          .filter(c => COSMETIC_TRISTATE.has(c.id.toUpperCase()))
          .map(c => c.id);
        const multiIdsInBatch = compact.filter(c => c.multi).map(c => c.id);

        const prompt = `Você preenche atributos de anúncio do Mercado Livre.
Cada atributo da CATEGORIA escolhida deve receber UMA das três respostas:
1) O valor real (texto ou opção exata da lista "values"), quando o cadastro do produto deixar claro.
2) A string especial "NAO_SE_APLICA" quando o atributo NÃO faz sentido para este produto (ex.: "Voltagem" num shampoo, "Dosador" num produto que não tem dosador).
3) "" (vazio) APENAS quando você tem dúvida real sobre o valor. O sistema converte "" em "NAO_SE_APLICA" para opcionais — então prefira "NAO_SE_APLICA" quando tiver certeza de que não se aplica.

REGRAS ABSOLUTAS DE SEGURANÇA (nunca quebrar):
- O campo "value" SEMPRE deve ser STRING. Para atributos MULTI-seleção (multi=true) junte os valores escolhidos com vírgula (ex.: "Oleoso, Ralo, Crespo").
- NUNCA invente MARCA (BRAND). Se a marca não estiver explícita no contexto, devolva "". Proibido sugerir L'Oréal, Nivea, Dove, Garnier, Natura, Boticário, Johnson, Samsung, Apple, Nike etc.
- NUNCA invente GTIN/EAN. Se não houver, devolva "".
- NUNCA repita palavras do nome do produto em campos descritivos sem base real.
- NÃO use a MESMA palavra em campos diferentes. Cada atributo deve trazer informação distinta.

REGRA OBRIGATÓRIA — MULTI-seleção (${multiIdsInBatch.join(", ") || "nenhum nesta rodada"}):
- Quando "multi": true, MARQUE TODAS as opções de "values" que façam sentido para o produto (com base em nome + descrição + tipo + público).
- Exemplo (Tipos de cabelo): se o produto trata calvície, oleosidade e caspa → "Oleoso, Ralo, Crespo, Liso, Cacheado, Seco" (tudo que se aplica).
- Exemplo (Formatos de tratamento capilar): shampoo + bálsamo + loção → "Shampoo, Bálsamo, Loção" se forem aplicáveis.
- Quando em dúvida, prefira INCLUIR a EXCLUIR — mais opções = mais alcance no ML.

REGRA CRÍTICA — obrigatórios single-select de lista fechada (${requiredClosedListIds.join(", ") || "nenhum nesta rodada"}):
- NUNCA devolva vazio nem "NAO_SE_APLICA". Escolha SEMPRE um dos valores da lista "values".
- Para "Tipo de cuidado": cruze com tratamentos do produto (antiqueda, hidratação, anticaspa, antifrizz, antioleosidade). Se cobrir vários, escolha o PRINCIPAL pelo nome do produto.

REGRA OBRIGATÓRIA — cosméticos tri-state Sim/Não/Não se aplica (${cosmeticIdsInBatch.join(", ") || "nenhum nesta rodada"}):
- Se o produto sugerir o atributo, "Sim". Se sugerir o oposto, "Não". Se não fizer sentido, "Não se aplica". Senão "Não".

REGRA — atributos opcionais que claramente NÃO se aplicam ao produto:
- Use "NAO_SE_APLICA". Exemplos: Dosador num shampoo simples, Voltagem em cosmético, Fragrância em produto sem perfume, Tipo de couro em produto não-couro.

REGRA OBRIGATÓRIA — usar a FICHA COMPLETA do cadastro antes de marcar "NAO_SE_APLICA":
- Cruze NOME + descricao_curta + descricao_longa + tipo_cadastro + tipo_ia + funcao_principal + tratamentos + efeitos + tipos_cabelo + categoria_universal.
- Se QUALQUER um desses campos tem evidência sobre o atributo, RESPONDA com base nele. Só use "NAO_SE_APLICA" quando a ficha inteira não der pista alguma.
- Para "Tipo de produto" / "Tipo de tratamento" / "Tipo de cuidado": SEMPRE escolha a opção da lista oficial que mais se aproxima de tipo_cadastro/tipo_ia/funcao_principal/tratamentos. Nunca "NAO_SE_APLICA" se o cadastro tem o tipo do produto.

REGRA OBRIGATÓRIA — números regulatórios (ANVISA / AFE / CONAMA):
- Quando o atributo pedir "Número de notificação/comunicação prévia na Anvisa" ou "Número de registro de produto na Anvisa", use exatamente o valor de numeros_regulatorios.anvisa do cadastro (mantenha o formato original).
- Para "Certificado AFE": use numeros_regulatorios.afe. Para "Licença CONAMA": use numeros_regulatorios.conama.
- Só responda "NAO_SE_APLICA" quando o campo correspondente do cadastro estiver vazio.

Produto: ${JSON.stringify(productContext)}

Atributos a preencher: ${JSON.stringify(compact)}

Responda JSON: {"answers":[{"id":"...","value":"..."}]}. SEMPRE "value" como string.`;

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
          let parsed: any = {};
          try {
            parsed = typeof content === "string" ? JSON.parse(content) : content;
          } catch {
            console.warn("[meli-resolve-attributes] IA devolveu JSON inválido — lote ignorado");
            parsed = {};
          }
          const answers: any[] = Array.isArray(parsed?.answers) ? parsed.answers : [];
          for (const ans of answers) {
            try {
              const id = toSafeString(ans?.id);
              if (!id) continue;
              const value = toSafeString(ans?.value);
              allAnswers.set(id, value);
            } catch (e) {
              console.warn("[meli-resolve-attributes] resposta IA malformada ignorada:", (e as Error).message);
            }
          }
        } catch (e) {
          console.error("[meli-resolve-attributes] IA falhou no lote:", (e as Error).message);
        }
      }

      // Conjunto de palavras do nome do produto (para detectar repetição preguiçosa da IA)
      const productNameTokens = new Set(
        normalizeText(String(product.name ?? ""))
          .split(/[^a-z0-9]+/i)
          .filter(t => t.length >= 4)
      );
      const isJustRepeatingName = (val: string) => {
        const vTokens = normalizeText(val).split(/[^a-z0-9]+/i).filter(t => t.length >= 4);
        if (vTokens.length === 0) return false;
        return vTokens.every(t => productNameTokens.has(t));
      };

      for (const a of aiPending) {
        // Blindagem: nenhum atributo individual pode derrubar todos os outros.
        try {
          let suggested = toSafeString(allAnswers.get(a.id));
          const required = !!a.tags?.required || !!a.tags?.catalog_required;
          const isCosmeticTriState = COSMETIC_TRISTATE.has(a.id.toUpperCase());
          const hasClosedList = (a.values?.length ?? 0) > 0;
          const idUp = a.id.toUpperCase();

          // ANTI-ALUCINAÇÃO DE MARCA: se o produto não tem marca cadastrada,
          // nunca aceitar sugestão da IA para BRAND — vira "missing" obrigatório.
          if ((idUp === "BRAND") && !product.brand) {
            resolved.push({
              id: a.id, name: a.name,
              status: "missing", source: "none", required,
              message: "Preencha a marca no cadastro do produto antes de publicar.",
            });
            continue;
          }

          // Lista negra de marcas famosas inventadas pela IA.
          if (idUp === "BRAND" && suggested && isBlacklistedBrand(suggested)) {
            console.warn(`[meli-resolve-attributes] IA tentou marca de terceiros (${suggested}) — bloqueado.`);
            resolved.push({
              id: a.id, name: a.name,
              status: "missing", source: "none", required,
              message: "Preencha a marca no cadastro do produto antes de publicar.",
            });
            continue;
          }

          // v1.9.0 — IA marcou explicitamente "NAO_SE_APLICA"
          const isNotApplicableAnswer = (val: string) => {
            const n = val.toLowerCase().trim().replace(/[^a-z]/g, "");
            return n === "naoseaplica" || n === "noaplica" || n === "na" || n === "nse" || n === "notapplicable";
          };
          const aiSaysNotApplicable = !!suggested && isNotApplicableAnswer(suggested);

          // Anti-repetição preguiçosa: descritivos opcionais que apenas repetem o nome.
          if (!isCosmeticTriState && !required && suggested && !aiSaysNotApplicable && !hasClosedList && isJustRepeatingName(suggested)) {
            suggested = "";
          }

          // Anti-vazio para cosméticos tri-state.
          if (isCosmeticTriState) {
            const allowed = a.values?.map(v => v.name) ?? ["Sim", "Não", "Não se aplica"];
            const norm = (v: string) => v.toLowerCase().trim();
            const hit = suggested && !aiSaysNotApplicable ? allowed.find(v => norm(v) === norm(suggested)) : null;
            suggested = hit ?? (allowed.find(v => norm(v) === "não") || "Não");
          }

          // Fallback determinístico por tokens para QUALQUER atributo de lista fechada
          // (obrigatório OU opcional) quando o cadastro do produto tem pista clara.
          // Garante que campos como "Tipo de produto" não caiam em "Não se aplica"
          // quando o cadastro tem product_type/ai_product_type preenchido.
          if (hasClosedList && !isCosmeticTriState && !aiSaysNotApplicable) {
            const allowed = a.values!;
            const norm = (v: string) => v.toLowerCase().trim();
            let hit = suggested ? allowed.find(v => norm(v.name) === norm(suggested)) : null;
            if (!hit) {
              const cadastroSeeds = [
                product.product_type, product.ai_product_type, product.ai_main_function,
                product.line, product.model,
              ].filter(Boolean).join(" ");
              const hasCadastroEvidence = cadastroSeeds.trim().length > 0;
              // Para opcional sem evidência no cadastro e sem sugestão da IA, não força match.
              if (required || hasCadastroEvidence || suggested) {
                const seeds = [
                  product.name, cadastroSeeds, universalCategory?.name, suggested,
                ].filter(Boolean).join(" ").toLowerCase();
                const tokens = seeds.split(/[^a-záàâãéêíïóôõöúüç0-9]+/i).filter(t => t.length >= 3);
                let best: { v: { id: string; name: string }; score: number } | null = null;
                for (const v of allowed) {
                  const vTokens = v.name.toLowerCase().split(/[^a-záàâãéêíïóôõöúüç0-9]+/i).filter(t => t.length >= 3);
                  let score = 0;
                  for (const vt of vTokens) {
                    if (tokens.includes(vt)) score += 2;
                    else if (tokens.some(t => t.includes(vt) || vt.includes(t))) score += 1;
                  }
                  if (score > 0 && (!best || score > best.score)) best = { v, score };
                }
                // Para opcional, exige score mínimo 2 (uma correspondência exata) — evita N/A indevido sem inventar.
                const minScore = required ? 1 : 2;
                if (best && best.score >= minScore) {
                  suggested = best.v.name;
                  console.log(`[meli-resolve-attributes] token-match (${required ? "obrig" : "opc"}): ${a.id}="${best.v.name}" (score=${best.score})`);
                }
              }
            }
          }

          // v1.9.0 — Marca obrigatórios sem valor como missing (continua).
          // Para opcionais sem valor OU marcados "NAO_SE_APLICA": emite como "Não se aplica".
          const emitNotApplicable = () => {
            // Procura opção "Não se aplica" na lista oficial da categoria
            const naHit = a.values?.find(v => {
              const n = v.name.toLowerCase().trim();
              return n === "não se aplica" || n === "nao se aplica" || n === "no aplica" || n === "n/a";
            });
            resolved.push({
              id: a.id, name: a.name,
              value_name: naHit?.name ?? "Não se aplica",
              value_id: naHit?.id,
              status: "filled", source: "ai", required,
              not_applicable: true,
            });
          };

          if (aiSaysNotApplicable) {
            if (required && !isCosmeticTriState) {
              // Obrigatório não pode ser N/A — vira missing para o lojista resolver.
              resolved.push({
                id: a.id, name: a.name,
                status: "missing", source: "none", required: true,
                message: friendlyMissingMessage(a),
              });
            } else {
              emitNotApplicable();
            }
            continue;
          }

          if (suggested) {
            const isMulti = isMultiValuedSpec(a);
            if (isMulti) {
              const pieces = suggested.split(",").map(s => s.trim()).filter(Boolean);
              const valuesArr: Array<{ id?: string; name: string }> = [];
              for (const p of pieces) {
                if (a.values?.length) {
                  const hit = matchAllowedValue(a, p);
                  if (hit) valuesArr.push({ id: hit.id, name: hit.name });
                } else {
                  valuesArr.push({ name: p });
                }
              }
              if (valuesArr.length > 0) {
                resolved.push({
                  id: a.id, name: a.name,
                  value_name: valuesArr.map(v => v.name).join(", "),
                  values: valuesArr,
                  status: "filled", source: "ai", required,
                });
              } else if (required) {
                resolved.push({
                  id: a.id, name: a.name,
                  status: "missing", source: "none", required: true,
                  message: friendlyMissingMessage(a),
                });
              } else {
                emitNotApplicable();
              }
              continue;
            }
            let value_id: string | undefined;
            if (a.values?.length) {
              const hit = matchAllowedValue(a, suggested);
              if (hit) value_id = hit.id;
            }
            if (required && hasClosedList && !value_id && !isCosmeticTriState) {
              resolved.push({
                id: a.id, name: a.name,
                status: "missing", source: "none", required: true,
                message: friendlyMissingMessage(a),
              });
            } else if (required && hasClosedList && !value_id) {
              continue;
            } else {
              if (!required && a.values?.length && !value_id) {
                // Valor sugerido fora da lista oficial → trata como N/A
                emitNotApplicable();
                continue;
              }
              resolved.push({
                id: a.id, name: a.name, value_name: suggested, value_id,
                status: "filled",
                source: "ai",
                required,
              });
            }
          } else if (required) {
            resolved.push({
              id: a.id, name: a.name,
              status: "missing", source: "none", required: true,
              message: friendlyMissingMessage(a),
            });
          } else {
            // v1.9.0 — opcional sem valor: marca "Não se aplica" para enviar ao ML
            emitNotApplicable();
          }
        } catch (e) {
          console.error(`[meli-resolve-attributes] falha ao processar atributo ${a.id}:`, (e as Error).message);
          // Não derruba o produto inteiro — segue para o próximo atributo.
          if (a.tags?.required || a.tags?.catalog_required) {
            resolved.push({
              id: a.id, name: a.name,
              status: "missing", source: "none", required: true,
              message: friendlyMissingMessage(a),
            });
          }
        }
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
