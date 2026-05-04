// ============================================================
// Pipeline F2 — Turn Pre-Router (TPR) — Reg #2.8
//
// UMA chamada LLM curta (modelo Gemini Flash-Lite logical) que
// classifica o turno do cliente em JSON estruturado, via tool
// calling. Vira a fonte única de verdade para todas as decisões
// determinísticas do turno: greeting scrub, gate consultivo, price
// scrubber, catalog probe, gate de fechamento.
//
// AI Provider Routing (Fase 1 — 2026-05-03):
// Em vez de chamar https://ai.gateway.lovable.dev diretamente, o TPR
// agora usa _shared/ai-router.ts. Hierarquia:
//   1) Gemini Native (se GEMINI_API_KEY)
//   2) OpenAI Native (se OPENAI_API_KEY) — gpt-4o-mini equivalente
//   3) Lovable AI Gateway (fallback final)
// O contrato OpenAI-compatible (tool_calls) é preservado em todos os
// providers — o output do TPR não muda.
//
// FALLBACK: se TODOS os providers falharem (rate limit, timeout, parse),
// o pipeline cai nos detectores antigos (regex) — nunca derruba o turno.
// Doc: docs/especificacoes/ia/ai-provider-routing.md
// ============================================================

import { aiChatCompletionJSON } from "../ai-router.ts";

// Modelo lógico (mapeado pelo ai-router para o provider real disponível).
const TPR_MODEL = "google/gemini-2.5-flash-lite";

// Feature flag de rollback de emergência: setar TPR_USE_LEGACY_GATEWAY=1
// no env para voltar ao caminho direto antigo (Lovable Gateway only).
const USE_LEGACY_GATEWAY = Deno.env.get("TPR_USE_LEGACY_GATEWAY") === "1";
const LEGACY_LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type TurnGreetingPeriod = "bom dia" | "boa tarde" | "boa noite" | null;

export interface TurnClassification {
  // Saudação
  greeting_period: TurnGreetingPeriod;
  asked_how_are_you: boolean;
  is_pure_greeting: boolean;

  // Intenção de catálogo / consulta
  described_symptom: boolean;
  symptom_text: string | null;
  declared_objective: "tratar" | "prevenir" | "repor" | "manter" | null;
  requested_recommendation: boolean;
  is_consultative_turn: boolean;

  // Sinais de preço/frete/imagem (gates server-side leem isso)
  asked_about_price: boolean;
  asked_about_shipping: boolean;
  asked_about_image: boolean;

  // Catálogo
  mentioned_product_family: string | null;
  mentioned_product_name: string | null;
  // Quando true, o Catalog Probe ignora family_focus estrito e busca
  // por categoria pain (mostra Shampoo + Loção + Balm + Kit juntos).
  should_broaden_catalog_for_pain: boolean;

  // Comércio
  confirmed_purchase_intent: boolean;
  asked_about_payment_or_link: boolean;

  // Suporte / pós-venda
  is_support_topic: boolean;

  // Meta
  source: "llm" | "fallback";
  latency_ms: number;
  raw_error?: string;
  // Observabilidade do provider real usado pelo TPR (Fase 1 AI Provider Routing).
  // Persistido em ai_support_turn_log.metadata.tpr para auditoria.
  // Opcionais para manter retrocompatibilidade com chamadores existentes.
  provider?: "gemini" | "openai" | "lovable" | null;
  model?: string | null;
}

const TPR_SYSTEM = `Você é um classificador de turnos de uma conversa de vendas no WhatsApp em português brasileiro.
Sua única tarefa é ler a ÚLTIMA mensagem do cliente e o histórico curto, e devolver, via tool call, um objeto JSON estruturado descrevendo a intenção do turno.

Regras:
- Você NÃO escreve resposta para o cliente. Só classifica.
- Se o cliente descreveu um caso pessoal/sintoma ("tenho calvície", "tô com queda", "minha coroa tá ralinha", "tenho bastante entrada", "será que resolve?", "faz 2 anos que..."), described_symptom=true.
- Se o cliente pediu para você indicar/recomendar/sugerir algo ("o que vocês recomendam?", "qual indicado?", "será que resolve meu caso?", "o que melhor pra mim?"), requested_recommendation=true.
- is_consultative_turn = true SEMPRE que described_symptom=true OU requested_recommendation=true OU enviou foto descrevendo um caso. Esses turnos exigem ACOLHIDA antes de listar produto.
- should_broaden_catalog_for_pain = true quando o cliente descreveu uma DOR/OBJETIVO concreto (calvície, queda, caspa, etc), MESMO que tenha citado uma família (ex.: "shampoo pra calvície"). Sinaliza ao servidor para mostrar várias linhas (shampoo + loção + balm + kit) compatíveis com a dor — não só a família que ele citou.
- mentioned_product_family: shampoo, condicionador, creme, locao, balm, serum, tonico, mascara, gel, sabonete, kit, combo, perfume — ou null.
- asked_about_price = true só se ele PERGUNTOU sobre preço/valor/quanto custa/desconto/cupom. Não confunda "quero comprar" com pergunta de preço.
- confirmed_purchase_intent = true quando o cliente disse "quero", "vou levar", "fecha", "manda o link", "pode adicionar".
- is_pure_greeting = true só se a mensagem é APENAS saudação ("oi", "boa noite", "tudo bem?") sem nenhuma outra informação.
- greeting_period: extraia LITERAL ("bom dia"/"boa tarde"/"boa noite") só se ele usou. Caso contrário null.
- Em caso de dúvida, prefira false (conservador).`;

