// =============================================================
// Phase 1 — Shared AI decision gate (single source of truth)
// =============================================================
// Used by ALL inbound webhooks (Meta WhatsApp, Z-API support-webhook,
// Meta Page/Messenger, Instagram, Email) to decide if the AI engine
// should be invoked AFTER the inbound message is already persisted.
//
// CRITICAL CONTRACT:
// - This helper NEVER blocks message ingestion.
// - It only decides whether to fire the AI response.
// - The actual final hard gate (channel_accounts.is_active) lives
//   inside ai-support-chat (Universal Gate), so even if a webhook
//   calls the engine by mistake the channel guard still applies.
// =============================================================

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export type AiDecisionReason =
  | "ok"
  | "ai_global_disabled"
  | "ai_channel_disabled"
  | "channel_not_active"
  | "human_assigned"
  | "conversation_in_human_state"
  | "missing_inputs";

export interface AiDecision {
  should_respond: boolean;
  reason: AiDecisionReason;
  /**
   * Status that NEW conversations should be created with.
   * - "bot" when the AI will own the conversation.
   * - "new" when the conversation must wait for a human.
   * Existing conversations should NEVER be re-set based on this value.
   */
  initial_status_for_new_conversation: "bot" | "new";
  details: Record<string, unknown>;
}

export interface ShouldAiRespondInput {
  supabase: SupabaseLike;
  tenant_id: string;
  channel_type: string;
  /**
   * Existing conversation snapshot (when the message belongs to one
   * that already exists). When the conversation is brand new, leave
   * undefined so the gate uses only the channel-level signals.
   */
  conversation?: {
    id?: string;
    status?: string | null;
    assigned_to?: string | null;
  } | null;
}

/**
 * Decide if the AI should respond to a freshly ingested inbound message.
 *
 * This function does NOT throw. It always returns an AiDecision so that
 * the caller can keep the inbound persistence path running normally.
 */
export async function shouldAiRespond(
  input: ShouldAiRespondInput,
): Promise<AiDecision> {
  const { supabase, tenant_id, channel_type, conversation } = input;

  if (!supabase || !tenant_id || !channel_type) {
    return {
      should_respond: false,
      reason: "missing_inputs",
      initial_status_for_new_conversation: "new",
      details: { tenant_id, channel_type },
    };
  }

  // 1) channel_accounts.is_active — fonte de verdade do canal
  const { data: channelAccount } = await supabase
    .from("channel_accounts")
    .select("is_active")
    .eq("tenant_id", tenant_id)
    .eq("channel_type", channel_type)
    .maybeSingle();

  // Default behavior: if the row does not exist yet, treat the channel
  // as enabled so we do not silently block tenants that never opened the
  // canal panel. The Universal Gate inside ai-support-chat will still
  // refuse to respond when the row is genuinely missing.
  const channelActive = channelAccount?.is_active !== false;

  // 2) ai_support_config.is_enabled — global IA toggle
  const { data: aiConfig } = await supabase
    .from("ai_support_config")
    .select("is_enabled")
    .eq("tenant_id", tenant_id)
    .maybeSingle();

  const aiGlobalEnabled = aiConfig?.is_enabled === true;

  // 3) ai_channel_config.is_enabled — IA por canal (default true se não houver row)
  const { data: channelAiConfig } = await supabase
    .from("ai_channel_config")
    .select("is_enabled")
    .eq("tenant_id", tenant_id)
    .eq("channel_type", channel_type)
    .maybeSingle();

  const aiChannelEnabled = channelAiConfig?.is_enabled !== false;

  const aiCouldRespond = aiGlobalEnabled && aiChannelEnabled && channelActive;

  // initial_status_for_new_conversation só depende dos toggles de IA/canal,
  // pois é usado apenas quando NÃO há conversa anterior. Conversas existentes
  // mantêm o status atual (regra estrutural: webhook nunca rebaixa estado).
  const initialStatus: "bot" | "new" = aiCouldRespond ? "bot" : "new";

  if (!aiGlobalEnabled) {
    return {
      should_respond: false,
      reason: "ai_global_disabled",
      initial_status_for_new_conversation: initialStatus,
      details: { aiGlobalEnabled, aiChannelEnabled, channelActive },
    };
  }
  if (!aiChannelEnabled) {
    return {
      should_respond: false,
      reason: "ai_channel_disabled",
      initial_status_for_new_conversation: initialStatus,
      details: { aiGlobalEnabled, aiChannelEnabled, channelActive },
    };
  }
  if (!channelActive) {
    return {
      should_respond: false,
      reason: "channel_not_active",
      initial_status_for_new_conversation: initialStatus,
      details: { aiGlobalEnabled, aiChannelEnabled, channelActive },
    };
  }

  // 4) Conversation-level checks (only when we already have a conversation)
  if (conversation) {
    if (conversation.assigned_to) {
      return {
        should_respond: false,
        reason: "human_assigned",
        initial_status_for_new_conversation: initialStatus,
        details: { assigned_to: conversation.assigned_to },
      };
    }

    // Estados em que humano está no controle ou conversa encerrada
    const humanOwnedStatuses = new Set([
      "open",
      "waiting_customer",
      "resolved",
      "spam",
    ]);
    if (
      conversation.status &&
      humanOwnedStatuses.has(conversation.status)
    ) {
      return {
        should_respond: false,
        reason: "conversation_in_human_state",
        initial_status_for_new_conversation: initialStatus,
        details: { status: conversation.status },
      };
    }
  }

  return {
    should_respond: true,
    reason: "ok",
    initial_status_for_new_conversation: "bot",
    details: { aiGlobalEnabled, aiChannelEnabled, channelActive },
  };
}

/**
 * Convenience helper: invoke the AI engine over HTTP using the service role
 * key. Always fire-and-forget aware: callers should `await` to capture the
 * result but errors must NEVER propagate to the inbound persistence path.
 */
export async function invokeAiSupportChat(
  supabaseUrl: string,
  serviceKey: string,
  body: { conversation_id: string; tenant_id: string },
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-support-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, bodyText: text.substring(0, 500) };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      bodyText: err instanceof Error ? err.message : String(err),
    };
  }
}
