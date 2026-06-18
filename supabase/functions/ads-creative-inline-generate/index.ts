// =============================================================================
// ads-creative-inline-generate — Onda H.4.5
//
// Mudanças vs H.4.4:
//   - Briefing enriquecido: produto real (cadastro), conjunto vinculado
//     (etapa do funil + tipo de público), promessa/ângulo, voz do tenant
//     (tenant_brand_context + ai_support_config) e últimos aprendizados
//     de copy (ads_ai_learnings).
//   - Regras duras anti-alucinação: proibido inventar oferta/desconto/
//     garantia/prazo/claim regulado; proibido vocabulário de outro nicho;
//     proibido clichês ("ofertas exclusivas", "renove seu guarda-roupa",
//     "qualidade e preço justo", "compre o seu agora").
//   - Diretrizes por estágio (frio/morno/quente) para copy aderente
//     ao funil — TOF não fala em "compre agora", BOF pode fechar.
//
// Ações suportadas (inalteradas):
//   "generate_copy"     — gera título + texto principal + descrição do zero.
//   "regen_copy_field"  — regenera apenas um campo, com feedback >=5 chars
//                         (feedback registrado em ads_ai_learnings).
//   "generate_image"    — gera imagem do criativo (sem feedback).
//   "regen_image"       — regenera imagem com feedback obrigatório.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletion } from "../_shared/ai-router.ts";

const COPY_MODEL = "google/gemini-2.5-pro";

