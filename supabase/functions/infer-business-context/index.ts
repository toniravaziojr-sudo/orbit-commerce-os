// ============================================================
// infer-business-context
// Pacotes A + B + C + G — Inferência automática de contexto
//
// Lê o catálogo do tenant e monta:
//  - Árvore de negócio (segmento → público → macro → sub → tipo → dores)
//  - Nível de confiança por nível (alta/media/baixa)
//  - Mapa N:N produto ↔ dor (em product_pain_points)
//  - Detecção de "catálogo incompleto" → modo neutro (Pacote G)
//
// Estratégia híbrida:
//  - Determinística (rápida, barata, robusta): contagem + tokens
//  - IA (Gemini Flash via Lovable Gateway): enriquece dores e nomes canônicos
//    Se a IA falhar, segue só com determinístico (tolerante a falha).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// ----------------------------- Tipos -----------------------------

type Confidence = "alta" | "media" | "baixa";

interface Product {
  id: string;
  name: string | null;
  description: string | null;
  short_description: string | null;
  product_type: string | null;
  brand: string | null;
  tags: string[] | null;
  status: string;
}

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
}

interface InferredTree {
  segment: { value: string | null; confidence: Confidence; evidence_count: number };
  audience: { value: string | null; confidence: Confidence; evidence_count: number };
  macro_categories: Array<{ name: string; confidence: Confidence; product_count: number }>;
  subcategories: Array<{ macro: string | null; name: string; product_count: number }>;
  product_types: Array<{ subcategory: string | null; name: string; product_count: number }>;
  pain_points: Array<{
    name: string;
    synonyms: string[];
    confidence: Confidence;
    product_count: number;
  }>;
  generated_at: string;
}

// ------------------------ Heurísticas base ------------------------

const SEGMENT_KEYWORDS: Record<string, string[]> = {
  beleza: [
    "shampoo", "condicionador", "cabelo", "barba", "pele", "creme", "hidratante",
    "perfume", "maquiagem", "batom", "esmalte", "cosmetico", "cosmético",
    "tratamento capilar", "anticaspa", "antiqueda", "loção", "tônico"
  ],
  moda: [
    "camisa", "camiseta", "calça", "calca", "vestido", "tênis", "tenis", "sapato",
    "bolsa", "jaqueta", "blusa", "short", "saia", "moletom", "chinelo", "sandalia",
    "sandália", "regata", "bermuda", "casaco"
  ],
  eletronico: [
    "fone", "headphone", "celular", "smartphone", "carregador", "cabo", "bateria",
    "notebook", "tablet", "smartwatch", "tv", "monitor", "mouse", "teclado",
    "câmera", "camera", "caixa de som", "bluetooth", "usb"
  ],
  pet: [
    "ração", "racao", "petisco", "coleira", "guia", "areia", "cachorro", "gato",
    "pet", "tapete higiênico", "snack pet", "shampoo pet", "ração canina"
  ],
  casa: [
    "panela", "prato", "talher", "lençol", "lencol", "toalha", "almofada",
    "cortina", "tapete", "edredom", "vaso", "decoração", "decoracao", "luminária",
    "luminaria", "móvel", "movel"
  ],
  suplemento: [
    "whey", "proteína", "proteina", "creatina", "bcaa", "vitamina", "colágeno",
    "colageno", "termogênico", "termogenico", "pré-treino", "pre-treino", "ômega",
    "omega"
  ],
  intimo: [
    "íntimo", "intimo", "lingerie", "calcinha", "sutiã", "sutia", "cueca",
    "preservativo", "lubrificante", "gel íntimo"
  ],
  alimento: [
    "chocolate", "biscoito", "café", "cafe", "achocolatado", "leite", "doce",
    "salgado", "tempero", "condimento"
  ],
  acessorio: [
    "relógio", "relogio", "óculos", "oculos", "pulseira", "colar", "anel",
    "brinco", "carteira", "boné", "bone", "chapéu", "chapeu"
  ],
  saude: [
    "termômetro", "termometro", "máscara", "mascara", "álcool", "alcool gel",
    "curativo", "vitamina", "remédio", "medicamento", "fralda"
  ],
};

const AUDIENCE_HINTS: Record<string, string[]> = {
  masculino: [
    "masculino", "homem", "men", "barba", "cueca", "para ele", "respeite o homem"
  ],
  feminino: [
    "feminino", "mulher", "women", "calcinha", "sutiã", "sutia", "para ela",
    "lingerie"
  ],
  infantil: ["infantil", "kids", "criança", "crianca", "bebê", "bebe", "baby"],
};

