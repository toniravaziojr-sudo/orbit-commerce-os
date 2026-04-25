// Edge Function: ai-signal-capture-batch
// Varre conversas elegíveis para captura de sinais regenerativos e dispara
// `ai-signal-capture` para cada uma. Roda via cron diário (4h BRT).
//
// Critério de elegibilidade (uma conversa é processada UMA vez):
//   - canal whatsapp
//   - status = 'resolved' OU sem nova mensagem nas últimas 24h (encerrada por silêncio)
//   - message_count >= 4 (conversa real, não saudação solta)
//   - última mensagem entre 24h e 7 dias atrás
//   - id NÃO presente em ai_signal_capture_queue (controle de idempotência)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_CONVERSATIONS_PER_RUN = 200;
const PER_TENANT_CAP = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = Date.now();

  try {
    // 1) Buscar conversas elegíveis (resolved ou silêncio > 24h, < 7d)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: candidateConvs, error: convErr } = await supabase
      .from("conversations")
      .select("id, tenant_id, customer_id, customer_phone, channel_type, status, last_message_at, message_count")
      .eq("channel_type", "whatsapp")
      .gte("message_count", 4)
      .lt("last_message_at", oneDayAgo)
      .gte("last_message_at", sevenDaysAgo)
      .order("last_message_at", { ascending: false })
      .limit(MAX_CONVERSATIONS_PER_RUN);

    if (convErr) throw new Error(`conversations query: ${convErr.message}`);
    if (!candidateConvs || candidateConvs.length === 0) {
      return json({ ok: true, processed: 0, skipped: 0, reason: "nenhuma_conversa_elegivel", duration_ms: Date.now() - startedAt });
    }

    // 2) Filtrar as que já foram processadas (idempotência via capture_queue)
    const ids = candidateConvs.map((c) => c.id);
    const { data: alreadyQueued } = await supabase
      .from("ai_signal_capture_queue")
      .select("conversation_id")
      .in("conversation_id", ids);

    const queuedSet = new Set((alreadyQueued || []).map((q: any) => q.conversation_id));
    const toProcess = candidateConvs.filter((c) => !queuedSet.has(c.id));

    // 3) Enforce per-tenant cap (evita um tenant grande monopolizar a rodada)
    const perTenantCount: Record<string, number> = {};
    const finalList: typeof toProcess = [];
    for (const c of toProcess) {
      const n = perTenantCount[c.tenant_id] || 0;
      if (n >= PER_TENANT_CAP) continue;
      perTenantCount[c.tenant_id] = n + 1;
      finalList.push(c);
    }

    // 4) Para cada conversa, buscar mensagens e disparar captura
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conv of finalList) {
      try {
        const { data: msgs, error: msgErr } = await supabase
          .from("messages")
          .select("direction, sender_type, content, created_at")
          .eq("conversation_id", conv.id)
          .eq("is_internal", false)
          .eq("is_note", false)
          .not("content", "is", null)
          .order("created_at", { ascending: true })
          .limit(200);

        if (msgErr) throw new Error(msgErr.message);
        if (!msgs || msgs.length < 4) continue;

        const formattedMessages = msgs
          .map((m: any) => {
            const role = m.direction === "inbound" ? "customer" : "agent";
            return { role, content: String(m.content || "").trim(), created_at: m.created_at };
          })
          .filter((m) => m.content.length > 0);

        if (formattedMessages.length < 4) continue;

        // Marca como enfileirado ANTES de chamar captura (idempotência forte)
        const { error: queueErr } = await supabase.from("ai_signal_capture_queue").insert({
          tenant_id: conv.tenant_id,
          conversation_id: conv.id,
          status: "processing",
          attempts: 1,
        });
        // Se a constraint unique disparar (race condition entre 2 rodadas), pula
        if (queueErr && (queueErr as any).code === "23505") continue;
        if (queueErr) throw new Error(`queue insert: ${queueErr.message}`);

        const captureResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-signal-capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            tenant_id: conv.tenant_id,
            conversation_id: conv.id,
            customer_id: conv.customer_id,
            customer_phone: conv.customer_phone,
            channel: "whatsapp",
            messages: formattedMessages,
          }),
        });

        if (!captureResp.ok) {
          const text = await captureResp.text();
          await supabase
            .from("ai_signal_capture_queue")
            .update({
              status: "failed",
              error_message: `HTTP ${captureResp.status}: ${text.slice(0, 300)}`,
              processed_at: new Date().toISOString(),
            })
            .eq("conversation_id", conv.id);
          failed++;
          continue;
        }

        await supabase
          .from("ai_signal_capture_queue")
          .update({ status: "done", processed_at: new Date().toISOString() })
          .eq("conversation_id", conv.id);

        processed++;
      } catch (e) {
        failed++;
        errors.push(`${conv.id}: ${(e as Error).message}`);
        console.error(`[ai-signal-capture-batch] conv ${conv.id} failed:`, e);
      }
    }

    return json({
      ok: true,
      candidates_found: candidateConvs.length,
      already_queued_skipped: candidateConvs.length - toProcess.length,
      tenant_cap_skipped: toProcess.length - finalList.length,
      attempted: finalList.length,
      processed,
      failed,
      errors: errors.slice(0, 10),
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("[ai-signal-capture-batch] fatal:", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