const COPYWRITER_PERSONA = `Você é um copywriter sênior brasileiro especializado em anúncios de performance (Meta Ads), com 10+ anos escrevendo para e-commerce. Sua copy é:
- Em português do Brasil coloquial e natural — fala como brasileiro fala, não traduzido do inglês.
- Específica e sensorial: cita o produto, a dor concreta, o benefício real — nunca categoria vaga.
- Com gancho forte no início (pergunta provocativa, dado, contraste, dor nomeada, cena concreta).
- Ritmo variado: frase curta + frase média. Verbo no começo. Sem encheção, sem advérbio fraco ("realmente", "muito", "super").
- Sem clichê de e-commerce ("aproveite", "ofertas exclusivas", "qualidade e preço justo", "renove seu guarda-roupa", "tudo em um só lugar", "descubra hoje").
- Sem cara de IA: nada de "no mundo de hoje", "imagine só", "transforme sua vida", "eleve seu", "potencialize", "desbloqueie".
- Frameworks que você domina: AIDA, PAS (Problema-Agitação-Solução), 4Us (útil, urgente, único, ultra-específico), Before/After/Bridge. Use o adequado ao estágio.
- Diretrizes por estágio: TOF = dor/curiosidade sem CTA de compra; MOF = prova/diferencial; BOF = fechamento direto.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function recordLearning(
  supabase: any,
  tenantId: string,
  actionId: string,
  userId: string,
  subtype: "creative_image_feedback" | "creative_copy_feedback",
  title: string,
  description: string,
  metadata: Record<string, unknown>,
) {
  // Mapeia para as categorias oficiais usadas na UI de Aprendizados.
  // copy de anúncio -> "copy"; imagem de anúncio -> "criativo".
  const category = subtype === "creative_copy_feedback" ? "copy" : "criativo";
  try {
    const { error } = await supabase.from("ads_ai_learnings").insert({
      tenant_id: tenantId,
      title,
      description,
      category,
      status: "active",
      source_type: "user_feedback",
      source_action_id: actionId,
      evidence_count: 1,
      confidence: 0.8,
      created_by: userId,
      metadata: { ...metadata, subtype },
    });
    if (error) {
      console.error("[ads-creative-inline-generate] learning insert rejected:", error);
    }
  } catch (e) {
    console.error("[ads-creative-inline-generate] learning insert failed:", e);
  }

}

// ---------- Briefing enriquecido ----------
function inferStageFromAdset(adset: any, campaign: any): "cold" | "warm" | "hot" {
  const raw = String(
    adset?.funnel_stage || adset?.stage || campaign?.funnel_stage || campaign?.funnel || "",
  ).toLowerCase();
  if (/(^|[^a-z])(bof|hot|retarget|remarket|quente|fundo)/.test(raw)) return "hot";
  if (/(mof|warm|morno|meio)/.test(raw)) return "warm";
  if (/(tof|cold|frio|topo|prospect|lal|lookalike)/.test(raw)) return "cold";
  // Heurística pelo tipo de público quando o stage não veio.
  const aud = String(adset?.audience_type || adset?.audience_kind || "").toLowerCase();
  if (/(retarget|remarket|custom|warm|engagement|visit|view|cart|purchase)/.test(aud)) return "hot";
  if (/(lal|lookalike|interest|broad|advantage)/.test(aud)) return "cold";
  return "cold";
}

function pickLinkedAdset(propData: any, ad: any) {
  const adsets: any[] = Array.isArray(propData?.adsets) ? propData.adsets : [];
  if (adsets.length === 0) return null;
  const ref = String(ad?.ad_set_ref || ad?.adset_name || "").trim().toLowerCase();
  if (ref) {
    const match = adsets.find((a) => String(a?.name || "").trim().toLowerCase() === ref);
    if (match) return match;
  }
  if (typeof ad?.adset_index === "number" && adsets[ad.adset_index]) return adsets[ad.adset_index];
  return adsets[0];
}

function stageGuide(stage: "cold" | "warm" | "hot"): string {
  if (stage === "cold") {
    return [
      "ESTÁGIO: TOPO DE FUNIL (público frio).",
      "- Foco em dor/desejo/curiosidade real ligada ao produto.",
      "- Abertura que prende em 1 segundo (pergunta, dado, contraste).",
      "- PROIBIDO: 'compre agora', 'aproveite a oferta', 'última chance', 'promoção', menção a desconto, frete grátis ou prazo.",
      "- CTA implícito de descoberta ('descubra', 'entenda', 'conheça') — não venda direta.",
    ].join("\n");
  }
  if (stage === "warm") {
    return [
      "ESTÁGIO: MEIO DE FUNIL (público morno, já engajou).",
      "- Prova, comparação, benefício específico e diferenciação.",
      "- Urgência leve permitida, sem inventar prazo nem desconto que não exista.",
      "- CTA de aprofundamento ou avaliação ('veja como funciona', 'compare').",
    ].join("\n");
  }
  return [
    "ESTÁGIO: FUNDO DE FUNIL (remarketing/quente).",
    "- Fechamento direto: reforça benefício principal + chamada de ação clara.",
    "- Pode citar oferta SE estiver explícita no contexto fornecido — nunca inventada.",
    "- CTA de compra direto ('compre agora', 'finalize seu pedido') é permitido.",
  ].join("\n");
}

async function buildBriefing(
  supabase: any,
  tenantId: string,
  propData: any,
  adIndex: number,
  hintName?: string,
) {
  const planned = (propData?.planned_creatives || [])[adIndex] || {};
  const ad = (propData?.ads || [])[adIndex] || {};
  const campaign = propData?.campaign || {};
  const linkedAdset = pickLinkedAdset(propData, ad);

  const productId = ad.product_id || planned.product_id || propData.product_id || null;
  const productNameHint = String(
    hintName || ad.product_name || planned.product_name || campaign?.product_name || propData?.product_name || "",
  ).trim();

  // Produto real do cadastro (quando houver) — por ID, com fallback por nome.
  let product: any = null;
  if (productId) {
    const { data } = await supabase
      .from("products")
      .select("id, name, description, price, short_description")
      .eq("id", productId)
      .maybeSingle();
    product = data || null;
  }
  if (!product && productNameHint) {
    const { data: exact } = await supabase
      .from("products")
      .select("id, name, description, price, short_description")
      .eq("tenant_id", tenantId)
      .ilike("name", productNameHint)
      .limit(1);
    product = (exact && exact[0]) || null;
    if (!product) {
      const { data: like } = await supabase
        .from("products")
        .select("id, name, description, price, short_description")
        .eq("tenant_id", tenantId)
        .ilike("name", `%${productNameHint}%`)
        .limit(1);
      product = (like && like[0]) || null;
    }
  }

  // Voz da marca.
  const [{ data: brand }, { data: aiCfg }] = await Promise.all([
    supabase
      .from("tenant_brand_context")
      .select("brand_summary, tone_of_voice, approved_main_promise, banned_claims, do_not_do, allowed_claims")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("ai_support_config")
      .select("personality_tone, business_context, forbidden_topics")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  // Aprendizados recentes de copy (categoria oficial "copy").
  const { data: learnings } = await supabase
    .from("ads_ai_learnings")
    .select("title, description, metadata, created_at")
    .eq("tenant_id", tenantId)
    .eq("category", "copy")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(3);

  const stage = inferStageFromAdset(linkedAdset, campaign);

  const productName =
    product?.name || productNameHint || ad.product_name || planned.product_name || campaign.product_name || "";
  const productDescription =
    product?.description || product?.short_description || ad.product_description ||
    planned.product_description || "";
  const productPrice = product?.price ?? null;

  const audienceLabel = String(
    linkedAdset?.target_audience || linkedAdset?.audience_summary || linkedAdset?.audience_type || "",
  ).slice(0, 240);

  const objective = String(
    campaign?.objective_label || campaign?.objective || campaign?.campaign_objective || "",
  ).slice(0, 80);

  const promise = String(
    planned?.promise || brand?.approved_main_promise || ad.offer_note || "",
  ).slice(0, 240);

  const angle = String(planned?.angle || planned?.ad_angle || "").slice(0, 80);
  const format = String(planned?.format || ad.creative_format || "").slice(0, 40);

  const brandTone = String(
    brand?.tone_of_voice || aiCfg?.personality_tone || "",
  ).slice(0, 120);
  const brandSummary = String(brand?.brand_summary || aiCfg?.business_context || "").slice(0, 400);
  const banned = [
    ...(Array.isArray(brand?.banned_claims) ? brand.banned_claims : []),
    ...(Array.isArray(brand?.do_not_do) ? brand.do_not_do : []),
    ...(Array.isArray(aiCfg?.forbidden_topics) ? aiCfg.forbidden_topics : []),
  ].slice(0, 8);
  const allowed = Array.isArray(brand?.allowed_claims) ? brand.allowed_claims.slice(0, 8) : [];

  const learningsLines = (learnings || [])
    .map((l: any) => {
      const fb = String(l?.description || "").trim().slice(0, 180);
      return fb ? `- ${fb}` : "";
    })
    .filter(Boolean);

  return {
    stage,
    productName,
    productDescription: productDescription.slice(0, 600),
    productPrice,
    audienceLabel,
    objective,
    promise,
    angle,
    format,
    brandTone,
    brandSummary,
    banned,
    allowed,
    learningsLines,
    campaignName: String(campaign?.name || campaign?.campaign_name || "").slice(0, 120),
    adsetName: String(linkedAdset?.name || ad.ad_set_ref || "").slice(0, 160),
  };
}

function formatBriefingForPrompt(b: ReturnType<typeof buildBriefing> extends Promise<infer R> ? R : never): string {
  const lines: string[] = [];
  lines.push(`PRODUTO: ${b.productName || "(sem nome)"}`);
  if (b.productDescription) lines.push(`DESCRIÇÃO REAL DO PRODUTO: ${b.productDescription}`);
  if (b.productPrice != null) lines.push(`PREÇO: R$ ${b.productPrice}`);
  if (b.campaignName) lines.push(`CAMPANHA: ${b.campaignName}`);
  if (b.objective) lines.push(`OBJETIVO: ${b.objective}`);
  if (b.adsetName) lines.push(`CONJUNTO: ${b.adsetName}`);
  if (b.audienceLabel) lines.push(`PÚBLICO: ${b.audienceLabel}`);
  if (b.angle) lines.push(`ÂNGULO: ${b.angle}`);
  if (b.format) lines.push(`FORMATO: ${b.format}`);
  if (b.promise) lines.push(`PROMESSA CENTRAL: ${b.promise}`);
  if (b.brandSummary) lines.push(`MARCA: ${b.brandSummary}`);
  if (b.brandTone) lines.push(`TOM DE VOZ: ${b.brandTone}`);
  if (b.allowed.length) lines.push(`CLAIMS PERMITIDOS: ${b.allowed.join(" | ")}`);
  if (b.banned.length) lines.push(`PROIBIDO PELA MARCA: ${b.banned.join(" | ")}`);
  if (b.learningsLines.length) {
    lines.push("APRENDIZADOS DE COPY DESTA LOJA (aplicar):");
    lines.push(...b.learningsLines);
  }
  lines.push("");
  lines.push(stageGuide(b.stage));
  return lines.join("\n");
}

const HARD_RULES = [
  "REGRAS DURAS (não viole):",
  "1. Use SEMPRE o produto descrito acima. Proibido falar de outro nicho (ex.: moda/guarda-roupa em produto de cuidado pessoal).",
  "2. Proibido inventar desconto, promoção, frete grátis, garantia, prazo de entrega ou claim que não esteja nas informações dadas.",
  "3. Proibido clichês: 'ofertas exclusivas', 'qualidade e preço justo', 'renove seu look/guarda-roupa', 'aproveite as ofertas', 'tudo em um só lugar', 'descubra ofertas exclusivas hoje'.",
  "4. Proibido prometer cura, resultado garantido ou claim regulado (saúde, financeiro) sem evidência explícita no contexto.",
  "5. A copy DEVE mencionar ou encostar no produto/benefício real, não em categoria vaga.",
  "6. Respeite o estágio do funil indicado acima.",
  "7. TÍTULO não pode terminar em '?' por padrão. Use pergunta APENAS quando o ângulo for explicitamente provocativo/diagnóstico e a pergunta agregar — caso contrário, prefira afirmação, benefício direto, frase de impacto ou comando curto. Varie a forma; nunca use '?' como muleta.",
  "8. Não termine o título com reticências '...'. Pontuação final do título é opcional: ponto final, exclamação moderada ou sem pontuação são preferíveis.",
  "9. COMPLETUDE OBRIGATÓRIA: termine TODAS as frases. Nunca corte no meio de uma palavra ou ideia. Se o texto não couber no limite, REESCREVA mais curto — não trunque. O texto principal precisa terminar com pontuação final ('.', '!') ou fechamento natural.",
  "10. VARIAÇÃO OBRIGATÓRIA: a cada regeneração, mude radicalmente abertura, ritmo, framework e ângulo. NUNCA devolva o mesmo padrão de frase que já apareceu antes (ver 'VERSÕES ANTERIORES' quando houver). Se já usou um gancho, use outro completamente diferente.",
].join("\n");

// Meta aceita textos bem maiores que o recomendado curto. Limites generosos
// para a IA não precisar truncar no meio: headline 60, primary 500, desc 90.
const COPY_LIMITS = { headline: 60, primary_text: 500, description: 90 } as const;

// Apara só no fim de frase/palavra — nunca no meio de palavra.
function smartTrim(s: string, limit: number): string {
  const t = String(s || "").trim();
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit);
  const sent = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  if (sent >= Math.floor(limit * 0.5)) return cut.slice(0, sent + 1).trim();
  const sp = cut.lastIndexOf(" ");
  if (sp >= Math.floor(limit * 0.5)) return cut.slice(0, sp).trim() + "…";
  return cut.trim();
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return ok({ success: false, error_pt: "Sessão não identificada." });
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return ok({ success: false, error_pt: "Sessão inválida." });

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenant_id || "");
    const actionId = String(body.action_id || "");
    const adIndex = Number(body.ad_index);
    const action = String(body.action || "");
    const productNameHint = String(body.product_name_hint || "").trim();

    if (!tenantId || !actionId || !Number.isFinite(adIndex) || !action) {
      return ok({ success: false, error_pt: "Parâmetros obrigatórios ausentes." });
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!role) return ok({ success: false, error_pt: "Sem permissão para esta loja." });

    const { data: actionRow } = await supabase
      .from("ads_autopilot_actions")
      .select("id, tenant_id, action_data, status")
      .eq("id", actionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!actionRow) return ok({ success: false, error_pt: "Proposta não encontrada." });
    if (actionRow.status === "rejected" || actionRow.status === "executed") {
      return ok({ success: false, error_pt: "Esta proposta não aceita mais alterações." });
    }

    const propData = actionRow.action_data || {};
    const planned: any[] = Array.isArray(propData.planned_creatives) ? [...propData.planned_creatives] : [];
    const adsArr: any[] = Array.isArray(propData.ads) ? [...propData.ads] : [];
    const plannedItem = planned[adIndex] || {};
    const adItem = adsArr[adIndex] || {};

    // Persiste patch unificado em ads[idx] e planned_creatives[idx].
    const persist = async (patch: Record<string, any>, plannedPatch?: Record<string, any>) => {
      adsArr[adIndex] = { ...adItem, ...patch };
      planned[adIndex] = { ...plannedItem, ...(plannedPatch || patch) };
      await supabase
        .from("ads_autopilot_actions")
        .update({
          action_data: {
            ...propData,
            ads: adsArr,
            planned_creatives: planned,
          },
        })
        .eq("id", actionId);
    };

    // ---------- generate_copy / regen_copy_field ----------
    if (action === "generate_copy" || action === "regen_copy_field") {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) return ok({ success: false, error_pt: "Serviço de IA indisponível no momento." });

      const isRegen = action === "regen_copy_field";
      const field = isRegen ? String(body.field || "") : "";
      const feedback = String(body.feedback || "").trim();

      if (isRegen && !["headline", "primary_text", "description"].includes(field)) {
        return ok({ success: false, error_pt: "Campo inválido para regeneração." });
      }
      if (isRegen && feedback.length < 5) {
        return ok({ success: false, error_pt: "Conte como você quer este texto diferente antes de regenerar." });
      }

      const briefing = await buildBriefing(supabase, tenantId, propData, adIndex, productNameHint);
      if (!briefing.productName) {
        return ok({ success: false, error_pt: "Produto da campanha não encontrado para gerar a copy." });
      }
      const briefingText = formatBriefingForPrompt(briefing);

      const currHeadline = adItem.headline || plannedItem.headline || "";
      const currPrimary = adItem.primary_text || plannedItem.copy || plannedItem.primary_text || "";
      const currDesc = adItem.description || plannedItem.description || "";

      let sys = "";
      let usr = "";

      if (action === "generate_copy") {
        const priorBlock = (currHeadline || currPrimary || currDesc)
          ? `\n\nVERSÕES ANTERIORES (NÃO repita estrutura, abertura nem ritmo):\n- Título anterior: ${currHeadline || "(vazio)"}\n- Texto anterior: ${currPrimary || "(vazio)"}\n- Descrição anterior: ${currDesc || "(vazio)"}\n\nGere algo radicalmente diferente das versões acima — outra abertura, outro framework (AIDA / PAS / 4Us / Before-After-Bridge), outro ângulo emocional.`
          : "";
        sys = `${COPYWRITER_PERSONA}