const TPR_TOOL = {
  type: "function",
  function: {
    name: "classify_turn",
    description: "Classifica o turno atual do cliente em JSON estruturado.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        greeting_period: { type: ["string", "null"], enum: ["bom dia", "boa tarde", "boa noite", null] },
        asked_how_are_you: { type: "boolean" },
        is_pure_greeting: { type: "boolean" },
        described_symptom: { type: "boolean" },
        symptom_text: { type: ["string", "null"] },
        declared_objective: { type: ["string", "null"], enum: ["tratar", "prevenir", "repor", "manter", null] },
        requested_recommendation: { type: "boolean" },
        is_consultative_turn: { type: "boolean" },
        asked_about_price: { type: "boolean" },
        asked_about_shipping: { type: "boolean" },
        asked_about_image: { type: "boolean" },
        mentioned_product_family: { type: ["string", "null"] },
        mentioned_product_name: { type: ["string", "null"] },
        should_broaden_catalog_for_pain: { type: "boolean" },
        confirmed_purchase_intent: { type: "boolean" },
        asked_about_payment_or_link: { type: "boolean" },
        is_support_topic: { type: "boolean" },
      },
      required: [
        "greeting_period", "asked_how_are_you", "is_pure_greeting",
        "described_symptom", "symptom_text", "declared_objective",
        "requested_recommendation", "is_consultative_turn",
        "asked_about_price", "asked_about_shipping", "asked_about_image",
        "mentioned_product_family", "mentioned_product_name",
        "should_broaden_catalog_for_pain",
        "confirmed_purchase_intent", "asked_about_payment_or_link",
        "is_support_topic",
      ],
    },
  },
} as const;

function emptyClassification(source: "llm" | "fallback", latency_ms = 0, raw_error?: string): TurnClassification {
  return {
    greeting_period: null,
    asked_how_are_you: false,
    is_pure_greeting: false,
    described_symptom: false,
    symptom_text: null,
    declared_objective: null,
    requested_recommendation: false,
    is_consultative_turn: false,
    asked_about_price: false,
    asked_about_shipping: false,
    asked_about_image: false,
    mentioned_product_family: null,
    mentioned_product_name: null,
    should_broaden_catalog_for_pain: false,
    confirmed_purchase_intent: false,
    asked_about_payment_or_link: false,
    is_support_topic: false,
    source,
    latency_ms,
    raw_error,
  };
}

export interface TPRInput {
  customerMessage: string;
  // Últimas N mensagens (cliente + bot) para contexto. Idealmente 4-6.
  recentHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  hasMediaAttachment?: boolean;
  // Catálogo conhecido — ajuda o classificador a marcar mentioned_product_name
  productNamesHint?: string[];
  timeoutMs?: number;
}

/**
 * Chama o TPR. Sempre retorna um objeto válido — em caso de erro,
 * retorna emptyClassification com source="fallback" e raw_error.
 */
