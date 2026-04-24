// Edge Function: ai-signal-capture
// Captura contínua de sinais regenerativos de uma conversa finalizada.
// Aplica 6 filtros de qualidade, deduplica semanticamente via Gemini,
// persiste candidatos e dispara alertas críticos quando aplicável.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ---------- TIPOS ----------
type InsightType =
  | "linguagem"
  | "dor"
  | "objecao"
  | "motivo_nao_fechamento"
  | "oportunidade"
  | "problema_operacional"
  | "tendencia";

interface SignalExtraction {
  insight_type: InsightType;
  raw_text: string;
  canonical_concept: string;
  severity: "low" | "normal" | "high";
  is_critical: boolean;
  product_hint?: string | null;
}

interface CriticalAlert {
  category: string;
  title: string;
  description: string;
  trigger_text: string;
}

interface RequestBody {
  tenant_id: string;
  conversation_id?: string;
  customer_id?: string | null;
  customer_phone?: string | null;
  channel?: string;
  messages: Array<{
    role: "customer" | "agent" | "system" | "assistant" | "user";
    content: string;
    created_at?: string;
  }>;
}

// ---------- FILTROS DE QUALIDADE (PRÉ-IA) ----------
const SPAM_PATTERNS = [
  /\b(bit\.ly|tinyurl|t\.me\/|wa\.me\/promo|ganhe\s+\$|click\s+here)\b/i,
  /(.)\1{15,}/, // 15+ caracteres repetidos
  /\b(free\s+money|earn\s+\$|crypto\s+invest|onlyfans)\b/i,
];

const TEST_KEYWORDS = ["teste interno", "ignorar mensagem", "[teste]", "qa-test"];

const TRIVIAL_MESSAGES = ["oi", "ola", "olá", "ok", "okay", "obrigado", "obrigada", "valeu", "tchau", ".", "?", "👍", "🙏"];

function isSpam(text: string): boolean {
  return SPAM_PATTERNS.some((p) => p.test(text));
}

function isTest(text: string): boolean {
  const lower = text.toLowerCase();
  return TEST_KEYWORDS.some((k) => lower.includes(k));
}

function isTrivial(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[!.,?]/g, "");
  return cleaned.length < 4 || TRIVIAL_MESSAGES.includes(cleaned);
}

function looksLikeAILoop(messages: RequestBody["messages"]): boolean {
  // 5+ mensagens consecutivas do agente sem resposta do cliente
  let consecutiveAgent = 0;
  for (const m of messages) {
    if (m.role === "agent" || m.role === "assistant") {
      consecutiveAgent++;
      if (consecutiveAgent >= 5) return true;
    } else if (m.role === "customer" || m.role === "user") {
      consecutiveAgent = 0;
    }
  }
  return false;
}

function applyQualityFilters(body: RequestBody): { ok: boolean; reason?: string } {
  const customerMessages = body.messages.filter(
    (m) => m.role === "customer" || m.role === "user"
  );

  if (customerMessages.length === 0) return { ok: false, reason: "sem_mensagens_cliente" };

  const allText = customerMessages.map((m) => m.content || "").join(" ");

  if (isSpam(allText)) return { ok: false, reason: "spam" };
  if (isTest(allText)) return { ok: false, reason: "teste_interno" };
  if (looksLikeAILoop(body.messages)) return { ok: false, reason: "loop_ia" };

  // sobra apenas mensagens não-triviais
  const meaningful = customerMessages.filter((m) => !isTrivial(m.content || ""));
  if (meaningful.length === 0) return { ok: false, reason: "conteudo_irrelevante" };

  return { ok: true };
}

// ---------- DETECÇÃO DE PROBLEMAS CRÍTICOS (regex rápida) ----------
const CRITICAL_PATTERNS: Array<{ pattern: RegExp; category: string; title: string }> = [
  { pattern: /\b(n[aã]o\s+consigo\s+(comprar|finalizar|pagar)|checkout\s+(travou|n[aã]o\s+funciona))\b/i, category: "checkout", title: "Cliente não consegue finalizar compra" },
  { pattern: /\b(site\s+(fora\s+do\s+ar|n[aã]o\s+abre|caiu)|p[aá]gina\s+n[aã]o\s+carrega)\b/i, category: "site", title: "Site fora do ar / não carrega" },
  { pattern: /\b(pagamento\s+(n[aã]o\s+passa|recusado|com\s+erro)|cart[aã]o\s+(recusado|n[aã]o\s+passa))\b/i, category: "pagamento", title: "Falha de pagamento" },
  { pattern: /\b(produto\s+n[aã]o\s+chegou|n[aã]o\s+recebi.*pedido|cad[eê]\s+meu\s+pedido)\b/i, category: "entrega", title: "Cliente não recebeu o produto" },
  { pattern: /\b(n[aã]o\s+consigo\s+(entrar|logar|acessar)|login\s+(n[aã]o\s+funciona|com\s+erro))\b/i, category: "login", title: "Falha de login" },
];

