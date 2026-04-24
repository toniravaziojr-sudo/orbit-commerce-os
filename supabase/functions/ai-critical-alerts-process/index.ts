// Edge Function: ai-critical-alerts-process
// Pós-processa alertas críticos: agrupa por categoria nas últimas 2h,
// atualiza occurrences_2h e marca como urgentes para revisão imediata.
// Roda a cada 30 minutos.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Buscar alertas abertos das últimas 2h
    const { data: alerts, error } = await supabase
      .from("ai_critical_alerts")
      .select("id, tenant_id, category, detected_at")
      .eq("status", "aberto")
      .gte("detected_at", twoHoursAgo);

    if (error) throw error;

    // Agrupar por tenant + categoria
    const groups = new Map<string, { tenant_id: string; category: string; ids: string[] }>();
    for (const a of alerts || []) {
      const key = `${a.tenant_id}::${a.category}`;
      if (!groups.has(key)) {
        groups.set(key, { tenant_id: a.tenant_id, category: a.category, ids: [] });
      }
      groups.get(key)!.ids.push(a.id);
    }

    let updated = 0;
    for (const group of groups.values()) {
      const count = group.ids.length;
      // Atualiza todos os alertas do grupo com o contador real
      const { error: upErr } = await supabase
        .from("ai_critical_alerts")
        .update({ occurrences_2h: count, updated_at: new Date().toISOString() })
        .in("id", group.ids);
      if (!upErr) updated += group.ids.length;
    }

    // Auto-resolver alertas com mais de 24h sem atividade
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: stale } = await supabase
      .from("ai_critical_alerts")
      .update({ status: "expirado", resolved_at: new Date().toISOString() })
      .eq("status", "aberto")
      .lt("detected_at", oneDayAgo)
      .select("id");

    return new Response(
      JSON.stringify({
        ok: true,
        groups_processed: groups.size,
        alerts_updated: updated,
        alerts_expired: stale?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[critical-alerts-process] fatal:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
