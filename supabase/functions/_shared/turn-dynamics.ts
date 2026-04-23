// =============================================================
// Turn Dynamics — Pacotes A, B, C, D, E, F
//
// Helpers cirúrgicos para a dinâmica de turno do WhatsApp.
// Toda observabilidade aqui é tolerante a falha (try/catch local).
// NUNCA lança exceção que possa derrubar webhook ou IA.
//
// Pacotes:
//  A) Debounce/agrupamento de mensagens curtas (whatsapp_inbound_debounce)
//  B) Lock de turno em `conversations.metadata.processing_lock`
//  C) Detecção de continuação de contexto pendente (sem reabrir)
//  D) Detector de stall: a IA prometeu e não chamou tool
//  E) Anti-duplicidade fora do hash (lookup recente)
//  F) Observabilidade extra (campos opcionais em ai_support_turn_log.metadata)
// =============================================================

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

// Janela de debounce padrão (ms) — mensagens chegando em sequência
// dentro desta janela são tratadas como UM único turno.
export const DEBOUNCE_WINDOW_MS = 6000;

// TTL do lock de processamento (ms) — após isso o lock é considerado morto
// (defesa contra cold-start travado / função que crashou no meio).
export const PROCESSING_LOCK_TTL_MS = 45_000;

// Janela em que uma resposta da IA é considerada "candidata a duplicata"
// se o hash bate. (Pacote E)
export const RECENT_RESPONSE_DEDUP_WINDOW_MS = 60_000;

// =============================================================
// PACOTE A — Debounce / agrupamento
// =============================================================

export interface EnqueueDebounceInput {
  supabase: SupabaseLike;
  tenant_id: string;
  conversation_id: string | null;
  customer_phone: string;
  message_id: string | null;
  external_message_id: string | null;
  message_content: string;
  windowMs?: number;
}

export interface EnqueueDebounceResult {
  enqueued: boolean;
  // Se for true, o caller DEVE aguardar a janela e processar APENAS
  // se for o "owner" do flush (ou seja, sua linha foi a última na janela).
  shouldWait: boolean;
  flushAt: Date;
  reason: string;
  rowId?: string;
}

/**
 * Enfileira uma mensagem inbound na fila de debounce. Retorna shouldWait=true
 * se o caller deve aguardar a janela e tentar virar owner do flush.
 *
 * Tolerante a falha: se o INSERT falhar, retorna shouldWait=false (o caller
 * processa imediatamente, sem agrupamento). NUNCA derruba o webhook.
 */
export async function enqueueInboundForDebounce(
  input: EnqueueDebounceInput,
): Promise<EnqueueDebounceResult> {
  const windowMs = input.windowMs ?? DEBOUNCE_WINDOW_MS;
  const flushAt = new Date(Date.now() + windowMs);
  try {
    const { data, error } = await input.supabase
      .from("whatsapp_inbound_debounce")
      .insert({
        tenant_id: input.tenant_id,
        conversation_id: input.conversation_id,
        customer_phone: input.customer_phone,
        message_id: input.message_id,
        external_message_id: input.external_message_id,
        message_content: (input.message_content || "").slice(0, 2000),
        flush_at: flushAt.toISOString(),
        status: "pending",
      })
      .select("id")
      .single();
    if (error) {
      console.error("[turn-dynamics] enqueueInboundForDebounce failed (non-blocking):", error);
      return { enqueued: false, shouldWait: false, flushAt, reason: "enqueue_failed" };
    }
    return {
      enqueued: true,
      shouldWait: true,
      flushAt,
      reason: "enqueued",
      rowId: data?.id,
    };
  } catch (err) {
    console.error("[turn-dynamics] enqueueInboundForDebounce threw (non-blocking):", err);
    return { enqueued: false, shouldWait: false, flushAt, reason: "enqueue_threw" };
  }
}

export interface FlushDebounceResult {
  isOwner: boolean;
  mergedCount: number;
  mergedContents: string[];
  pendingRows: string[];
  reason: string;
}

/**
 * Após a janela de debounce, tenta virar OWNER do flush para esse (tenant, phone).
 * Apenas o owner segue para invocar a IA.
 *
 * Estratégia:
 *  - Lê todas as linhas pending desse (tenant_id, customer_phone) com flush_at <= now.
 *  - A linha com received_at MAIS RECENTE é considerada owner.
 *  - Se a linha indicada por `selfRowId` for o owner, retorna isOwner=true,
 *    marca todas as linhas como flushed/merged e devolve o conteúdo agrupado.
 *  - Caso contrário, retorna isOwner=false (outra mensagem ainda mais nova
 *    deve cuidar do flush).
 */