export async function classifyTurn(input: TPRInput): Promise<TurnClassification> {
  const start = Date.now();

  const productHint = (input.productNamesHint || []).slice(0, 30).join(" | ");
  const historyText = (input.recentHistory || [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Cliente" : "Atendente"}: ${m.content}`)
    .join("\n");

  const userBlock =
    `MENSAGEM ATUAL DO CLIENTE:\n"${(input.customerMessage || "").slice(0, 800)}"\n\n` +
    (input.hasMediaAttachment ? `[O cliente enviou também uma IMAGEM/FOTO neste turno]\n\n` : "") +
    (historyText ? `HISTÓRICO RECENTE:\n${historyText}\n\n` : "") +
    (productHint ? `CATÁLOGO CONHECIDO (nomes possíveis):\n${productHint}\n\n` : "") +
    `Classifique o turno chamando a tool classify_turn.`;

  const requestBody = {
    messages: [
      { role: "system", content: TPR_SYSTEM },
      { role: "user", content: userBlock },
    ],
    tools: [TPR_TOOL],
    tool_choice: { type: "function", function: { name: "classify_turn" } },
    temperature: 0.1,
    max_tokens: 400,
  };

  const timeoutMs = input.timeoutMs ?? 4000;

  // ─── Caminho LEGADO (rollback de emergência via env TPR_USE_LEGACY_GATEWAY=1) ───
  if (USE_LEGACY_GATEWAY) {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return emptyClassification("fallback", Date.now() - start, "missing_LOVABLE_API_KEY");
    }
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(LEGACY_LOVABLE_AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: TPR_MODEL, ...requestBody }),
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!resp.ok) {
        const text = await resp.text();
        console.warn(`[turn-pre-router][legacy] HTTP ${resp.status}: ${text.slice(0, 200)}`);
        return emptyClassification("fallback", Date.now() - start, `http_${resp.status}`);
      }
      const data = await resp.json();
      const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return emptyClassification("fallback", Date.now() - start, "no_tool_call");
      const parsed = JSON.parse(argsStr);
      console.log(`[turn-pre-router] provider=lovable model=${TPR_MODEL} latency=${Date.now() - start}ms source=llm fallback=false (legacy)`);
      return { ...emptyClassification("llm", Date.now() - start), ...parsed, source: "llm", latency_ms: Date.now() - start, provider: "lovable", model: TPR_MODEL };
    } catch (e) {
      clearTimeout(t);
      const msg = (e as Error)?.message || String(e);
      console.warn(`[turn-pre-router][legacy] error: ${msg}`);
      return emptyClassification("fallback", Date.now() - start, msg.slice(0, 120));
    }
  }

  // ─── Caminho NOVO (Fase 1 AI Provider Routing): ai-router com fallback ───
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || undefined;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || undefined;

  // Timeout via Promise.race — o router não aceita AbortSignal direto.
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`tpr_timeout_${timeoutMs}ms`)), timeoutMs),
  );

  try {
    const result = await Promise.race([
      aiChatCompletionJSON(TPR_MODEL, requestBody, {
        supabaseUrl,
        supabaseServiceKey,
        logPrefix: "[turn-pre-router][router]",
        // TPR é latency-sensitive: poucos retries por provider, fallback rápido.
        maxRetries: 1,
        baseDelayMs: 1500,
      }),
      timeoutPromise,
    ]);

    const argsStr = result.data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      console.warn(`[turn-pre-router] no_tool_call provider=${result.provider} model=${result.model}`);
      return emptyClassification("fallback", Date.now() - start, "no_tool_call");
    }
    const parsed = JSON.parse(argsStr);
    const latency = Date.now() - start;
    console.log(`[turn-pre-router] provider=${result.provider} model=${result.model} latency=${latency}ms source=llm fallback=${result.provider !== 'gemini' ? 'true' : 'false'}`);
    return {
      ...emptyClassification("llm", latency),
      ...parsed,
      source: "llm",
      latency_ms: latency,
      provider: (result.provider as "gemini" | "openai" | "lovable") ?? null,
      model: result.model ?? null,
    };
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.warn(`[turn-pre-router] all providers failed or timeout: ${msg}`);
    return emptyClassification("fallback", Date.now() - start, msg.slice(0, 120));
  }
}

/**
 * Para uso em fallback: extrai sinais determinísticos básicos quando o
 * TPR falha. NÃO substitui o TPR — é uma rede mínima para não regredir.
 */
export function fallbackClassification(message: string, hasMedia = false): TurnClassification {
  const m = (message || "").toLowerCase();
  const period: TurnGreetingPeriod =
    /\bbom dia\b/.test(m) ? "bom dia" :
    /\bboa tarde\b/.test(m) ? "boa tarde" :
    /\bboa noite\b/.test(m) ? "boa noite" : null;

  const hasSymptom = /\b(tenho|estou com|sofro|minha|meu|coroa|entrada|calv|queda|caspa|seborr|oleos|caind)/i.test(message || "");
  const askedRec = /\b(recomenda|indica|sugere|melhor pra mim|resolve|melhor caso|qual.*tratamento|qual.*shampoo)/i.test(message || "");
  const askedPrice = /\b(quanto|pre[çc]o|valor|desconto|cupom|barat)/i.test(message || "");
  const askedImage = /\b(foto|imagem|figura|me mostra)/i.test(message || "");
  const askedShipping = /\b(frete|entrega|prazo|chega quando|chega em)/i.test(message || "");
  const buy = /\b(quero|vou levar|fecha|manda o link|pode adicionar|finaliza)/i.test(message || "");

  return {
    ...emptyClassification("fallback"),
    greeting_period: period,
    asked_how_are_you: /\b(tudo bem|tudo bom|td bem|td bom|beleza|blz)\b/.test(m),
    is_pure_greeting: !!period && (message || "").trim().length < 30 && !hasSymptom && !askedRec && !buy,
    described_symptom: hasSymptom,
    symptom_text: hasSymptom ? message.slice(0, 160) : null,
    requested_recommendation: askedRec,
    is_consultative_turn: (hasSymptom ? 1 : 0) + (askedRec ? 1 : 0) + (hasMedia ? 1 : 0) >= 2,
    asked_about_price: askedPrice,
    asked_about_shipping: askedShipping,
    asked_about_image: askedImage,
    should_broaden_catalog_for_pain: hasSymptom,
    confirmed_purchase_intent: buy,
    asked_about_payment_or_link: /\b(link|pagar|pagamento|pix|boleto|cart[ãa]o)\b/i.test(message || ""),
  };
}