const PAIN_DICTIONARY: Record<string, { name: string; synonyms: string[]; segments: string[] }> = {
  queda: {
    name: "queda de cabelo",
    synonyms: ["queda", "antiqueda", "anti-queda", "fortalecimento capilar"],
    segments: ["beleza"],
  },
  calvicie: {
    name: "calvície",
    synonyms: ["calvicie", "calvície", "alopecia", "falhas no cabelo", "coroa"],
    segments: ["beleza"],
  },
  caspa: {
    name: "caspa",
    synonyms: ["caspa", "anticaspa", "anti-caspa", "dermatite seborreica"],
    segments: ["beleza"],
  },
  oleosidade: {
    name: "oleosidade",
    synonyms: ["oleosidade", "oleoso", "controle de oleosidade", "cabelo oleoso"],
    segments: ["beleza"],
  },
  hidratacao: {
    name: "hidratação",
    synonyms: ["hidratação", "hidratacao", "hidratante", "ressecamento"],
    segments: ["beleza"],
  },
  crescimento: {
    name: "crescimento capilar",
    synonyms: ["crescimento", "estimula crescimento", "acelera crescimento"],
    segments: ["beleza"],
  },
  barba: {
    name: "cuidado com barba",
    synonyms: ["barba", "balm", "óleo de barba", "oleo de barba", "shampoo de barba"],
    segments: ["beleza"],
  },
  acne: {
    name: "acne / espinhas",
    synonyms: ["acne", "espinha", "cravos", "antiacne"],
    segments: ["beleza", "saude"],
  },
  envelhecimento: {
    name: "anti-idade",
    synonyms: ["antirrugas", "anti-rugas", "anti-idade", "antienvelhecimento", "ruga"],
    segments: ["beleza"],
  },
  amortecimento: {
    name: "amortecimento / conforto",
    synonyms: ["amortecimento", "conforto", "corrida", "impacto"],
    segments: ["moda"],
  },
  cancelamento_ruido: {
    name: "cancelamento de ruído",
    synonyms: ["cancelamento de ruído", "noise cancelling", "anc"],
    segments: ["eletronico"],
  },
  ganho_massa: {
    name: "ganho de massa muscular",
    synonyms: ["ganho de massa", "hipertrofia", "anabolismo", "whey"],
    segments: ["suplemento"],
  },
  emagrecimento: {
    name: "emagrecimento",
    synonyms: ["emagrecer", "termogênico", "termogenico", "queima de gordura"],
    segments: ["suplemento"],
  },
};

// ------------------------ Funções utilitárias ------------------------

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function productHaystack(p: Product): string {
  return [
    p.name,
    p.short_description,
    p.description,
    p.product_type,
    p.brand,
    ...(p.tags || []),
  ]
    .filter(Boolean)
    .map(normalize)
    .join(" ");
}

function bucketConfidence(count: number, total: number): Confidence {
  if (total === 0) return "baixa";
  const pct = count / total;
  if (count >= 8 && pct >= 0.4) return "alta";
  if (count >= 3 && pct >= 0.15) return "media";
  return "baixa";
}

// ------------------------ Inferência determinística ------------------------

