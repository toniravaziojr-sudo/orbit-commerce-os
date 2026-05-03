// ============================================================
// Fase C — turn-orchestrator-watchdog (Reg #2.13)
// Cron a cada 1min. Resgata buffers travados/expirados/em retry
// e despacha para turn-orchestrator-processor em batch.
// Também marca buffers exauridos como 'dead'.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const t0 = Date.now();

  // 1) Marca exauridos como dead
  const { data: deadCount } = await supabase.rpc("mark_dead_turn_buffers", { p_max_attempts: MAX_ATTEMPTS });
  if (deadCount && deadCount > 0) {
    console.log(`[turn-orchestrator-watchdog] marked ${deadCount} buffers as dead`);
  }

  // 2) Lista buffers travados
  const { data: stuck, error } = await supabase.rpc("get_stuck_turn_buffers", {
    p_now: new Date().toISOString(),
    p_claim_stale_seconds: 90,
    p_max_attempts: MAX_ATTEMPTS,
    p_limit: BATCH_SIZE,
  });

  if (error) {
    console.error("[turn-orchestrator-watchdog] list error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = (stuck as any[]) ?? [];
  console.log(`[turn-orchestrator-watchdog] found ${items.length} stuck buffers`);

  if (items.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0, dead: deadCount ?? 0, ms: Date.now() - t0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3) Despacha em batch para o processor
  const batchPayload = {
    batch: items.map((i) => ({
      tenant_id: i.tenant_id,
      conversation_id: i.conversation_id,
      logical_turn_id: i.logical_turn_id,
    })),
    source: "watchdog",
  };

  let processorStatus = 0;
  let processorBody = "";
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/turn-orchestrator-processor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(batchPayload),
    });
    processorStatus = r.status;
    processorBody = (await r.text()).slice(0, 500);
  } catch (err) {
    console.error("[turn-orchestrator-watchdog] processor dispatch failed:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      stuck: items.length,
      dead: deadCount ?? 0,
      processor_status: processorStatus,
      processor_body: processorBody,
      ms: Date.now() - t0,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
