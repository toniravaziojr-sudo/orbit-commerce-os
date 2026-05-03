/**
 * ai-context-product-preview
 *
 * ONDA A — Saúde do Contexto da IA / Preview de Inteligência Comercial.
 *
 * Diagnóstico SOMENTE LEITURA. Sob demanda. Não escreve em
 * ai_product_commercial_payload, não altera comportamento da IA em produção,
 * não é chamada pelo atendimento real.
 *
 * Para cada produto pedido, infere (com IA) papel comercial sugerido,
 * necessidades, casos de uso, se é pack/bundle, possível produto-base e
 * complementares — usando o playbook do segmento detectado em
 * ai_business_snapshot.niche_primary (sem hardcode por tenant).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const MAX_PRODUCTS = 10; // limite por chamada

interface PreviewItem {
  product_id: string;
  product_name: string;
  product_role: string | null;
  customer_needs: string[];
  use_cases: string[];
  is_pack_or_bundle: boolean;
  base_product_id: string | null;
  base_product_name: string | null;
  complementary_product_ids: string[];
  confidence_score: number;
  reasoning: string;
  gap?: string;
}

function detectSegment(niche?: string | null): string {
  if (!niche) return "cosmeticos";
  const n = niche.toLowerCase();
  if (/cosm|capil|skin|beleza|barba|cabelo|shampoo/.test(n)) return "cosmeticos";
  if (/eletr|tech|gadget|inform/.test(n)) return "eletronicos";
  if (/moda|roupa|cal[çc]ad/.test(n)) return "moda";
  if (/pet|ra[çc][aã]o|petshop/.test(n)) return "pet";
  return "cosmeticos";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autenticado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const tenant_id: string = body.tenant_id;
    const limit = Math.min(Number(body.limit) || 5, MAX_PRODUCTS);
    const filter: "all" | "no_semantics" | "low_confidence" = body.filter || "all";

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Valida acesso ao tenant via RLS (consulta simples)
    const { data: access, error: accessErr } = await userClient
      .from("tenants").select("id").eq("id", tenant_id).maybeSingle();
    if (accessErr || !access) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso ao tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Carrega catálogo + payload existente
    const { data: products } = await admin
      .from("products")
      .select("id, name, short_description, price, tags, product_type")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name");

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ success: true, items: [], segment: null, total: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = products.map((p) => p.id);
    const { data: payloads } = await admin
      .from("ai_product_commercial_payload")
      .select("product_id, commercial_role, short_pitch, confidence_score")
      .in("product_id", ids);
    const payloadMap = new Map((payloads || []).map((p) => [p.product_id, p]));

    const { data: components } = await admin
      .from("product_components")
      .select("parent_product_id, component_product_id, quantity")
      .in("parent_product_id", ids);

    // Filtra
    let candidates = products;
    if (filter === "no_semantics") {
      candidates = products.filter((p) => !payloadMap.get(p.id)?.short_pitch);
    } else if (filter === "low_confidence") {
      candidates = products.filter((p) => {
        const pl = payloadMap.get(p.id);
        return !pl || (pl.confidence_score || 0) < 60;
      });
    }
    const totalMatching = candidates.length;
    candidates = candidates.slice(0, limit);

    // Detecta segmento
    const { data: snap } = await admin
      .from("ai_business_snapshot")
      .select("niche_primary")
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    const segmentSlug = detectSegment(snap?.niche_primary);

    const { data: playbook } = await admin
      .from("ai_segment_playbooks")
      .select("*")
      .eq("segment_slug", segmentSlug)
      .maybeSingle();

    const items: PreviewItem[] = [];

    if (!LOVABLE_API_KEY) {
      // Fallback: heurística sem IA
      for (const p of candidates) {
        const isPack = /\b(2|3|6|12)\s*(x|un|unidades?)\b|\b(combo|kit|duo|trio)\b/i.test(p.name);
        items.push({
          product_id: p.id,
          product_name: p.name,
          product_role: null,
          customer_needs: [],
          use_cases: [],
          is_pack_or_bundle: isPack || (components || []).some((c) => c.parent_product_id === p.id),
          base_product_id: null,
          base_product_name: null,
          complementary_product_ids: [],
          confidence_score: 0,
          reasoning: "IA Gateway indisponível — heurística básica.",
          gap: "Inferência IA indisponível neste ambiente.",
        });
      }
      return new Response(
        JSON.stringify({
          success: true, items, segment: segmentSlug,
          total: totalMatching, ai_used: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allNamesById: Record<string, string> = {};
    for (const p of products) allNamesById[p.id] = p.name;

    const prompt = `Você é um classificador de catálogo. Segmento: "${segmentSlug}".
Vocabulário oficial de papéis (use APENAS estes valores em product_role):
${JSON.stringify(playbook?.role_taxonomy || [])}

Padrões de pack: ${JSON.stringify(playbook?.pack_patterns || [])}
Regras de complementaridade: ${JSON.stringify(playbook?.complementarity_rules || [])}

Catálogo completo do tenant (id → nome):
${JSON.stringify(allNamesById, null, 0)}

Para cada produto da lista a seguir, retorne JSON estrito:
{ "items": [
  { "product_id": "...", "product_role": "<um dos valores do vocabulário ou null>",
    "customer_needs": ["..."], "use_cases": ["..."],
    "is_pack_or_bundle": true|false, "base_product_id": "<id do produto-base se for pack, ou null>",
    "complementary_product_ids": ["..."], "confidence_score": 0-100,
    "reasoning": "frase curta" }
] }

Regras:
- Se for variação de quantidade (2x/3x/6x), is_pack_or_bundle=true e base_product_id aponta para o produto 1x equivalente.
- Se nome incluir "kit"/"combo", is_pack_or_bundle=true.
- Se não houver dados suficientes, confidence_score < 60 e reasoning explica a lacuna.
- Não invente IDs: só use IDs presentes no catálogo.

Produtos a classificar:
${JSON.stringify(candidates.map((p) => ({ id: p.id, name: p.name, short: p.short_description, tags: p.tags })))}
`;

    const aiRes = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `IA Gateway erro ${aiRes.status}`,
          detail: await aiRes.text().catch(() => ""),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { items: [] }; }

    for (const raw of parsed.items || []) {
      const product = candidates.find((p) => p.id === raw.product_id);
      if (!product) continue;
      const baseId = raw.base_product_id && allNamesById[raw.base_product_id] ? raw.base_product_id : null;
      items.push({
        product_id: product.id,
        product_name: product.name,
        product_role: raw.product_role || null,
        customer_needs: Array.isArray(raw.customer_needs) ? raw.customer_needs : [],
        use_cases: Array.isArray(raw.use_cases) ? raw.use_cases : [],
        is_pack_or_bundle: !!raw.is_pack_or_bundle,
        base_product_id: baseId,
        base_product_name: baseId ? allNamesById[baseId] : null,
        complementary_product_ids: (raw.complementary_product_ids || []).filter(
          (id: string) => allNamesById[id],
        ),
        confidence_score: Math.max(0, Math.min(100, Number(raw.confidence_score) || 0)),
        reasoning: String(raw.reasoning || ""),
        gap: (Number(raw.confidence_score) || 0) < 60
          ? "Produto sem semântica suficiente — precisa de aprovação/configuração na Onda B."
          : undefined,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        items,
        segment: segmentSlug,
        total: totalMatching,
        ai_used: true,
        playbook_loaded: !!playbook,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ai-context-product-preview error", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