export async function tryClaimDebounceFlush(
  supabase: SupabaseLike,
  tenant_id: string,
  customer_phone: string,
  selfRowId: string,
): Promise<FlushDebounceResult> {
  try {
    const { data: pendingRows, error } = await supabase
      .from("whatsapp_inbound_debounce")
      .select("id, message_content, received_at")
      .eq("tenant_id", tenant_id)
      .eq("customer_phone", customer_phone)
      .eq("status", "pending")
      .order("received_at", { ascending: true });

    if (error || !pendingRows || pendingRows.length === 0) {
      return {
        isOwner: false,
        mergedCount: 0,
        mergedContents: [],
        pendingRows: [],
        reason: error ? "query_failed" : "no_pending",
      };
    }

    const owner = pendingRows[pendingRows.length - 1];
    if (owner.id !== selfRowId) {
      return {
        isOwner: false,
        mergedCount: pendingRows.length,
        mergedContents: pendingRows.map((r: any) => String(r.message_content || "")),
        pendingRows: pendingRows.map((r: any) => r.id),
        reason: "not_owner",
      };
    }

    // Eu sou o owner: marco todas as linhas como flushed (a minha) ou merged (as outras).
    const otherIds = pendingRows
      .filter((r: any) => r.id !== selfRowId)
      .map((r: any) => r.id);

    try {
      await supabase
        .from("whatsapp_inbound_debounce")
        .update({ status: "flushed", flushed_at: new Date().toISOString() })
        .eq("id", selfRowId);
      if (otherIds.length > 0) {
        await supabase
          .from("whatsapp_inbound_debounce")
          .update({ status: "merged", flushed_at: new Date().toISOString() })
          .in("id", otherIds);
      }
    } catch (updErr) {
      console.error("[turn-dynamics] flush update failed (non-blocking):", updErr);
    }

    return {
      isOwner: true,
      mergedCount: pendingRows.length,
      mergedContents: pendingRows.map((r: any) => String(r.message_content || "")),
      pendingRows: pendingRows.map((r: any) => r.id),
      reason: "owner",
    };
  } catch (err) {
    console.error("[turn-dynamics] tryClaimDebounceFlush threw (non-blocking):", err);
    return {
      isOwner: false,
      mergedCount: 0,
      mergedContents: [],
      pendingRows: [],
      reason: "threw",
    };
  }
}

// =============================================================
// PACOTE B — Lock de turno (em conversations.metadata.processing_lock)
// =============================================================

export interface ProcessingLock {
  locked_at: string; // ISO
  lock_id: string;
  reason?: string;
}

/**
 * Tenta adquirir o lock de processamento da conversa.
 * Implementação simples (single-tenant Postgres serializa updates por linha):
 *  - Lê metadata atual.
 *  - Se já houver um lock vivo (dentro do TTL), retorna acquired=false.
 *  - Caso contrário, faz update com o novo lock e retorna acquired=true.
 *
 * Tolerante a falha: se qualquer leitura/escrita falhar, retorna
 * acquired=true (FAIL-OPEN). Justificativa: o pior cenário é processar
 * em paralelo (igual ao comportamento de hoje); FAIL-CLOSED arriscaria
 * silenciar o cliente, o que é INACEITÁVEL na regra do usuário.
 */
export async function acquireProcessingLock(
  supabase: SupabaseLike,
  conversation_id: string,
  reason: string = "ai_turn",
): Promise<{ acquired: boolean; lock_id?: string; existing?: ProcessingLock; reason?: string }> {
  const lock_id = crypto.randomUUID();
  try {
    const { data: convRow, error } = await supabase
      .from("conversations")
      .select("metadata")
      .eq("id", conversation_id)
      .maybeSingle();
    if (error) {
      console.error("[turn-dynamics] lock read failed (fail-open):", error);
      return { acquired: true, lock_id, reason: "fail_open_read_error" };
    }

    const metadata: Record<string, unknown> = (convRow?.metadata as Record<string, unknown>) || {};
    const existingLock = metadata.processing_lock as ProcessingLock | undefined;
    if (existingLock?.locked_at) {
      const lockedAt = Date.parse(existingLock.locked_at);
      if (Number.isFinite(lockedAt) && Date.now() - lockedAt < PROCESSING_LOCK_TTL_MS) {
        return { acquired: false, existing: existingLock, reason: "lock_alive" };
      }
    }

    const newLock: ProcessingLock = {
      locked_at: new Date().toISOString(),
      lock_id,
      reason,
    };
    const newMeta = { ...metadata, processing_lock: newLock };

    const { error: updErr } = await supabase
      .from("conversations")
      .update({ metadata: newMeta })
      .eq("id", conversation_id);
    if (updErr) {
      console.error("[turn-dynamics] lock write failed (fail-open):", updErr);
      return { acquired: true, lock_id, reason: "fail_open_write_error" };
    }

    return { acquired: true, lock_id, reason: "acquired" };
  } catch (err) {
    console.error("[turn-dynamics] acquireProcessingLock threw (fail-open):", err);
    return { acquired: true, lock_id, reason: "fail_open_threw" };
  }
}

