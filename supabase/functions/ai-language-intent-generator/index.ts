/**
 * ai-language-intent-generator
 *
 * Sub-fase 2.2 do Plano Mestre — Geração inicial dos Pacotes J e M.
 *
 * Pacote J → ai_language_dictionary
 *   Tom de voz, pronome de tratamento, vocabulário do nicho,
 *   apelidos de produtos, frases preferidas, termos proibidos,
 *   uso de emojis e whitelist.
 *
 * Pacote M → ai_intent_objection_map
 *   Catálogo de intenções e objeções típicas do nicho,
 *   com triggers de detecção, estado recomendado da pipeline
 *   e resposta padrão sugerida.
 *
 * Fontes de contexto: ai_business_snapshot, ai_context_tree,
 * ai_product_commercial_payload (todos do mesmo tenant).
 *
 * Persistência: source='inferred', needs_regeneration=false.
 * Preserva manual_overrides e has_manual_overrides quando já existirem
 * (não sobrescreve trabalho humano).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

interface RequestBody {
  tenant_id: string;
  scope?: "both" | "language" | "intents";
  reason?: "manual" | "snapshot_changed" | "initial";
  dry_run?: boolean;
}

interface InferredLanguage {
  tone_style: string;
  treatment_pronoun: string; // "voce" | "tu" | "senhor_senhora" | "auto"
  use_emojis: boolean;
  emoji_whitelist: string[];
  forbidden_terms: string[];
  niche_vocabulary: Record<string, string>; // termo → significado/uso
  preferred_phrases: Record<string, string[]>; // contexto → frases
  product_aliases: Record<string, string[]>; // product_id ou nome → apelidos
  confidence_score: number;
}

interface InferredIntentEntry {
  entry_type: "intent" | "objection";
  key: string;
  label: string;
  trigger_patterns: string[];
  recommended_state: string | null; // estado da pipeline
  standard_response: string | null;
  severity: "low" | "medium" | "high" | null;
  product_scope: string[];
  confidence_score: number;
}

interface InferredJM {
  language: InferredLanguage;
  intents_objections: InferredIntentEntry[];
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function confidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function toScoreInt(score: number | null | undefined): number {
  if (score === null || score === undefined || isNaN(Number(score))) return 0;
  const n = Number(score);
  const scaled = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

const VALID_STATES = [
  "greeting",
  "discovery",
  "recommendation",
  "product_detail",
  "decision",
  "checkout_assist",
  "support",
  "handoff",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    if (!LOVABLE_API_KEY) {
      return jsonResponse(
        { success: false, error: "LOVABLE_API_KEY não configurada" },
        200,
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { tenant_id, scope = "both", reason = "manual", dry_run = false } = body;

    if (!tenant_id) {
      return jsonResponse({ success: false, error: "tenant_id é obrigatório" }, 200);
    }

    console.log(
      `[lang-intent-gen] tenant=${tenant_id} scope=${scope} reason=${reason} dry_run=${dry_run}`,
    );

    // 1. Carregar contexto do tenant (snapshot + árvore + payloads comerciais)
    const [snapRes, treeRes, payloadRes] = await Promise.all([
      supabase
        .from("ai_business_snapshot")
        .select(
          "mode, niche_primary, niche_secondary, business_summary, audience_summary, suggested_tone",
        )
        .eq("tenant_id", tenant_id)
        .maybeSingle(),
      supabase
        .from("ai_context_tree")
        .select("level, label, slug, description, weight")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .order("weight", { ascending: false })
        .limit(80),
      supabase
        .from("ai_product_commercial_payload")
        .select(
          "commercial_name, commercial_role, target_audience, short_pitch, differentials, when_not_to_indicate",
        )
        .eq("tenant_id", tenant_id)
        .limit(40),
    ]);

    if (snapRes.error) throw snapRes.error;

    const snapshot = snapRes.data;
    if (!snapshot) {
      return jsonResponse({
        success: false,
        error:
          "Snapshot do tenant ainda não existe. Rode ai-business-snapshot-generator primeiro.",
      });
    }

    if (snapshot.mode === "neutral") {
      console.log(`[lang-intent-gen] snapshot está em modo neutro — gerando J/M genérico.`);
    }

    const contextPayload = {
      snapshot: {
        mode: snapshot.mode,
        niche_primary: snapshot.niche_primary,
        niche_secondary: snapshot.niche_secondary,
        business_summary: snapshot.business_summary,
        audience_summary: snapshot.audience_summary,
        suggested_tone: snapshot.suggested_tone,
      },
      context_tree: (treeRes.data ?? []).map((n) => ({
        level: n.level,
        label: n.label,
        slug: n.slug,
        description: n.description,
        weight: n.weight,
      })),
      products: (payloadRes.data ?? []).map((p) => ({
        name: p.commercial_name,
        role: p.commercial_role,
        audience: p.target_audience,
        pitch: p.short_pitch,
        differentials: p.differentials,
        when_not: p.when_not_to_indicate,
      })),
    };

    // 2. Inferência via AI Gateway
    const inferred = await inferLanguageAndIntents(contextPayload, scope);

    if (dry_run) {
      return jsonResponse({
        success: true,
        dry_run: true,
        inferred,
        duration_ms: Date.now() - startedAt,
      });
    }

    // 3. Persistir
    const persistStats = {
      language_upsert: "skipped" as string,
      intents_deleted: 0,
      intents_inserted: 0,
      intents_failed: 0,
      errors: [] as string[],
    };

    if (scope === "both" || scope === "language") {
      const langResult = await persistLanguageDictionary(
        supabase,
        tenant_id,
        inferred.language,
        MODEL,
      );
      persistStats.language_upsert = langResult.ok ? "ok" : `error: ${langResult.error}`;
      if (!langResult.ok) persistStats.errors.push(`language: ${langResult.error}`);
    }

    if (scope === "both" || scope === "intents") {
      const intentResult = await persistIntentMap(
        supabase,
        tenant_id,
        inferred.intents_objections,
        MODEL,
      );
      persistStats.intents_deleted = intentResult.deleted;
      persistStats.intents_inserted = intentResult.inserted;
      persistStats.intents_failed = intentResult.failed;
      if (intentResult.errors.length > 0) {
        persistStats.errors.push(...intentResult.errors);
      }
    }

    const persistOk =
      (scope === "intents" || persistStats.language_upsert === "ok") &&
      (scope === "language" || persistStats.intents_inserted > 0);

    if (!persistOk) {
      return jsonResponse({
        success: false,
        error: "Inferência ok porém persistência falhou.",
        stats: persistStats,
        duration_ms: Date.now() - startedAt,
      });
    }

    return jsonResponse({
      success: true,
      stats: persistStats,
      counts: {
        language_terms: Object.keys(inferred.language.niche_vocabulary ?? {}).length,
        forbidden_terms: inferred.language.forbidden_terms?.length ?? 0,
        product_aliases: Object.keys(inferred.language.product_aliases ?? {}).length,
        intents: inferred.intents_objections.filter((e) => e.entry_type === "intent").length,
        objections: inferred.intents_objections.filter((e) => e.entry_type === "objection").length,
      },
      duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[lang-intent-gen] erro fatal:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      200,
    );
  }
});

// ============================================================
// Inferência via AI Gateway
// ============================================================

async function inferLanguageAndIntents(
  context: any,
  scope: "both" | "language" | "intents",
): Promise<InferredJM> {
  const wantsLanguage = scope === "both" || scope === "language";
  const wantsIntents = scope === "both" || scope === "intents";

  const systemPrompt = `Você é um especialista em comunicação comercial e atendimento ao cliente em português do Brasil.
Sua tarefa é, a partir do contexto de uma loja, gerar dois pacotes:

${wantsLanguage ? `1) DICIONÁRIO DE LINGUAGEM (Pacote J):
   - tone_style: estilo geral (consultivo, próximo, formal, descontraído, técnico, premium...)
   - treatment_pronoun: "voce", "tu", "senhor_senhora" ou "auto" (deixar o agente escolher)
   - use_emojis: true/false (com base no público e no tom)
   - emoji_whitelist: lista pequena de emojis adequados ao nicho (vazia se use_emojis=false)
   - forbidden_terms: termos a EVITAR (jargões agressivos, gírias inadequadas, palavras que soem mal no nicho)
   - niche_vocabulary: { termo_tecnico: explicacao_curta } — vocabulário típico do nicho
   - preferred_phrases: { contexto: [frases_curtas] } — ex: { saudacao: ["Oi! Tudo certo?"], encerramento: [...] }
   - product_aliases: { nome_oficial_produto: [apelido1, apelido2] } — como o cliente pode chamar
   - confidence_score: 0..1
` : ""}
${wantsIntents ? `2) MAPA DE INTENÇÕES E OBJEÇÕES (Pacote M):
   Liste de 8 a 20 entradas relevantes ao nicho. Cada entrada:
   - entry_type: "intent" (cliente quer algo) ou "objection" (cliente reluta)
   - key: identificador curto, snake_case, único (ex: "pergunta_preco", "duvida_entrega", "objecao_caro")
   - label: rótulo legível em português
   - trigger_patterns: 3 a 8 padrões de texto/regex simples que indicam essa intenção/objeção
   - recommended_state: um destes estados da pipeline ou null:
     ${VALID_STATES.join(", ")}
   - standard_response: resposta padrão sugerida (1-3 frases, tom alinhado ao dicionário)
   - severity: "low" | "medium" | "high" | null (relevância para o negócio)
   - product_scope: array vazio (genérico) ou nomes de produtos específicos
   - confidence_score: 0..1
` : ""}

REGRAS:
- Use APENAS português do Brasil.
- Adapte ao nicho real do tenant (vide context.snapshot.niche_primary).
- Se o snapshot estiver em modo NEUTRAL, gere defaults universais e conservadores.
- Não invente produtos: use só os nomes em context.products.
- Seja específico ao nicho — nada de listas genéricas demais.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "save_language_and_intents",
        description: "Salva o dicionário de linguagem e o mapa de intenções/objeções inferidos.",
        parameters: {
          type: "object",
          properties: {
            language: {
              type: "object",
              properties: {
                tone_style: { type: "string" },
                treatment_pronoun: {
                  type: "string",
                  enum: ["voce", "tu", "senhor_senhora", "auto"],
                },
                use_emojis: { type: "boolean" },
                emoji_whitelist: { type: "array", items: { type: "string" } },
                forbidden_terms: { type: "array", items: { type: "string" } },
                niche_vocabulary: { type: "object", additionalProperties: { type: "string" } },
                preferred_phrases: {
                  type: "object",
                  additionalProperties: { type: "array", items: { type: "string" } },
                },
                product_aliases: {
                  type: "object",
                  additionalProperties: { type: "array", items: { type: "string" } },
                },
                confidence_score: { type: "number" },
              },
              required: [
                "tone_style",
                "treatment_pronoun",
                "use_emojis",
                "emoji_whitelist",
                "forbidden_terms",
                "niche_vocabulary",
                "preferred_phrases",
                "product_aliases",
                "confidence_score",
              ],
            },
            intents_objections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entry_type: { type: "string", enum: ["intent", "objection"] },
                  key: { type: "string" },
                  label: { type: "string" },
                  trigger_patterns: { type: "array", items: { type: "string" } },
                  recommended_state: { type: ["string", "null"] },
                  standard_response: { type: ["string", "null"] },
                  severity: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
                  product_scope: { type: "array", items: { type: "string" } },
                  confidence_score: { type: "number" },
                },
                required: [
                  "entry_type",
                  "key",
                  "label",
                  "trigger_patterns",
                  "recommended_state",
                  "standard_response",
                  "severity",
                  "product_scope",
                  "confidence_score",
                ],
              },
            },
          },
          required: ["language", "intents_objections"],
        },
      },
    },
  ];

  const userPrompt = `CONTEXTO DO TENANT:
${JSON.stringify(context, null, 2)}

Gere o(s) pacote(s) solicitado(s) (${scope}). Use a função save_language_and_intents.`;

  const resp = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "save_language_and_intents" } },
      temperature: 0.4,
      max_tokens: 8000,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI gateway falhou (${resp.status}): ${errText.slice(0, 500)}`);
  }

  const json = await resp.json();
  const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("AI não retornou tool_call esperado.");
  }

  const parsed = JSON.parse(toolCall.function.arguments) as InferredJM;

  // Defaults se vier campo vazio
  if (!parsed.language) {
    parsed.language = {
      tone_style: "consultivo",
      treatment_pronoun: "voce",
      use_emojis: false,
      emoji_whitelist: [],
      forbidden_terms: [],
      niche_vocabulary: {},
      preferred_phrases: {},
      product_aliases: {},
      confidence_score: 0.3,
    };
  }
  if (!Array.isArray(parsed.intents_objections)) {
    parsed.intents_objections = [];
  }

  // Valida recommended_state contra a máquina oficial
  parsed.intents_objections = parsed.intents_objections.map((e) => {
    if (e.recommended_state && !VALID_STATES.includes(e.recommended_state)) {
      console.warn(`[lang-intent-gen] estado inválido descartado: ${e.recommended_state}`);
      e.recommended_state = null;
    }
    return e;
  });

  return parsed;
}

// ============================================================
// Persistência
// ============================================================

async function persistLanguageDictionary(
  supabase: any,
  tenantId: string,
  lang: InferredLanguage,
  modelUsed: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from("ai_language_dictionary")
    .select("manual_overrides, has_manual_overrides")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { error } = await supabase.from("ai_language_dictionary").upsert(
    {
      tenant_id: tenantId,
      tone_style: lang.tone_style ?? "consultivo",
      treatment_pronoun: lang.treatment_pronoun ?? "voce",
      use_emojis: lang.use_emojis ?? false,
      emoji_whitelist: lang.emoji_whitelist ?? [],
      forbidden_terms: lang.forbidden_terms ?? [],
      niche_vocabulary: lang.niche_vocabulary ?? {},
      preferred_phrases: lang.preferred_phrases ?? {},
      product_aliases: lang.product_aliases ?? {},
      source: "inferred",
      confidence_score: toScoreInt(lang.confidence_score),
      confidence_level: confidenceLevel(lang.confidence_score),
      manual_overrides: existing?.manual_overrides ?? {},
      has_manual_overrides: existing?.has_manual_overrides ?? false,
      model_used: modelUsed,
      generated_at: new Date().toISOString(),
      needs_regeneration: false,
    },
    { onConflict: "tenant_id" },
  );

  if (error) {
    console.error("[persist-language] erro:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function persistIntentMap(
  supabase: any,
  tenantId: string,
  entries: InferredIntentEntry[],
  modelUsed: string,
): Promise<{ deleted: number; inserted: number; failed: number; errors: string[] }> {
  const result = { deleted: 0, inserted: 0, failed: 0, errors: [] as string[] };

  // Preserva entradas com overrides manuais; apaga só as que vieram puramente de IA.
  const { data: toDelete, error: selErr } = await supabase
    .from("ai_intent_objection_map")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source", "inferred")
    .eq("has_manual_overrides", false);

  if (selErr) {
    result.errors.push(`select_existing: ${selErr.message}`);
  } else if (toDelete && toDelete.length > 0) {
    const ids = toDelete.map((r: any) => r.id);
    const { error: delErr } = await supabase
      .from("ai_intent_objection_map")
      .delete()
      .in("id", ids);
    if (delErr) {
      result.errors.push(`delete_inferred: ${delErr.message}`);
    } else {
      result.deleted = ids.length;
    }
  }

  // Insere as novas, pulando entradas cuja key colide com algo já editado pelo humano.
  const { data: keptKeys } = await supabase
    .from("ai_intent_objection_map")
    .select("key, entry_type")
    .eq("tenant_id", tenantId);

  const keptSet = new Set(
    (keptKeys ?? []).map((k: any) => `${k.entry_type}:${k.key}`),
  );

  const seen = new Set<string>();

  for (const e of entries) {
    const dedupeKey = `${e.entry_type}:${e.key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (keptSet.has(dedupeKey)) continue; // já existe (humano editou) → não sobrescrever

    const { error: insErr } = await supabase.from("ai_intent_objection_map").insert({
      tenant_id: tenantId,
      entry_type: e.entry_type,
      key: e.key,
      label: e.label,
      trigger_patterns: Array.isArray(e.trigger_patterns) ? e.trigger_patterns : [],
      recommended_state: e.recommended_state ?? null,
      standard_response: e.standard_response ?? null,
      severity: e.severity ?? null,
      product_scope: Array.isArray(e.product_scope) ? e.product_scope : [],
      source: "inferred",
      is_active: true,
      confidence_score: toScoreInt(e.confidence_score),
      confidence_level: confidenceLevel(e.confidence_score),
      manual_overrides: {},
      has_manual_overrides: false,
      model_used: modelUsed,
      generated_at: new Date().toISOString(),
      needs_regeneration: false,
    });

    if (insErr) {
      console.error(`[persist-intent] erro insert key=${e.key}:`, insErr);
      result.failed++;
      result.errors.push(`intent[${e.key}]: ${insErr.message}`);
    } else {
      result.inserted++;
    }
  }

  return result;
}