Você vai gerar 3 versões INTERNAMENTE (diferentes entre si em ângulo/abertura/framework), criticar cada uma contra os critérios abaixo, e devolver APENAS a melhor.

Critérios de seleção (peso alto):
- Gancho forte nos primeiros 5 caracteres do título.
- Texto principal COMPLETO, com frase finalizada — nada cortado no meio.
- Especificidade ao produto descrito (não vale frase genérica que serviria para qualquer marca).
- Zero clichê e zero cara de IA.
- Coerente com o estágio do funil.
- Ritmo natural em PT-BR coloquial.

Responda APENAS um JSON válido (sem markdown, sem texto extra) no formato:
{ "headline": string (até ${COPY_LIMITS.headline} chars, frase completa), "primary_text": string (até ${COPY_LIMITS.primary_text} chars, 2 a 4 frases completas terminando em pontuação), "description": string (até ${COPY_LIMITS.description} chars, frase completa) }

${HARD_RULES}`;
        usr = `${briefingText}${priorBlock}

Tarefa: escreva título + texto principal + descrição para um anúncio Meta Ads centrado no produto acima, no estágio indicado. Texto principal pode ter 2 a 4 frases — sempre completas, sempre terminando em pontuação. Gere 3 internamente, escolha a melhor, devolva só ela.`;
      } else {
        const labelPt = field === "headline" ? "título" : field === "primary_text" ? "texto principal" : "descrição";
        const limit = COPY_LIMITS[field as keyof typeof COPY_LIMITS];
        const currField = field === "headline" ? currHeadline : field === "primary_text" ? currPrimary : currDesc;
        sys = `${COPYWRITER_PERSONA}

