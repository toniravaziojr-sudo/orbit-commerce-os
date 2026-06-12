// =============================================================================
// ads-ai-learnings-write — Onda F
// Cria/reforça um Aprendizado da IA do Gestor de Tráfego em status `suggested`
// a partir de feedback do usuário. Service role. Dedup por
// (tenant_id, category, normalized_title) — aproveita índice único parcial.
// NÃO ativa o aprendizado sozinho. NÃO chama IA.
// =============================================================================
// @ts-nocheck — Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_CATEGORIES = new Set([
  "produto","publico","orcamento","funil","criativo","copy","oferta","performance","restricao","tracking","outro",
]);

const ALLOWED_SOURCES = new Set(["approval","rejection","adjustment","manual","system"]);

function normTitle(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" });

  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, error: "invalid_json" }); }

  const tenantId = body?.tenant_id;
  const titleRaw = (body?.title || "").toString().trim();
  const description = (body?.description || "").toString().trim() || null;
  const category = ALLOWED_CATEGORIES.has(body?.category) ? body.category : "outro";
  const source_type = ALLOWED_SOURCES.has(body?.source_type) ? body.source_type : "system";
  const source_action_id = body?.source_action_id || null;
  const source_plan_id = body?.source_plan_id || null;
  const source_analysis_run_id = body?.source_analysis_run_id || null;
  const source_feedback_id = body?.source_feedback_id || null;
  const metadata = body?.metadata || {};

  if (!tenantId) return json({ success: false, error: "tenant_id_required" });
  if (!titleRaw || titleRaw.length < 6) return json({ success: false, error: "empty_or_too_short_title" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Dedup manual (a normalização do índice é equivalente).
  const norm = normTitle(titleRaw);
  const { data: existing } = await supabase
    .from("ads_ai_learnings")
    .select("id, evidence_count, confidence, status")
    .eq("tenant_id", tenantId)
    .eq("category", category)
    .neq("status", "archived")
    .limit(50);

  const dup = (existing || []).find((r: any) => normTitle(r.id ? "" : "") === "" /* placeholder */) ;
  // Como não temos a coluna normalizada via select, fazemos novo fetch comparando títulos.
  const { data: same } = await supabase
    .from("ads_ai_learnings")
    .select("id, title, evidence_count, confidence, status")
    .eq("tenant_id", tenantId)
    .eq("category", category)
    .neq("status", "archived");

  const hit = (same || []).find((r: any) => normTitle(r.title) === norm);
  if (hit) {
    const newEvidence = Math.min(999, (hit.evidence_count || 0) + 1);
    const newConfidence = Math.min(1, Number(hit.confidence || 0.5) + 0.05);
    await supabase
      .from("ads_ai_learnings")
      .update({
        evidence_count: newEvidence,
        confidence: newConfidence,
        // não reativa aprendizado pausado/arquivado automaticamente
      })
      .eq("id", hit.id);
    return json({ success: true, action: "reinforced", learning_id: hit.id, evidence_count: newEvidence });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("ads_ai_learnings")
    .insert({
      tenant_id: tenantId,
      title: titleRaw.slice(0, 200),
      description,
      category,
      status: source_type === "manual" ? "active" : "suggested",
      source_type,
      source_action_id,
      source_plan_id,
      source_analysis_run_id,
      source_feedback_id,
      metadata,
    })
    .select("id, status")
    .single();

  if (insErr) {
    // Unique violation → reforça
    if (String(insErr.code) === "23505") {
      return json({ success: true, action: "dedup_existing" });
    }
    return json({ success: false, error: "insert_failed", details: insErr.message });
  }

  return json({ success: true, action: "created", learning_id: inserted.id, status: inserted.status });
});