function inferSegment(products: Product[]): {
  value: string | null;
  confidence: Confidence;
  evidence_count: number;
} {
  const scores: Record<string, number> = {};
  for (const p of products) {
    const hay = productHaystack(p);
    for (const [seg, kws] of Object.entries(SEGMENT_KEYWORDS)) {
      let hits = 0;
      for (const kw of kws) {
        if (hay.includes(normalize(kw))) hits++;
      }
      if (hits > 0) scores[seg] = (scores[seg] || 0) + hits;
    }
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (!sorted.length) return { value: null, confidence: "baixa", evidence_count: 0 };

  const [topSeg, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] || 0;

  // Confiança: alta se domina (>2x do segundo) e tem volume; média se domina parcial; baixa caso contrário
  let confidence: Confidence = "baixa";
  if (topScore >= 10 && topScore >= secondScore * 2) confidence = "alta";
  else if (topScore >= 5 && topScore > secondScore) confidence = "media";

  return { value: topSeg, confidence, evidence_count: topScore };
}

function inferAudience(products: Product[]): {
  value: string | null;
  confidence: Confidence;
  evidence_count: number;
} {
  const scores: Record<string, number> = {};
  for (const p of products) {
    const hay = productHaystack(p);
    for (const [aud, hints] of Object.entries(AUDIENCE_HINTS)) {
      for (const h of hints) {
        if (hay.includes(normalize(h))) {
          scores[aud] = (scores[aud] || 0) + 1;
        }
      }
    }
  }

  const total = products.length;
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (!sorted.length) {
    // Sem sinal forte → "ambos" com baixa confiança
    return { value: "ambos", confidence: "baixa", evidence_count: 0 };
  }

  const [top, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] || 0;

  // Se masculino e feminino ambos aparecem com força → "ambos"
  const masc = scores.masculino || 0;
  const fem = scores.feminino || 0;
  if (masc > 0 && fem > 0 && Math.min(masc, fem) / Math.max(masc, fem) > 0.5) {
    return { value: "ambos", confidence: "media", evidence_count: masc + fem };
  }

  let confidence: Confidence = "baixa";
  if (topScore >= 10 && topScore / Math.max(total, 1) >= 0.3) confidence = "alta";
  else if (topScore >= 3) confidence = "media";

  return { value: top, confidence, evidence_count: topScore };
}

function inferMacroCategories(
  products: Product[],
  categories: CategoryRow[],
  productCategoryMap: Map<string, string[]>,
): Array<{ name: string; confidence: Confidence; product_count: number }> {
  // Macro = categorias raiz (parent_id = null) com produtos vinculados
  const rootMap = new Map<string, string>(); // categoryId → name
  const childToRoot = new Map<string, string>(); // categoryId → rootId
  for (const c of categories) {
    if (!c.parent_id) {
      rootMap.set(c.id, c.name);
      childToRoot.set(c.id, c.id);
    }
  }
  // Resolve filhas para a raiz
  for (const c of categories) {
    if (c.parent_id) {
      let cur: CategoryRow | undefined = c;
      const visited = new Set<string>();
      while (cur && cur.parent_id && !visited.has(cur.id)) {
        visited.add(cur.id);
        cur = categories.find((x) => x.id === cur!.parent_id);
      }
      if (cur && !cur.parent_id) {
        childToRoot.set(c.id, cur.id);
      }
    }
  }

  const counts = new Map<string, number>();
  for (const p of products) {
    const cats = productCategoryMap.get(p.id) || [];
    const seenRoots = new Set<string>();
    for (const cid of cats) {
      const rootId = childToRoot.get(cid);
      if (rootId && !seenRoots.has(rootId)) {
        counts.set(rootId, (counts.get(rootId) || 0) + 1);
        seenRoots.add(rootId);
      }
    }
  }

  const total = products.length;
  return Array.from(counts.entries())
    .map(([rootId, count]) => ({
      name: rootMap.get(rootId) || "(sem nome)",
      product_count: count,
      confidence: bucketConfidence(count, total),
    }))
    .sort((a, b) => b.product_count - a.product_count);
}

function inferPainPoints(
  products: Product[],
  segment: string | null,
): {
  painList: Array<{ name: string; synonyms: string[]; confidence: Confidence; product_count: number }>;
  productPainMap: Map<string, Array<{ pain: string; weight: number }>>;
} {
  const painProductCounts = new Map<string, number>();
  const productPainMap = new Map<string, Array<{ pain: string; weight: number }>>();

  for (const p of products) {
    const hay = productHaystack(p);
    const pains: Array<{ pain: string; hits: number }> = [];

    for (const [, dict] of Object.entries(PAIN_DICTIONARY)) {
      // Filtra dores que se aplicam a esse segmento (ou sem segmento → vale para todos)
      if (segment && dict.segments.length && !dict.segments.includes(segment)) continue;

      let hits = 0;
      for (const syn of [dict.name, ...dict.synonyms]) {
        const n = normalize(syn);
        if (hay.includes(n)) hits++;
      }
      if (hits > 0) pains.push({ pain: dict.name, hits });
    }

    if (pains.length) {
      // Ordena por hits — primeiro vira principal (peso 1.0), os outros secundários (0.5)
      pains.sort((a, b) => b.hits - a.hits);
      const map: Array<{ pain: string; weight: number }> = [];
      pains.forEach((px, i) => {
        const weight = i === 0 ? 1.0 : i === 1 ? 0.5 : 0.3;
        map.push({ pain: px.pain, weight });
        painProductCounts.set(px.pain, (painProductCounts.get(px.pain) || 0) + 1);
      });
      productPainMap.set(p.id, map);
    }
  }

  const total = products.length;
  const painList = Array.from(painProductCounts.entries())
    .map(([name, count]) => {
      const dictEntry = Object.values(PAIN_DICTIONARY).find((d) => d.name === name);
      return {
        name,
        synonyms: dictEntry?.synonyms || [],
        product_count: count,
        confidence: bucketConfidence(count, total),
      };
    })
    .sort((a, b) => b.product_count - a.product_count);

  return { painList, productPainMap };
}

function detectIncompleteCatalog(products: Product[]): { incomplete: boolean; reason: string | null } {
  if (products.length === 0) {
    return { incomplete: true, reason: "Catálogo vazio: nenhum produto ativo encontrado." };
  }
  if (products.length < 3) {
    return {
      incomplete: true,
      reason: `Poucos produtos ativos (${products.length}). A IA precisa de pelo menos 3 produtos para entender bem o catálogo.`,
    };
  }

  // Quantos produtos têm descrição mínima?
  const withDescription = products.filter(
    (p) => (p.description?.length || 0) + (p.short_description?.length || 0) >= 30,
  ).length;
  const descPct = withDescription / products.length;

  if (descPct < 0.3) {
    return {
      incomplete: true,
      reason: `Apenas ${Math.round(descPct * 100)}% dos produtos têm descrição. Adicione descrições para a IA entender o que cada produto resolve.`,
    };
  }

  return { incomplete: false, reason: null };
}

function calcOverallConfidence(tree: InferredTree): Confidence {
  // Confiança global = pior caso entre segmento e (presença de macro/dores com média+)
  const segConf = tree.segment.confidence;
  const hasMacroOrPainMid =
    tree.macro_categories.some((m) => m.confidence !== "baixa") ||
    tree.pain_points.some((p) => p.confidence !== "baixa");

  if (segConf === "alta" && hasMacroOrPainMid) return "alta";
  if (segConf === "alta" || (segConf === "media" && hasMacroOrPainMid)) return "media";
  return "baixa";
}

// ------------------------ Enriquecimento opcional via IA ------------------------

async function enrichWithAI(
  tree: InferredTree,
  sampleProducts: Product[],
): Promise<Partial<InferredTree>> {
  if (!LOVABLE_API_KEY) return {};
  try {
    const productSample = sampleProducts.slice(0, 20).map((p) => ({
      name: p.name,
      short: p.short_description?.slice(0, 120) || null,
    }));

    const prompt = `Você é um analista de catálogo. Receba uma amostra de produtos de uma loja e devolva APENAS JSON válido com:
{
  "additional_pain_points": [{"name": "...", "synonyms": ["..."]}],
  "audience_hint": "masculino" | "feminino" | "ambos" | "infantil" | null,
  "segment_hint": "beleza" | "moda" | "eletronico" | "pet" | "casa" | "suplemento" | "intimo" | "alimento" | "acessorio" | "saude" | null
}
Não inclua texto fora do JSON. Sugira no máximo 5 dores adicionais que NÃO estejam nesta lista já detectada: ${tree.pain_points.map((p) => p.name).join(", ") || "(nenhuma)"}.

Produtos:
${JSON.stringify(productSample)}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!resp.ok) {
      console.warn("[infer-business-context] AI enrich HTTP", resp.status);
      return {};
    }
    const data = await resp.json();
    const txt: string = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};
    const parsed = JSON.parse(jsonMatch[0]);

    const additionalPains = Array.isArray(parsed.additional_pain_points)
      ? parsed.additional_pain_points
          .filter((x: any) => x && typeof x.name === "string")
          .map((x: any) => ({
            name: String(x.name).slice(0, 80),
            synonyms: Array.isArray(x.synonyms) ? x.synonyms.slice(0, 8).map(String) : [],
            confidence: "baixa" as Confidence,
            product_count: 0,
          }))
      : [];

    const result: Partial<InferredTree> = {};
    if (additionalPains.length) {
      result.pain_points = [...tree.pain_points, ...additionalPains];
    }
    return result;
  } catch (e) {
    console.warn("[infer-business-context] AI enrich failed:", (e as Error).message);
    return {};
  }
}

// ------------------------ Persistência do mapa N:N ------------------------

async function persistPainPoints(
  supabase: any,
  tenantId: string,
  productPainMap: Map<string, Array<{ pain: string; weight: number }>>,
): Promise<void> {
  // Delete só os 'inferred' (preserva 'manual')
  await supabase
    .from("product_pain_points")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("source", "inferred");

  const rows: Array<{ tenant_id: string; product_id: string; pain_point: string; weight: number; source: string }> = [];
  for (const [productId, pains] of productPainMap.entries()) {
    for (const { pain, weight } of pains) {
      rows.push({
        tenant_id: tenantId,
        product_id: productId,
        pain_point: pain,
        weight,
        source: "inferred",
      });
    }
  }

  if (!rows.length) return;

  // Insert em batch (chunks de 500)
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("product_pain_points").upsert(chunk, {
      onConflict: "tenant_id,product_id,pain_point",
      ignoreDuplicates: false,
    });
    if (error) {
      console.warn("[infer-business-context] pain points upsert error:", error.message);
    }
  }
}

// ----------------------------- Handler -----------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, force } = await req.json().catch(() => ({}));
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Pula se não precisa regenerar (a menos que force=true)
    if (!force) {
      const { data: existing } = await supabase
        .from("tenant_business_context")
        .select("needs_regeneration, last_inferred_at")
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      if (existing && !existing.needs_regeneration) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "no_regeneration_needed",
            last_inferred_at: existing.last_inferred_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 1) Carrega catálogo ativo
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, description, short_description, product_type, brand, tags, status")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(2000);

    if (prodErr) throw new Error(`products query: ${prodErr.message}`);
    const productList = (products || []) as Product[];

    // 2) Carrega categorias
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, parent_id")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    // 3) Carrega vínculos produto↔categoria
    const productIds = productList.map((p) => p.id);
    const productCategoryMap = new Map<string, string[]>();
    if (productIds.length) {
      const { data: links } = await supabase
        .from("product_categories")
        .select("product_id, category_id")
        .in("product_id", productIds);
      for (const l of links || []) {
        const arr = productCategoryMap.get(l.product_id) || [];
        arr.push(l.category_id);
        productCategoryMap.set(l.product_id, arr);
      }
    }

    // 4) Detecta catálogo incompleto (Pacote G)
    const incomplete = detectIncompleteCatalog(productList);

    // 5) Inferência determinística
    const segment = inferSegment(productList);
    const audience = inferAudience(productList);
    const macros = inferMacroCategories(productList, (categories || []) as CategoryRow[], productCategoryMap);
    const { painList, productPainMap } = inferPainPoints(productList, segment.value);

    let tree: InferredTree = {
      segment,
      audience,
      macro_categories: macros,
      subcategories: [], // Fase 2 vai detalhar a partir das categorias filhas
      product_types: [], // Fase 2 idem
      pain_points: painList,
      generated_at: new Date().toISOString(),
    };

    // 6) Enriquecimento via IA (opcional, tolerante a falha)
    if (productList.length >= 3) {
      const enriched = await enrichWithAI(tree, productList);
      if (enriched.pain_points) tree.pain_points = enriched.pain_points;
    }

    // 7) Confiança global
    const overallConfidence = calcOverallConfidence(tree);

    // 8) Persiste contexto
    const { error: upErr } = await supabase
      .from("tenant_business_context")
      .upsert(
        {
          tenant_id,
          inferred_tree: tree as unknown as Record<string, unknown>,
          overall_confidence: overallConfidence,
          catalog_incomplete: incomplete.incomplete,
          catalog_incomplete_reason: incomplete.reason,
          needs_regeneration: false,
          last_inferred_at: new Date().toISOString(),
          last_inference_error: null,
          product_count_snapshot: productList.length,
        },
        { onConflict: "tenant_id" },
      );

    if (upErr) throw new Error(`context upsert: ${upErr.message}`);

    // 9) Persiste mapa N:N de dores (Pacote C)
    if (productPainMap.size > 0) {
      await persistPainPoints(supabase, tenant_id, productPainMap);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id,
        overall_confidence: overallConfidence,
        catalog_incomplete: incomplete.incomplete,
        catalog_incomplete_reason: incomplete.reason,
        product_count: productList.length,
        segment: tree.segment.value,
        audience: tree.audience.value,
        macro_count: tree.macro_categories.length,
        pain_point_count: tree.pain_points.length,
        pain_points_persisted: productPainMap.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[infer-business-context] error:", msg);
    // Marca erro mas não derruba — mantém needs_regeneration true para retry
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.tenant_id) {
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        await sb
          .from("tenant_business_context")
          .upsert(
            { tenant_id: body.tenant_id, last_inference_error: msg.slice(0, 500) },
            { onConflict: "tenant_id" },
          );
      }
    } catch (_) { /* tolerante */ }
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
