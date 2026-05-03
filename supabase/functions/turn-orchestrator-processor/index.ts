// ============================================================
// Fase C — turn-orchestrator-processor (Reg #2.13)
// Processador único do Turn Orchestrator.
// Acionado por:
//  1) meta-whatsapp-webhook via EdgeRuntime.waitUntil (caminho principal)
//  2) cron watchdog (rede de segurança a cada 1min)
//  3) freshness failure dentro do ai-support-chat (reabriu o turno)
//
// Responsabilidades:
//  - waitQuietWindow (debounce dinâmico do buffer)
//  - claimTurn atômico (somente 1 worker vence)
//  - invocar ai-support-chat com logical_turn_id + claim_token
//  - traduzir resposta em complete/fail (idempotente)
//  - timeout/retry/backoff
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  claimTurn,
  waitQuietWindow,
} from "../_shared/sales-pipeline/turn-orchestrator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOG = "[turn-orchestrator-processor]";

// Limites técnicos do processador
const MAX_QUIET_WINDOW_MS = 7000;          // cap absoluto do debounce
const AI_INVOCATION_TIMEOUT_MS = 55_000;   // ai-support-chat (GPT-5)
const PROCESSOR_HARD_TIMEOUT_MS = 65_000;  // cap geral; sob isso o watchdog retoma

interface ProcessRequest {
  tenant_id: string;
  conversation_id: string;
  logical_turn_id: string;
  // origem do disparo (apenas log)
  source?: "webhook" | "watchdog" | "freshness_reopen";
  // se true, pular waitQuietWindow (watchdog já espera)
  skip_quiet_window?: boolean;
}

interface BatchRequest {
  // chamado pelo watchdog passando lote de buffers
  batch: Array<Pick<ProcessRequest, "tenant_id" | "conversation_id" | "logical_turn_id">>;
  source: "watchdog";
}

async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`timeout:${label}:${ms}ms`)), ms),
    ),
  ]);
}

