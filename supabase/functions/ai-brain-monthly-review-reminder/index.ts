// Edge Function: ai-brain-monthly-review-reminder
// Cria mensalmente um insight do tipo "lembrete de revisão" para cada tenant
// que possui insights aprovados ativos no cérebro da IA.
// Lembra o usuário de reavaliar regras que podem ter perdido validade.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Tenants com pelo menos 1 insight aprovado e ativo
    const { data: rows, error } = await supabase
      .from("ai_brain_insights")
      .select("tenant_id")
      .eq("status", "aprovado")
      .is("revoked_at", null);

    if (error) throw error;

    const tenantCounts = new Map<string, number>();
    for (const r of rows || []) {
      tenantCounts.set(r.tenant_id, (tenantCounts.get(r.tenant_id) || 0) + 1);
    }

    let created = 0;
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const periodEnd = now.toISOString().slice(0, 10);

    for (const [tenantId, activeCount] of tenantCounts.entries()) {
      // Não duplicar: se já existe lembrete pendente este mês, pular
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: existing } = await supabase
        .from("ai_brain_insights")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("insight_type", "lembrete_revisao")
        .gte("created_at", startOfMonth)
        .maybeSingle();

      if (existing) continue;

      const { error: insErr } = await supabase.from("ai_brain_insights").insert({
        tenant_id: tenantId,
        insight_type: "lembrete_revisao",
        title: `Hora de revisar seus ${activeCount} insight${activeCount > 1 ? "s" : ""} ativos`,
        summary: `Você possui ${activeCount} insight${activeCount > 1 ? "s aprovados" : " aprovado"} no cérebro da IA. Insights podem perder validade ao longo do tempo (sazonalidade, mudanças no público, novos produtos). Revise se ainda fazem sentido para evitar que regras antigas distorçam o comportamento dos seus agentes.`,
        recommendation: "Acesse a aba Insights Ativos e revise cada regra. Desative ou revogue as que não fazem mais sentido.",
        is_urgent: false,
        evidence_count: activeCount,
        unique_customer_count: 0,
        variations: [],
        period_start: periodStart,
        period_end: periodEnd,
        status: "pendente",
        scope_vendas: false,
        scope_landing: false,
        scope_trafego: false,
        scope_auxiliar: true,
        metadata: { kind: "monthly_review_reminder", active_count: activeCount },
      });

      if (!insErr) created++;
    }

    return new Response(
      JSON.stringify({ ok: true, tenants_evaluated: tenantCounts.size, reminders_created: created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[monthly-review-reminder] fatal:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
