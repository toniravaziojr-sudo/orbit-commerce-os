// ============================================================
// Fase C — Turn Orchestrator client (Reg #2.13)
// Wrappers tipados para as RPCs SECURITY DEFINER do buffer.
// Usado tanto pelo meta-whatsapp-webhook quanto pelo ai-support-chat.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { TurnCompleteness } from "./turn-completeness.ts";

const LOG = "[Reg #2.13][turn-orchestrator]";

export interface EnqueueResult {
  logical_turn_id: string;
  process_after: string;
  completeness: TurnCompleteness;
  debounce_ms: number;
  buffer_size: number;
  created: boolean;
  was_claimed?: boolean;
}

export async function enqueueTurnMessage(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    conversationId: string;
    messageId: string;
    completeness: TurnCompleteness;
    debounceMs: number;
  },
): Promise<EnqueueResult | null> {
  const { data, error } = await supabase.rpc("enqueue_turn_message", {
    p_tenant_id: args.tenantId,
    p_conversation_id: args.conversationId,
    p_message_id: args.messageId,
    p_completeness: args.completeness,
    p_debounce_ms: args.debounceMs,
  });
  if (error) {
    console.error(`${LOG} enqueue failed:`, error.message);
    return null;
  }
  console.log(`${LOG} enqueue:`, JSON.stringify(data));
  return data as EnqueueResult;
}

export interface ClaimResult {
  claim_token?: string;
  snapshot_message_ids?: string[];
  completeness?: TurnCompleteness;
  attempts?: number;
  wait_ms?: number;
  process_after?: string;
  already_claimed?: boolean;
  already_processed?: boolean;
  error?: string;
}

export async function claimTurn(
  supabase: SupabaseClient,
  args: { tenantId: string; conversationId: string; logicalTurnId: string },
): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_turn", {
    p_tenant_id: args.tenantId,
    p_conversation_id: args.conversationId,
    p_logical_turn_id: args.logicalTurnId,
  });
  if (error) {
    console.error(`${LOG} claim failed:`, error.message);
    return { error: error.message };
  }
  return (data as ClaimResult) ?? {};
}

export interface FreshnessResult {
  fresh: boolean;
  reason?: string;
  new_message_ids?: string[];
}

export async function checkTurnFreshness(
  supabase: SupabaseClient,
  args: { conversationId: string; logicalTurnId: string; claimToken: string },
): Promise<FreshnessResult> {
  const { data, error } = await supabase.rpc("check_turn_freshness", {
    p_conversation_id: args.conversationId,
    p_logical_turn_id: args.logicalTurnId,
    p_claim_token: args.claimToken,
  });
  if (error) {
    console.error(`${LOG} freshness failed:`, error.message);
    return { fresh: false, reason: "rpc_error" };
  }
  return (data as FreshnessResult) ?? { fresh: false, reason: "no_data" };
}

export async function reopenTurn(
  supabase: SupabaseClient,
  args: { conversationId: string; logicalTurnId: string; claimToken: string; extendMs?: number },
): Promise<boolean> {
  const { data, error } = await supabase.rpc("reopen_turn", {
    p_conversation_id: args.conversationId,
    p_logical_turn_id: args.logicalTurnId,
    p_claim_token: args.claimToken,
    p_extend_ms: args.extendMs ?? 1500,
  });
  if (error) {
    console.error(`${LOG} reopen failed:`, error.message);
    return false;
  }
  return (data as { reopened?: boolean })?.reopened === true;
}

export async function completeTurn(
  supabase: SupabaseClient,
  args: { conversationId: string; logicalTurnId: string; claimToken: string; botMessageId: string },
): Promise<boolean> {
  const { data, error } = await supabase.rpc("complete_turn", {
    p_conversation_id: args.conversationId,
    p_logical_turn_id: args.logicalTurnId,
    p_claim_token: args.claimToken,
    p_bot_message_id: args.botMessageId,
  });
  if (error) {
    console.error(`${LOG} complete failed:`, error.message);
    return false;
  }
  return (data as { completed?: boolean })?.completed === true;
}

export async function failTurn(
  supabase: SupabaseClient,
  args: {
    conversationId: string;
    logicalTurnId: string;
    claimToken: string;
    botMessageId: string | null;
    error: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc("fail_turn", {
    p_conversation_id: args.conversationId,
    p_logical_turn_id: args.logicalTurnId,
    p_claim_token: args.claimToken,
    p_bot_message_id: args.botMessageId,
    p_error: args.error,
  });
  if (error) console.error(`${LOG} fail_turn rpc error:`, error.message);
}

/**
 * Quiet Window — espera process_after expirar SEM novas mensagens.
 * Re-lê o buffer a cada `pollMs` para detectar extensão (nova msg estendeu).
 * Cap absoluto de `maxWaitMs` para evitar travar o webhook.
 */
export async function waitQuietWindow(
  supabase: SupabaseClient,
  args: {
    conversationId: string;
    logicalTurnId: string;
    initialProcessAfter: string;
    maxWaitMs?: number;
    pollMs?: number;
  },
): Promise<{ ready: boolean; reason: string; finalProcessAfter: string }> {
  const startedAt = Date.now();
  const maxWait = args.maxWaitMs ?? 6000;
  const pollMs = args.pollMs ?? 400;
  let processAfter = new Date(args.initialProcessAfter).getTime();

  while (true) {
    const now = Date.now();
    const elapsed = now - startedAt;
    if (elapsed > maxWait) {
      return { ready: true, reason: "max_wait_reached", finalProcessAfter: new Date(processAfter).toISOString() };
    }

    const remaining = processAfter - now;
    if (remaining <= 0) {
      return { ready: true, reason: "quiet_window_elapsed", finalProcessAfter: new Date(processAfter).toISOString() };
    }

    await new Promise((r) => setTimeout(r, Math.min(pollMs, remaining + 50)));

    // Re-lê para detectar extensão (nova msg pode ter estendido process_after)
    const { data, error } = await supabase
      .from("ai_turn_buffers")
      .select("process_after, status, logical_turn_id")
      .eq("conversation_id", args.conversationId)
      .eq("logical_turn_id", args.logicalTurnId)
      .maybeSingle();

    if (error || !data) {
      return { ready: false, reason: "buffer_lost", finalProcessAfter: new Date(processAfter).toISOString() };
    }
    if (data.status === "claimed" || data.status === "processed") {
      return { ready: false, reason: `already_${data.status}`, finalProcessAfter: new Date(processAfter).toISOString() };
    }
    processAfter = new Date(data.process_after as string).getTime();
  }
}