export async function releaseProcessingLock(
  supabase: SupabaseLike,
  conversation_id: string,
  lock_id: string,
): Promise<void> {
  try {
    const { data: convRow } = await supabase
      .from("conversations")
      .select("metadata")
      .eq("id", conversation_id)
      .maybeSingle();
    const metadata: Record<string, unknown> = (convRow?.metadata as Record<string, unknown>) || {};
    const existing = metadata.processing_lock as ProcessingLock | undefined;
    if (!existing || existing.lock_id !== lock_id) {
      // Não é meu lock — não toco
      return;
    }
    const { processing_lock: _drop, ...rest } = metadata;
    await supabase.from("conversations").update({ metadata: rest }).eq("id", conversation_id);
  } catch (err) {
    console.error("[turn-dynamics] releaseProcessingLock failed (non-blocking):", err);
  }
}

// =============================================================
// PACOTE C — Continuação de contexto pendente
// =============================================================

// Mensagens curtas/cobranças que NÃO devem ser tratadas como greeting/reabertura
// quando há contexto comercial vivo.
const CONTINUATION_PATTERNS: RegExp[] = [
  /^\s*e\s*a[ií]\s*[?.!]*\s*$/i,
  /^\s*e\s*entao\s*[?.!]*\s*$/i,
  /^\s*e\s*ent[aã]o\s*[?.!]*\s*$/i,
  /^\s*me\s*responde\s*[?.!]*\s*$/i,
  /^\s*responde\s*[?.!]*\s*$/i,
  /^\s*voc[eê]\s+ficou\s+de\s+ver/i,
  /^\s*voc[eê]\s+ia\s+ver/i,
  /^\s*cad[eê]\s+/i,
  /^\s*\?+\s*$/,
  /^\s*(e|hein|alo|al[oô])\s*[?.!]*\s*$/i,
  /^\s*(esqueceu|esqueceram)\b/i,
];

/** Estados em que existe pendência comercial viva → continuação faz sentido. */
const STATES_WITH_PENDING_CONTEXT = new Set<string>([
  "discovery",
  "recommendation",
  "consideration",
  "decision",
  "cart",
  "checkout",
]);

export interface ContinuationContext {
  isContinuation: boolean;
  reason: string;
  matchedPattern?: string;
  salesState?: string | null;
  minutesSinceLastBot?: number | null;
}

/**
 * Decide se a mensagem deve ser tratada como CONTINUAÇÃO de pendência (não greeting).
 *
 * Regras:
 *  - Mensagem curta (≤ 25 chars) E que bate em algum padrão de cobrança/continuação.
 *  - E o estado da conversa está em algum estado com pendência viva.
 *  - E houve resposta da IA nas últimas 60 minutos (conversa "viva").
 */
export function detectContinuation(input: {
  message: string;
  salesState?: string | null;
  lastBotResponseAtIso?: string | null;
  liveWindowMinutes?: number;
}): ContinuationContext {
  const msg = (input.message || "").trim();
  const liveWindowMin = input.liveWindowMinutes ?? 60;

  if (!msg || msg.length > 40) {
    return { isContinuation: false, reason: "msg_too_long_or_empty", salesState: input.salesState ?? null };
  }
  const matched = CONTINUATION_PATTERNS.find(re => re.test(msg));
  if (!matched) {
    return { isContinuation: false, reason: "no_pattern_match", salesState: input.salesState ?? null };
  }
  const stateOk = input.salesState
    ? STATES_WITH_PENDING_CONTEXT.has(input.salesState)
    : false;
  if (!stateOk) {
    return {
      isContinuation: false,
      reason: "no_pending_state",
      salesState: input.salesState ?? null,
      matchedPattern: String(matched),
    };
  }

  let minutesSinceLastBot: number | null = null;
  if (input.lastBotResponseAtIso) {
    const ts = Date.parse(input.lastBotResponseAtIso);
    if (Number.isFinite(ts)) {
      minutesSinceLastBot = (Date.now() - ts) / 60000;
    }
  }
  if (minutesSinceLastBot !== null && minutesSinceLastBot > liveWindowMin) {
    return {
      isContinuation: false,
      reason: "conversation_stale",
      salesState: input.salesState ?? null,
      matchedPattern: String(matched),
      minutesSinceLastBot,
    };
  }

  return {
    isContinuation: true,
    reason: "continuation_detected",
    matchedPattern: String(matched),
    salesState: input.salesState ?? null,
    minutesSinceLastBot,
  };
}

