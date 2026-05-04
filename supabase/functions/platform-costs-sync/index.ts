// =============================================================
// platform-costs-sync
// =============================================================
// Atualiza saldo/créditos dos serviços externos com sync_mode='auto'.
// Roda manualmente (botão admin) ou via cron a cada 6h.
// Para serviços sem API pública, mantém valores do registro manual.
//
// Padrão: 200 OK com { success: true|false, results: [...] }
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/import-helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SyncResult {
  service_key: string;
  status: "ok" | "skipped" | "error";
  current_balance?: number | null;
  balance_unit?: string | null;
  error?: string;
}

// ---------- Adapters por serviço (best-effort) ----------

async function syncSendgrid(): Promise<Partial<SyncResult>> {
  const key = Deno.env.get("SENDGRID_API_KEY");
  if (!key) return { status: "skipped", error: "SENDGRID_API_KEY não configurada" };
  // SendGrid tem limit por plano; consulta de créditos restantes do mês
  const r = await fetch("https://api.sendgrid.com/v3/user/credits", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return { status: "error", error: `SendGrid HTTP ${r.status}` };
  const data = await r.json();
  const remain = Number(data?.remain ?? data?.remaining ?? null);
  return {
    status: "ok",
    current_balance: Number.isFinite(remain) ? remain : null,
    balance_unit: "emails",
  };
}

async function syncCloudflare(): Promise<Partial<SyncResult>> {
  // Cloudflare não expõe saldo/billing pelo API geral; deixamos como skipped.
  return { status: "skipped", error: "Cloudflare não expõe saldo via API pública" };
}

async function syncOpenAI(): Promise<Partial<SyncResult>> {
  // OpenAI desativou o endpoint público de billing; manter manual.
  return { status: "skipped", error: "OpenAI billing API descontinuado para apps" };
}

async function syncGemini(): Promise<Partial<SyncResult>> {
  // Google AI Studio não expõe saldo por API; manter manual.
  return { status: "skipped", error: "Gemini não expõe saldo via API pública" };
}

async function syncFalAi(): Promise<Partial<SyncResult>> {
  const key = Deno.env.get("FAL_KEY") || Deno.env.get("FAL_API_KEY");
  if (!key) return { status: "skipped", error: "FAL_KEY não configurada" };
  // Fal.ai não publica endpoint de saldo público; deixamos skipped até confirmar.
  return { status: "skipped", error: "Fal.AI sem endpoint público de saldo" };
}

const ADAPTERS: Record<string, () => Promise<Partial<SyncResult>>> = {
  sendgrid: syncSendgrid,
  cloudflare: syncCloudflare,
  openai: syncOpenAI,
  gemini: syncGemini,
  fal_ai: syncFalAi,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: services, error } = await supabase
      .from("platform_external_costs")
      .select("id, service_key, sync_mode, is_active")
      .eq("is_active", true)
      .eq("sync_mode", "auto");

    if (error) throw error;

    const results: SyncResult[] = [];

    for (const svc of services ?? []) {
      const adapter = ADAPTERS[svc.service_key];
      if (!adapter) {
        results.push({ service_key: svc.service_key, status: "skipped", error: "sem adapter" });
        await supabase
          .from("platform_external_costs")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "skipped",
            last_sync_error: "sem adapter",
          })
          .eq("id", svc.id);
        continue;
      }
      try {
        const out = await adapter();
        const update: Record<string, unknown> = {
          last_sync_at: new Date().toISOString(),
          last_sync_status: out.status,
          last_sync_error: out.error ?? null,
        };
        if (out.current_balance !== undefined) update.current_balance = out.current_balance;
        if (out.balance_unit !== undefined) update.balance_unit = out.balance_unit;
        await supabase.from("platform_external_costs").update(update).eq("id", svc.id);
        results.push({ service_key: svc.service_key, ...out } as SyncResult);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase
          .from("platform_external_costs")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "error",
            last_sync_error: msg,
          })
          .eq("id", svc.id);
        results.push({ service_key: svc.service_key, status: "error", error: msg });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results, synced_at: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