Você vai reescrever APENAS o ${labelPt} de um anúncio Meta Ads. Gere 3 versões diferentes internamente (cada uma com abertura, ritmo e framework distintos), escolha a melhor pelos critérios abaixo e devolva só ela.

Critérios: gancho forte, frase completa (nunca cortada), específica ao produto, zero clichê, coerente com estágio, ritmo PT-BR natural, ESTRUTURALMENTE DIFERENTE da versão atual.

Responda APENAS um JSON válido { "${field}": string (até ${limit} caracteres, frase completa terminando em pontuação${field === "primary_text" ? "; aceita múltiplas frases" : ""}) }. Sem markdown, sem texto extra.

${HARD_RULES}

INSTRUÇÕES DE FEEDBACK (CRÍTICO):
- O feedback do lojista é DIREÇÃO CRIATIVA, não texto pronto. NUNCA copie o feedback literalmente.
- Trechos entre aspas, "como", "tipo", "parecido com", "no estilo de" no feedback são EXEMPLOS/INSPIRAÇÃO de tom, ângulo ou formato — use como referência, escreva uma versão NOVA.
- Capture a INTENÇÃO (ângulo, tom, foco, benefício destacado) e gere um ${labelPt} original com esse espírito.
- Proibido devolver o feedback (ou o trecho entre aspas) como resposta.`;
        usr = `${briefingText}