// =============================================================
// PACOTE D — Detector de stall (promessa não cumprida)
// =============================================================

const STALL_PROMISE_PATTERNS: RegExp[] = [
  /\bdeixa\s+eu\s+ver\b/i,
  /\bdeixe\s+me\s+ver\b/i,
  /\bvou\s+(ver|verificar|consultar|conferir|olhar|buscar|checar)\b/i,
  /\baguarda\s+um\s+(instante|momento|minuto|segundo)/i,
  /\bs[oó]\s+um\s+(instante|momento|minuto|segundo)/i,
  /\bj[aá]\s+(te\s+)?(retorno|respondo|envio)\b/i,
  /\bvolto\s+j[aá]\b/i,
];

export interface StallDetectionInput {
  responseText: string;
  toolsCalled: string[];
  salesState: string | null | undefined;
}

export interface StallDetection {
  isStalled: boolean;
  matchedPromise?: string;
  reason: string;
}

/**
 * Detecta promessa de continuidade ("deixa eu ver…") sem nenhuma tool sendo chamada.
 * Quando o estado é comercial e a IA promete mas não age, marca para retry.
 */
export function detectStallPromise(input: StallDetectionInput): StallDetection {
  const text = input.responseText || "";
  if (!text) return { isStalled: false, reason: "empty_response" };

  const matched = STALL_PROMISE_PATTERNS.find(re => re.test(text));
  if (!matched) return { isStalled: false, reason: "no_promise_pattern" };

  // Se já chamou alguma tool de busca/detalhe, não é stall.
  const productTools = new Set([
    "search_products",
    "get_product_details",
    "get_product_variants",
    "recommend_related_products",
  ]);
  const calledProductTool = (input.toolsCalled || []).some(t => productTools.has(t));
  if (calledProductTool) {
    return { isStalled: false, reason: "tool_called", matchedPromise: String(matched) };
  }

  // Stall só faz sentido em estados comerciais ativos.
  const state = input.salesState || "";
  const commercialStates = new Set([
    "discovery", "recommendation", "consideration", "decision",
  ]);
  if (!commercialStates.has(state)) {
    return { isStalled: false, reason: "non_commercial_state", matchedPromise: String(matched) };
  }

  return { isStalled: true, matchedPromise: String(matched), reason: "promise_without_tool" };
}

// =============================================================
// PACOTE E — Anti-duplicidade extra (lookup recente de hash)
// =============================================================

/**
 * Verifica se já existe uma mensagem AI gerada para esta conversa
 * com o mesmo hash dentro da janela de dedup. Usado pelo meta-whatsapp-send
 * como segunda barreira (a primeira é hash em conversations.last_bot_response_hash).
 */
export async function isDuplicateRecentResponse(
  supabase: SupabaseLike,
  conversation_id: string,
  responseHash: string,
  windowMs: number = RECENT_RESPONSE_DEDUP_WINDOW_MS,
): Promise<{ duplicate: boolean; reason: string }> {
  try {
    const sinceIso = new Date(Date.now() - windowMs).toISOString();
    const { data, error } = await supabase
      .from("ai_support_turn_log")
      .select("id, response_hash, created_at")
      .eq("conversation_id", conversation_id)
      .eq("response_hash", responseHash)
      .gte("created_at", sinceIso)
      .limit(2);
    if (error) return { duplicate: false, reason: "lookup_failed" };
    // Se houver pelo menos 2 com o mesmo hash recente, considera duplicata.
    if ((data?.length ?? 0) >= 2) {
      return { duplicate: true, reason: "hash_repeated_recent" };
    }
    return { duplicate: false, reason: "ok" };
  } catch {
    return { duplicate: false, reason: "threw_safe_default" };
  }
}