async function processOne(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  req: ProcessRequest,
): Promise<{ ok: boolean; status: string; reason?: string; ms: number }> {
  const t0 = Date.now();
  const tag = `${LOG}[${req.source ?? "unknown"}][${req.logical_turn_id.slice(0, 8)}]`;

  try {
    // 1) Localiza o buffer atual (precisa existir e ter status processável)
    const { data: buf, error: bufErr } = await supabase
      .from("ai_turn_buffers")
      .select("id, status, process_after, attempts, claim_token")
      .eq("conversation_id", req.conversation_id)
      .eq("logical_turn_id", req.logical_turn_id)
      .maybeSingle();

    if (bufErr) {
      console.error(`${tag} buffer lookup error:`, bufErr.message);
      return { ok: false, status: "buffer_lookup_failed", ms: Date.now() - t0 };
    }
    if (!buf) {
      console.log(`${tag} buffer not found (already processed/aborted)`);
      return { ok: true, status: "buffer_missing", ms: Date.now() - t0 };
    }
    if (buf.status === "processed") {
      console.log(`${tag} already processed, skipping`);
      return { ok: true, status: "already_processed", ms: Date.now() - t0 };
    }
    if (buf.status === "dead") {
      console.log(`${tag} dead buffer, skipping`);
      return { ok: true, status: "dead", ms: Date.now() - t0 };
    }

    // 2) Quiet window — espera process_after expirar (cap MAX_QUIET_WINDOW_MS)
    if (!req.skip_quiet_window && buf.status === "open") {
      const wait = await waitQuietWindow(supabase, {
        conversationId: req.conversation_id,
        logicalTurnId: req.logical_turn_id,
        initialProcessAfter: buf.process_after as string,
        maxWaitMs: MAX_QUIET_WINDOW_MS,
      });
      console.log(`${tag} quiet_window result:`, JSON.stringify(wait));
      if (!wait.ready) {
        return { ok: true, status: `quiet_window_${wait.reason}`, ms: Date.now() - t0 };
      }
    }

    // 3) Claim atômico
    const claim = await claimTurn(supabase, {
      tenantId: req.tenant_id,
      conversationId: req.conversation_id,
      logicalTurnId: req.logical_turn_id,
    });
    if (claim.error) {
      console.error(`${tag} claim error:`, claim.error);
      return { ok: false, status: "claim_error", reason: claim.error, ms: Date.now() - t0 };
    }
    if (claim.already_processed) {
      return { ok: true, status: "already_processed", ms: Date.now() - t0 };
    }
    if (claim.already_claimed) {
      console.log(`${tag} already claimed by another worker`);
      return { ok: true, status: "already_claimed", ms: Date.now() - t0 };
    }
    if (claim.wait_ms) {
      console.log(`${tag} claim wait_ms=${claim.wait_ms}, requeue via watchdog`);
      return { ok: true, status: "claim_not_ready", ms: Date.now() - t0 };
    }
    if (!claim.claim_token) {
      return { ok: false, status: "claim_no_token", ms: Date.now() - t0 };
    }

    console.log(
      `${tag} claimed token=${claim.claim_token.slice(0, 8)} attempts=${claim.attempts} completeness=${claim.completeness}`,
    );

    // 4) Invocar ai-support-chat com logical_turn_id + claim_token
    let aiOk = false;
    let aiStatus = 0;
    let aiBody = "";
    try {
      const aiRes = await withTimeout(
        fetch(`${supabaseUrl}/functions/v1/ai-support-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            conversation_id: req.conversation_id,
            tenant_id: req.tenant_id,
            logical_turn_id: req.logical_turn_id,
            claim_token: claim.claim_token,
          }),
        }),
        AI_INVOCATION_TIMEOUT_MS,
        "ai-support-chat",
      );
      aiStatus = aiRes.status;
      aiBody = (await aiRes.text()).slice(0, 500);
      aiOk = aiRes.ok;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${tag} ai invocation failed:`, msg);
      // marca fail_turn com claim_token original
      await supabase.rpc("fail_turn", {
        p_conversation_id: req.conversation_id,
        p_logical_turn_id: req.logical_turn_id,
        p_claim_token: claim.claim_token,
        p_bot_message_id: null,
        p_error: `processor_invoke_failed:${msg}`,
      });
      return { ok: false, status: "ai_invoke_failed", reason: msg, ms: Date.now() - t0 };
    }

    console.log(`${tag} ai-support-chat status=${aiStatus} ok=${aiOk} body=${aiBody}`);

    // ai-support-chat é responsável por chamar complete_turn / fail_turn / reopen.
    // Não tomamos ação adicional aqui.
    return {
      ok: aiOk,
      status: aiOk ? "ai_done" : "ai_failed",
      ms: Date.now() - t0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} unhandled exception:`, msg);
    return { ok: false, status: "exception", reason: msg, ms: Date.now() - t0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validação dura: precisa do service_role no Authorization
  const auth = req.headers.get("authorization") || "";
  if (!auth.includes(serviceKey)) {
    return new Response(
      JSON.stringify({ success: false, error: "unauthorized" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let payload: ProcessRequest | BatchRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "invalid_json" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // BATCH (watchdog)
  if ("batch" in payload && Array.isArray(payload.batch)) {
    const results: any[] = [];
    for (const item of payload.batch) {
      const r = await withTimeout(
        processOne(supabase, supabaseUrl, serviceKey, {
          ...item,
          source: "watchdog",
          skip_quiet_window: true,
        }),
        PROCESSOR_HARD_TIMEOUT_MS,
        "processOne",
      ).catch((err) => ({
        ok: false,
        status: "hard_timeout",
        reason: err.message,
        ms: PROCESSOR_HARD_TIMEOUT_MS,
      }));
      results.push({ logical_turn_id: item.logical_turn_id, ...r });
    }
    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // SINGLE
  const single = payload as ProcessRequest;
  if (!single.tenant_id || !single.conversation_id || !single.logical_turn_id) {
    return new Response(
      JSON.stringify({ success: false, error: "missing_fields" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const result = await withTimeout(
    processOne(supabase, supabaseUrl, serviceKey, single),
    PROCESSOR_HARD_TIMEOUT_MS,
    "processOne",
  ).catch((err) => ({ ok: false, status: "hard_timeout", reason: err.message, ms: PROCESSOR_HARD_TIMEOUT_MS }));

  return new Response(JSON.stringify({ success: true, ...result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