Versão atual do anúncio:
- Título: ${currHeadline}
- Texto principal: ${currPrimary}
- Descrição: ${currDesc}

VERSÃO ATUAL DO ${labelPt.toUpperCase()} (NÃO repita estrutura, abertura nem ritmo):
"${currField || "(vazio)"}"

Feedback/direção do lojista (interpretar, NÃO copiar):
"${feedback}"

Gere uma versão NOVA APENAS do ${labelPt}, radicalmente diferente da versão atual em abertura/framework/ritmo, inspirada na direção do lojista, respeitando briefing, estágio e limites. Frase completa, sem cortar no meio.`;
      }

      const callAI = async (sysMsg: string, usrMsg: string) => {
        try {
          const r = await aiChatCompletion(
            COPY_MODEL,
            {
              messages: [
                { role: "system", content: sysMsg },
                { role: "user", content: usrMsg },
              ],
              temperature: 0.9,
            },
            {
              supabaseUrl: Deno.env.get("SUPABASE_URL"),
              supabaseServiceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
              preferProvider: "auto",
              logPrefix: "[ads-creative-inline-generate]",
              maxRetries: 2,
              requestTimeoutMs: 90_000,
            },
          );
          if (!r.ok) {
            const t = await r.text().catch(() => "");
            console.error("[ads-creative-inline-generate] AI router error:", r.status, t);
            return null;
          }
          const j = await r.json();
          const txt = j?.choices?.[0]?.message?.content || "";
          try {
            const m = txt.match(/\{[\s\S]*\}/);
            return JSON.parse(m ? m[0] : txt);
          } catch {
            return null;
          }
        } catch (e) {
          console.error("[ads-creative-inline-generate] AI router exception:", e);
          return null;
        }
      };

      // Normalizador simples para detectar eco do feedback.
      const norm = (s: string) =>
        String(s || "").toLowerCase().replace(/["“”'`]/g, "").replace(/\s+/g, " ").trim();
      const echoesFeedback = (out: string) => {
        if (!isRegen || !feedback) return false;
        const a = norm(out);
        const b = norm(feedback);
        if (!a || !b) return false;
        if (a === b) return true;
        // se a saída cabe inteira dentro do feedback, é eco/cópia.
        if (b.includes(a) && a.length >= 8) return true;
        // se a saída é o trecho entre aspas do feedback.
        const quoted = feedback.match(/["“'`]([^"“”'`]{4,})["”'`]/);
        if (quoted && norm(quoted[1]) === a) return true;
        return false;
      };

      let parsed = await callAI(sys, usr);
      if (!parsed) {
        return ok({ success: false, error_pt: "Não foi possível gerar a copy agora. Tente de novo em instantes." });
      }

      // Retry uma vez se a saída do regen está copiando o feedback literal.
      if (isRegen) {
        const out = String(parsed?.[field] || "").trim();
        if (echoesFeedback(out)) {
          const retrySys = sys +
            `\n\nATENÇÃO: a tentativa anterior devolveu praticamente o feedback do lojista. ` +
            `Isso é ERRADO. Gere agora uma versão ORIGINAL, diferente do feedback em palavras, ` +
            `mantendo apenas a INTENÇÃO/ângulo dele.`;
          const retried = await callAI(retrySys, usr);
          if (retried && String(retried?.[field] || "").trim()) {
            parsed = retried;
          }
        }
      }

      if (action === "generate_copy") {
        const headline = smartTrim(String(parsed?.headline || ""), COPY_LIMITS.headline);
        const primary_text = smartTrim(String(parsed?.primary_text || parsed?.copy || ""), COPY_LIMITS.primary_text);
        const description = smartTrim(String(parsed?.description || ""), COPY_LIMITS.description);
        if (!headline || !primary_text) {
          return ok({ success: false, error_pt: "A copy gerada veio incompleta. Tente novamente." });
        }
        const patch = {
          headline,
          primary_text,
          description,
          copy_source: "ai_inline",
          copy_generated_at: new Date().toISOString(),
        };
        const plannedPatch = {
          headline,
          copy: primary_text,
          primary_text,
          description,
          copy_source: "ai_inline",
        };
        await persist(patch, plannedPatch);
        return ok({ success: true, headline, primary_text, description });
      }

      // regen single field
      const value = String(parsed?.[field] || "").trim();
      const limit = COPY_LIMITS[field as keyof typeof COPY_LIMITS];
      const sliced = smartTrim(value, limit);
      if (!sliced) {
        return ok({ success: false, error_pt: "A nova versão veio vazia. Tente novamente." });
      }
      const patch: Record<string, any> = { [field]: sliced, copy_source: "ai_inline" };
      const plannedPatch: Record<string, any> = field === "primary_text"
        ? { copy: sliced, primary_text: sliced, copy_source: "ai_inline" }
        : { [field]: sliced, copy_source: "ai_inline" };

      await persist(patch, plannedPatch);

      await recordLearning(
        supabase, tenantId, actionId, userId,
        "creative_copy_feedback",
        `Campo ${field} do anúncio #${adIndex + 1} regenerado`,
        feedback,
        {
          ad_index: adIndex,
          field,
          funnel_stage: briefing.stage,
          product_name: briefing.productName,
          before: { headline: currHeadline, primary_text: currPrimary, description: currDesc },
          after: { [field]: sliced },
        },
      );

      return ok({ success: true, [field]: sliced });
    }

    // ---------- generate_image / regen_image ----------
    if (action === "generate_image" || action === "regen_image") {
      const isRegen = action === "regen_image";
      const feedback = String(body.feedback || "").trim();
      if (isRegen && feedback.length < 5) {
        return ok({ success: false, error_pt: "Conte o que você quer diferente na imagem antes de regenerar." });
      }

      const productId = adItem.product_id || plannedItem.product_id || propData.product_id || null;
      let productImageUrl = adItem.reference_image_url || plannedItem.reference || plannedItem.product_image_url || "";
      let pName = adItem.product_name || plannedItem.product_name || propData?.campaign?.product_name || "";
      let pDesc = adItem.product_description || plannedItem.product_description || "";

      if (productId && (!productImageUrl || !pName || !pDesc)) {
        const { data: prod } = await supabase
          .from("products")
          .select("name, description, featured_image_url")
          .eq("id", productId)
          .maybeSingle();
        if (prod) {
          pName = pName || prod.name;
          pDesc = pDesc || (prod.description || "");
          productImageUrl = productImageUrl || (prod.featured_image_url || "");
        }
      }

      if (!productId || !productImageUrl) {
        return ok({ success: false, error_pt: "Produto da campanha não encontrado para gerar a imagem." });
      }

      const visualPrompt = plannedItem.visual_prompt || adItem.creative_prompt || "";
      const basePrompt = isRegen
        ? `${visualPrompt}\n\nAjustes pedidos pelo lojista (acate): ${feedback}`.slice(0, 1200)
        : (visualPrompt || `Anúncio de ${pName}.`).slice(0, 1200);

      const formatRaw = plannedItem.format || adItem.creative_format || "square";
      const format = formatRaw === "portrait" ? "portrait" : formatRaw === "landscape" ? "landscape" : "square";

      const resp = await supabase.functions.invoke("creative-image-generate", {
        body: {
          tenant_id: tenantId,
          product_id: productId,
          product_name: pName,
          product_description: pDesc,
          product_image_url: productImageUrl,
          prompt: basePrompt,
          settings: {
            providers: ["openai", "gemini"],
            generation_style: "product_natural",
            format,
            quality: "medium",
            variations: 1,
            enable_qa: true,
            enable_fallback: true,
          },
          proposal_link: {
            proposal_action_id: actionId,
            planned_creative_index: adIndex,
            revision: isRegen,
            inline_generation: true,
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      const jobId = (resp.data as any)?.data?.job_id || (resp.data as any)?.job_id;
      if (!jobId) {
        return ok({ success: false, error_pt: "Não foi possível iniciar a geração da imagem." });
      }

      let job: any = null;
      let newUrl: string | null = null;
      const startedAt = Date.now();
      const MAX_MS = 90_000;
      while (Date.now() - startedAt < MAX_MS) {
        const { data } = await supabase
          .from("creative_jobs")
          .select("status, output_urls, error_message")
          .eq("id", jobId)
          .maybeSingle();
        job = data;
        if (job?.status === "completed" || job?.status === "failed") break;
        if (Array.isArray(job?.output_urls) && job.output_urls.length > 0) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      newUrl = Array.isArray(job?.output_urls) && job!.output_urls.length > 0 ? job!.output_urls[0] : null;
      if (!newUrl) {
        return ok({
          success: false,
          error_pt: job?.error_message || (job?.status === "running"
            ? "A geração está demorando mais que o normal. Tente novamente em instantes."
            : "A geração não retornou uma imagem válida."),
        });
      }

      const patch = {
        creative_final_url: newUrl,
        creative_status: "ready",
        creative_source: isRegen ? "ai_regen" : "ai_inline",
        creative_job_id: jobId,
        creative_generated_at: new Date().toISOString(),
      };
      const plannedPatch = {
        ...patch,
        image_url: newUrl,
      };
      await persist(patch, plannedPatch);

      if (isRegen) {
        await recordLearning(
          supabase, tenantId, actionId, userId,
          "creative_image_feedback",
          `Imagem do anúncio #${adIndex + 1} regenerada`,
          feedback,
          { ad_index: adIndex, regen_job_id: jobId, product_id: productId },
        );
      }

      return ok({ success: true, image_url: newUrl, job_id: jobId });
    }

    return ok({ success: false, error_pt: "Ação não suportada." });
  } catch (e: any) {
    console.error("[ads-creative-inline-generate] error", e);
    return ok({ success: false, error_pt: "Falha ao processar a geração do criativo." });
  }
});
