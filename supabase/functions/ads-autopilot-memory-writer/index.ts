// =====================================================================
// Tenant Memory Writer — Edge Function (Etapa 7.mem — Subfase C)
//
// Lê feedbacks humanos do Ads Autopilot ainda não processados para o
// padrão derivado, registra-os como evidência (ledger idempotente) e
// recalcula a memória correspondente do tenant.
//
// Restrições obrigatórias:
//   - Sem cron novo; execução é manual (admin/service_role).
//   - Sem chamada à Meta. Sem ciclo de IA. Sem alteração do feedback.
//   - Não influencia veredito/sugestão/Policy Engine/Action Derivation.
//   - Idempotente: reexecutar não duplica evidence_count.
//   - Isolamento por tenant.
//
// Auth: requer service_role (chamada server-to-server / admin), pois
// recalcula memória de um tenant inteiro de forma agregada.
// =====================================================================

// @ts-nocheck — runtime Deno (Edge Function).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  deriveEvidencesFromFeedback,
  recomputeMemoryFromEvidences,
  type FeedbackRow,
  type DerivedEvidence,
  type MemoryStatus,
} from "../../../src/lib/adsAutopilot/memoryWriter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RequestBody {
  tenant_id?: string;
  /** Janela opcional: só considera feedbacks decided_at >= since_iso. */
  since_iso?: string | null;
  /** Modo dry-run: calcula tudo mas não persiste. */
  dry_run?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ success: false, error: "method_not_allowed" }, 200);
  }

  // --- Auth: somente service_role pode invocar -----------------------
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const presentedToken = authHeader.replace(/^Bearer\s+/i, "");
  if (!SERVICE_ROLE || presentedToken !== SERVICE_ROLE) {
    return json({ success: false, error: "forbidden" }, 200);
  }

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ success: false, error: "invalid_json" }, 200);
  }

  const tenantId = String(body.tenant_id ?? "");
  if (!UUID_RE.test(tenantId)) {
    return json({ success: false, error: "tenant_id_required" }, 200);
  }

  const dryRun = body.dry_run === true;
  const sinceIso = body.since_iso ?? null;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // --- 1) Lê feedbacks do tenant ------------------------------------
  let q = supabase
    .from("ads_autopilot_feedback")
    .select(
      "id,tenant_id,sales_platform,ads_platform,action_type,objective,decision,reason_codes,should_become_preference,decided_at",
    )
    .eq("tenant_id", tenantId)
    .order("decided_at", { ascending: true });
  if (sinceIso) q = q.gte("decided_at", sinceIso);

  const { data: feedbacks, error: fbErr } = await q;
  if (fbErr) {
    return json({ success: false, error: "feedback_query_failed", details: fbErr.message }, 200);
  }

  // --- 2) Lê ledger já existente para idempotência -------------------
  const { data: existing, error: ledgerErr } = await supabase
    .from("ads_autopilot_memory_evidence")
    .select("feedback_id,sales_platform,ads_platform,memory_type,scope,key")
    .eq("tenant_id", tenantId);
  if (ledgerErr) {
    return json({ success: false, error: "ledger_query_failed", details: ledgerErr.message }, 200);
  }

  const seen = new Set<string>();
  for (const e of existing ?? []) {
    seen.add(
      `${e.feedback_id}|${e.sales_platform}|${e.ads_platform}|${e.memory_type}|${e.scope}|${e.key}`,
    );
  }

  // --- 3) Deriva evidências novas ------------------------------------
  const toInsert: Array<DerivedEvidence & { feedback_id: string; tenant_id: string }> = [];
  const affectedPatterns = new Map<string, DerivedEvidence>();

  for (const f of (feedbacks ?? []) as FeedbackRow[]) {
    const derived = deriveEvidencesFromFeedback(f);
    for (const d of derived) {
      const ledgerKey = `${f.id}|${d.sales_platform}|${d.ads_platform}|${d.memory_type}|${d.scope}|${d.key}`;
      const patternKey = `${d.sales_platform}|${d.ads_platform}|${d.memory_type}|${d.scope}|${d.key}`;
      affectedPatterns.set(patternKey, d);
      if (seen.has(ledgerKey)) continue; // idempotência
      toInsert.push({ ...d, feedback_id: f.id, tenant_id: tenantId });
    }
  }

  // --- 4) Persiste novas evidências (se não for dry-run) -------------
  let insertedCount = 0;
  if (!dryRun && toInsert.length > 0) {
    const { error: insErr, count } = await supabase
      .from("ads_autopilot_memory_evidence")
      .insert(toInsert, { count: "exact" });
    if (insErr) {
      return json({ success: false, error: "ledger_insert_failed", details: insErr.message }, 200);
    }
    insertedCount = count ?? toInsert.length;
  }

  // --- 5) Para cada padrão afetado, recalcula memória ----------------
  const upsertedMemories: Array<{ pattern: string; status: MemoryStatus; confidence: number; evidence_count: number }> = [];

  for (const [patternKey, sample] of affectedPatterns.entries()) {
    // Re-le todas as evidências aplicáveis ao padrão (após insert).
    let evidenceRows: any[] = [];
    if (!dryRun) {
      const { data, error } = await supabase
        .from("ads_autopilot_memory_evidence")
        .select(
          "is_supporting,weight,processed_at,feedback_id",
        )
        .eq("tenant_id", tenantId)
        .eq("sales_platform", sample.sales_platform)
        .eq("ads_platform", sample.ads_platform)
        .eq("memory_type", sample.memory_type)
        .eq("scope", sample.scope)
        .eq("key", sample.key);
      if (error) {
        return json({ success: false, error: "ledger_reread_failed", details: error.message }, 200);
      }
      evidenceRows = data ?? [];
    }

    // Enriquecer com should_become_preference do feedback original.
    const fbIds = evidenceRows.map((r: any) => r.feedback_id);
    let sppMap = new Map<string, boolean | null>();
    if (fbIds.length > 0) {
      const { data: fbs } = await supabase
        .from("ads_autopilot_feedback")
        .select("id,should_become_preference")
        .in("id", fbIds);
      for (const fb of fbs ?? []) sppMap.set(fb.id, fb.should_become_preference);
    }

    const enriched = evidenceRows.map((r: any) => ({
      is_supporting: r.is_supporting,
      weight: Number(r.weight),
      processed_at: r.processed_at,
      should_become_preference: sppMap.get(r.feedback_id) ?? null,
    }));

    // Lê memória anterior (para preservar status archived e detectar rebaixamento)
    const { data: prevMem } = await supabase
      .from("ads_autopilot_tenant_memory")
      .select("memory_id,status")
      .eq("tenant_id", tenantId)
      .eq("sales_platform", sample.sales_platform)
      .eq("ads_platform", sample.ads_platform)
      .eq("memory_type", sample.memory_type)
      .eq("scope", sample.scope)
      .eq("key", sample.key)
      .maybeSingle();

    const previousStatus: MemoryStatus = (prevMem?.status as MemoryStatus) ?? "provisional";
    const result = recomputeMemoryFromEvidences(enriched, new Date(), previousStatus);

    if (!dryRun) {
      const { data: upserted, error: upErr } = await supabase
        .from("ads_autopilot_tenant_memory")
        .upsert(
          {
            tenant_id: tenantId,
            sales_platform: sample.sales_platform,
            ads_platform: sample.ads_platform,
            memory_type: sample.memory_type,
            scope: sample.scope,
            key: sample.key,
            value: { derived: true },
            confidence: result.confidence,
            evidence_count: result.evidence_count,
            status: previousStatus === "archived" ? "archived" : result.status,
            source: "writer:feedback",
            last_confirmed_at: result.last_confirmed_at,
            last_contradicted_at: result.last_contradicted_at,
          },
          {
            onConflict:
              "tenant_id,sales_platform,ads_platform,memory_type,scope,key",
          },
        )
        .select("memory_id")
        .maybeSingle();

      if (upErr) {
        return json({ success: false, error: "memory_upsert_failed", details: upErr.message }, 200);
      }

      // Vincula memory_id retroativamente no ledger (não obrigatório, mas útil)
      if (upserted?.memory_id) {
        await supabase
          .from("ads_autopilot_memory_evidence")
          .update({ memory_id: upserted.memory_id })
          .eq("tenant_id", tenantId)
          .eq("sales_platform", sample.sales_platform)
          .eq("ads_platform", sample.ads_platform)
          .eq("memory_type", sample.memory_type)
          .eq("scope", sample.scope)
          .eq("key", sample.key)
          .is("memory_id", null);
      }
    }

    upsertedMemories.push({
      pattern: patternKey,
      status: result.status,
      confidence: result.confidence,
      evidence_count: result.evidence_count,
    });
  }

  return json({
    success: true,
    tenant_id: tenantId,
    dry_run: dryRun,
    feedbacks_considered: feedbacks?.length ?? 0,
    evidences_inserted: insertedCount,
    memories_recalculated: upsertedMemories.length,
    memories: upsertedMemories,
    note:
      "Subfase C: memória ainda NÃO é usada pela IA. Sem ciclo de IA, sem chamada Meta, sem autoexecução.",
  });
});
