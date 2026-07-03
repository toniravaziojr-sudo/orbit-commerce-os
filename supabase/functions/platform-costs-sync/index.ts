// =============================================================
// platform-costs-sync
// =============================================================
// Atualiza saldo apenas dos serviços que possuem API pública de
// consulta (hoje: SendGrid). Os demais permanecem em modo manual.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/import-helpers.ts";
import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


interface SyncResult {
  service_key: string;
  status: "ok" | "skipped" | "error";
  current_balance?: number | null;
  balance_unit?: string | null;
  error?: string;
}

async function syncSendgrid(): Promise<Partial<SyncResult>> {
  const key = Deno.env.get("SENDGRID_API_KEY");
  if (!key) return { status: "error", error: "SENDGRID_API_KEY ausente no ambiente" };
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

const ADAPTERS: Record<string, () => Promise<Partial<SyncResult>>> = {
  sendgrid: syncSendgrid,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: services, error } = await supabase
      .from("platform_external_costs")
      .select("id, service_key")
      .eq("is_active", true)
      .eq("sync_mode", "auto");
    if (error) throw error;

    const results: SyncResult[] = [];
    for (const svc of services ?? []) {
      const adapter = ADAPTERS[svc.service_key];
      if (!adapter) continue;
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
          .update({ last_sync_at: new Date().toISOString(), last_sync_status: "error", last_sync_error: msg })
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
