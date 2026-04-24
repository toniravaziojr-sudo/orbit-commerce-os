/**
 * ai-snapshot-queue-worker
 *
 * Worker da fila ai_snapshot_regen_queue (Sub-fase 1.2).
 *
 * - Pega N itens prontos via lease (locked_at + lease_expires_at)
 * - Chama ai-business-snapshot-generator para cada um
 * - Marca como done / failed conforme resultado
 * - Respeita debounce e prioridade já aplicados pelo enqueuer
 *
 * Pode ser invocado manualmente, por outra função, ou agendado (cron de cada minuto).
 */

import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_BATCH_SIZE = 5;
const LEASE_MINUTES = 10;
const MAX_RETRIES = 3;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      batch_size?: number;
    };
    const batchSize = body.batch_size ?? DEFAULT_BATCH_SIZE;
    const workerId = `worker-${crypto.randomUUID()}`;
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + LEASE_MINUTES * 60 * 1000);

    console.log(`[queue-worker] iniciado worker=${workerId} batch_size=${batchSize}`);

    // 1. Pegar lote com lease atômico (claim)
    const { data: claimed, error: claimErr } = await supabase
      .from("ai_snapshot_regen_queue")
      .update({
        status: "processing",
        locked_at: now.toISOString(),
        locked_by: workerId,
        lease_expires_at: leaseUntil.toISOString(),
        attempts: 1, // primeira tentativa; updates posteriores incrementam
      })
      .in(
        "id",
        // Subquery via filtro: pegar pendentes, prontos para rodar, sem lease ativo
        (
          await supabase
            .from("ai_snapshot_regen_queue")
            .select("id")
            .eq("status", "pending")
            .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
            .or(`lease_expires_at.is.null,lease_expires_at.lt.${now.toISOString()}`)
            .order("priority", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(batchSize)
        ).data?.map((r) => r.id) ?? [],
      )
      .select("id, tenant_id, scope, product_id, reason, attempts");

    if (claimErr) throw claimErr;

    if (!claimed || claimed.length === 0) {
      return jsonResponse({ success: true, claimed: 0, message: "Fila vazia" });
    }

    console.log(`[queue-worker] reivindicou ${claimed.length} item(ns)`);

    // 2. Processar cada item
    const results: any[] = [];
    for (const item of claimed) {
      const startedAt = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke("ai-business-snapshot-generator", {
          body: {
            tenant_id: item.tenant_id,
            scope: item.scope,
            product_id: item.product_id,
            reason: item.reason,
          },
        });

        if (error) throw error;
        if (data?.success === false) {
          throw new Error(data?.error || "Falha sem mensagem");
        }

        await supabase
          .from("ai_snapshot_regen_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
            last_error: null,
            locked_at: null,
            locked_by: null,
            lease_expires_at: null,
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          tenant_id: item.tenant_id,
          status: "done",
          duration_ms: Date.now() - startedAt,
          mode: data?.mode,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const nextAttempts = (item.attempts ?? 1) + 1;
        const exhausted = nextAttempts > MAX_RETRIES;

        await supabase
          .from("ai_snapshot_regen_queue")
          .update({
            status: exhausted ? "failed" : "pending",
            attempts: nextAttempts,
            last_error: errMsg.slice(0, 1000),
            locked_at: null,
            locked_by: null,
            lease_expires_at: null,
            // backoff: próximo agendamento em 5min × tentativa
            scheduled_for: exhausted
              ? null
              : new Date(Date.now() + 5 * 60 * 1000 * nextAttempts).toISOString(),
          })
          .eq("id", item.id);

        console.error(`[queue-worker] item=${item.id} falhou (${nextAttempts}/${MAX_RETRIES}): ${errMsg}`);
        results.push({
          id: item.id,
          tenant_id: item.tenant_id,
          status: exhausted ? "failed" : "retry_scheduled",
          attempts: nextAttempts,
          error: errMsg.slice(0, 200),
        });
      }
    }

    return jsonResponse({
      success: true,
      claimed: claimed.length,
      results,
    });
  } catch (error) {
    console.error("[queue-worker] erro fatal:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      200,
    );
  }
});