function detectCriticalIssues(messages: RequestBody["messages"]): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];
  const customerMsgs = messages.filter((m) => m.role === "customer" || m.role === "user");
  for (const msg of customerMsgs) {
    const text = msg.content || "";
    for (const { pattern, category, title } of CRITICAL_PATTERNS) {
      if (pattern.test(text)) {
        alerts.push({
          category,
          title,
          description: `Detectado em mensagem do cliente: "${text.substring(0, 200)}"`,
          trigger_text: text.substring(0, 500),
        });
        break;
      }
    }
  }
  return alerts;
}

// ---------- EXTRAÇÃO SEMÂNTICA VIA GEMINI ----------
async function extractSignalsViaAI(
  messages: RequestBody["messages"]
): Promise<SignalExtraction[]> {
  const conversation = messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n");

  const systemPrompt = `Você é um analista de sinais regenerativos de atendimento.
Sua tarefa: ler uma conversa e extrair APENAS sinais valiosos para enriquecer o cérebro de IAs comerciais.

Tipos válidos de sinal:
- "linguagem": gírias/expressões usadas pelo cliente
- "dor": dor recorrente, problema sentido pelo cliente
- "objecao": objeção a comprar/contratar (preço, prazo, qualidade...)
- "motivo_nao_fechamento": razão pela qual o cliente desistiu/não comprou
- "oportunidade": oportunidade comercial (cross-sell, upsell, novo produto, novo público)
- "problema_operacional": problema interno do negócio (estoque, frete, atendimento)
- "tendencia": tendência observada (mudança de comportamento, novo interesse)

Para cada sinal, extraia também:
- raw_text: trecho original literal do cliente
- canonical_concept: conceito normalizado em 3-6 palavras (ex: "Percepção de preço alto", "Reclamação de prazo de entrega")
- severity: "low" | "normal" | "high"
- is_critical: true se for problema operacional grave (não funciona, fora do ar, não chegou)

REGRAS:
- Só extraia sinais REAIS e CLAROS. Conversa banal/cumprimentos = retorne array vazio.
- Não invente. Não generalize.
- Máximo 5 sinais por conversa.
- Responda apenas via tool call.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "extract_signals",
        description: "Extrai sinais regenerativos da conversa",
        parameters: {
          type: "object",
          properties: {
            signals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  insight_type: {
                    type: "string",
                    enum: ["linguagem", "dor", "objecao", "motivo_nao_fechamento", "oportunidade", "problema_operacional", "tendencia"],
                  },
                  raw_text: { type: "string" },
                  canonical_concept: { type: "string" },
                  severity: { type: "string", enum: ["low", "normal", "high"] },
                  is_critical: { type: "boolean" },
                  product_hint: { type: "string" },
                },
                required: ["insight_type", "raw_text", "canonical_concept", "severity", "is_critical"],
                additionalProperties: false,
              },
            },
          },
          required: ["signals"],
          additionalProperties: false,
        },
      },
    },
  ];

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: conversation },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "extract_signals" } },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI extraction failed:", resp.status, t);
    return [];
  }

  const data = await resp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return [];

  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    return (parsed.signals || []) as SignalExtraction[];
  } catch (e) {
    console.error("Failed to parse AI tool args:", e);
    return [];
  }
}

// ---------- DEDUPLICAÇÃO / AGRUPAMENTO CANÔNICO ----------
async function findOrCreateCanonicalGroup(
  supabase: any,
  tenantId: string,
  signal: SignalExtraction,
): Promise<string> {
  // Busca grupo existente com mesmo tipo e label canônico (case-insensitive)
  const { data: existing } = await supabase
    .from("ai_signal_canonical_groups")
    .select("id, variations, evidence_count")
    .eq("tenant_id", tenantId)
    .eq("insight_type", signal.insight_type)
    .ilike("canonical_label", signal.canonical_concept)
    .maybeSingle();

  if (existing) {
    const variations: string[] = (existing as any).variations || [];
    if (!variations.includes(signal.raw_text)) {
      variations.push(signal.raw_text);
    }
    await supabase
      .from("ai_signal_canonical_groups")
      .update({
        variations,
        evidence_count: ((existing as any).evidence_count || 0) + 1,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", (existing as any).id);
    return (existing as any).id as string;
  }

  // Cria novo grupo canônico
  const { data: created, error } = await supabase
    .from("ai_signal_canonical_groups")
    .insert({
      tenant_id: tenantId,
      insight_type: signal.insight_type,
      canonical_label: signal.canonical_concept,
      variations: [signal.raw_text],
      evidence_count: 1,
      unique_customer_count: 1,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("Failed to create canonical group:", error);
    throw error;
  }

  return (created as any).id as string;
}

// ---------- HANDLER ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body?.tenant_id || !Array.isArray(body?.messages)) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id e messages são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Aplicar filtros de qualidade
    const filter = applyQualityFilters(body);
    if (!filter.ok) {
      // Registrar 1 candidato descartado para auditoria
      await supabase.from("ai_signal_candidates").insert({
        tenant_id: body.tenant_id,
        conversation_id: body.conversation_id,
        customer_id: body.customer_id,
        source_channel: body.channel || "whatsapp",
        insight_type: "tendencia", // placeholder; status=descartado
        raw_text: "[conversa filtrada]",
        status: "descartado",
        filter_reason: filter.reason,
      });

      return new Response(
        JSON.stringify({ success: true, filtered: true, reason: filter.reason }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Detectar problemas críticos imediatos (regex)
    const criticalAlerts = detectCriticalIssues(body.messages);
    for (const alert of criticalAlerts) {
      await supabase.from("ai_critical_alerts").insert({
        tenant_id: body.tenant_id,
        category: alert.category,
        title: alert.title,
        description: alert.description,
        trigger_text: alert.trigger_text,
        conversation_id: body.conversation_id,
        customer_id: body.customer_id,
        status: "aberto",
      });
    }

    // 3. Extrair sinais via IA (Gemini)
    const signals = await extractSignalsViaAI(body.messages);

    // 4. Persistir cada sinal + agrupar canonicamente
    const persisted: string[] = [];
    for (const sig of signals) {
      try {
        const groupId = await findOrCreateCanonicalGroup(supabase, body.tenant_id, sig);

        const { data: cand, error: candErr } = await supabase
          .from("ai_signal_candidates")
          .insert({
            tenant_id: body.tenant_id,
            conversation_id: body.conversation_id,
            customer_id: body.customer_id,
            source_channel: body.channel || "whatsapp",
            insight_type: sig.insight_type,
            raw_text: sig.raw_text,
            canonical_concept: sig.canonical_concept,
            canonical_group_id: groupId,
            severity: sig.severity,
            is_critical: sig.is_critical,
            status: "agrupado",
            metadata: { product_hint: sig.product_hint || null },
          })
          .select("id")
          .single();

        if (!candErr && cand) persisted.push((cand as any).id);
      } catch (e) {
        console.error("Failed to persist signal:", e);
      }
    }

    // 5. Atualizar contagem de clientes únicos por grupo (recalculo simples)
    if (body.customer_id && persisted.length > 0) {
      const groupIds = await supabase
        .from("ai_signal_candidates")
        .select("canonical_group_id")
        .in("id", persisted);

      const uniqueGroups = [...new Set((groupIds.data || []).map((r: any) => r.canonical_group_id).filter(Boolean))];

      for (const gid of uniqueGroups) {
        const { count } = await supabase
          .from("ai_signal_candidates")
          .select("customer_id", { count: "exact", head: true })
          .eq("canonical_group_id", gid)
          .not("customer_id", "is", null);

        if (typeof count === "number") {
          // contagem de únicos via query separada
          const { data: uniques } = await supabase
            .from("ai_signal_candidates")
            .select("customer_id")
            .eq("canonical_group_id", gid)
            .not("customer_id", "is", null);

          const uniqueCount = new Set((uniques || []).map((r: any) => r.customer_id)).size;
          await supabase
            .from("ai_signal_canonical_groups")
            .update({ unique_customer_count: uniqueCount })
            .eq("id", gid);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        signals_extracted: signals.length,
        signals_persisted: persisted.length,
        critical_alerts: criticalAlerts.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-signal-capture error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
