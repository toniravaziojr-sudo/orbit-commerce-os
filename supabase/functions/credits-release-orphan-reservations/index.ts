/**
 * Cron: libera reservas v2 órfãs.
 * Critérios:
 *  - transaction_type='reserve'
 *  - metadata.motor_version='v2'
 *  - reservation_expires_at < now() OU created_at < now()-30min
 *  - sem capture/release referenciando essa reserva
 *  - service_usage_events não está in_progress recente
 * NUNCA libera reservas v1.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders } from "../_shared/cors.ts";
import { releaseReservation, buildIdempotencyKey } from "../_shared/credits/charge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: orphans, error } = await supabase
    .from("credit_ledger")
    .select("id, tenant_id, created_at, reservation_expires_at, metadata")
    .eq("transaction_type", "reserve")
    .filter("metadata->>motor_version", "eq", "v2")
    .or(`reservation_expires_at.lt.${new Date().toISOString()},and(reservation_expires_at.is.null,created_at.lt.${cutoff})`)
    .limit(200);

  if (error) {
    console.error("[orphan-release] query error", error);
    return new Response(JSON.stringify({ success: false, error_message: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let released = 0, skipped = 0, failed = 0;

  for (const r of orphans ?? []) {
    // Verifica se já houve capture/release
    const { data: finalized } = await supabase
      .from("credit_ledger")
      .select("id")
      .eq("reference_ledger_id", r.id)
      .in("transaction_type", ["capture", "release"])
      .limit(1);
    if (finalized && finalized.length > 0) { skipped++; continue; }

    // Verifica service_usage_events ativo
    const { data: events } = await supabase
      .from("service_usage_events")
      .select("status, updated_at")
      .eq("reservation_ledger_id", r.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (events && events[0] && events[0].status === "in_progress") {
      const ageMin = (Date.now() - new Date(events[0].updated_at).getTime()) / 60000;
      if (ageMin < 30) { skipped++; continue; }
    }

    const res = await releaseReservation({
      tenantId: r.tenant_id,
      reservationId: r.id,
      reason: "orphan_auto_release",
      idempotencyKey: buildIdempotencyKey(["orphan_release", r.id]),
      metadata: { released_by: "credits-release-orphan-reservations", expired_at: r.reservation_expires_at, created_at: r.created_at },
    });
    if (res.success) released++; else failed++;
  }

  if (released > 10) {
    console.warn(`[orphan-release] ALERT: ${released} reservas órfãs liberadas em uma execução`);
  }

  console.log(`[orphan-release] released=${released} skipped=${skipped} failed=${failed} total=${orphans?.length ?? 0}`);
  return new Response(JSON.stringify({ success: true, released, skipped, failed, total: orphans?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
