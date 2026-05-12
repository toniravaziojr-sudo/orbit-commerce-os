// TEMPORARY bootstrap function — Onda 1.5
// Reschedules the weekly Command Insights cron job using service_role at runtime.
// MUST be deleted after a single successful run.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_CONFIRM = "REAGENDAR_WEEKLY_COMMAND_INSIGHTS";
const OLD_JOB = "generate-weekly-insights";
const NEW_JOB = "weekly-command-insights";
const SCHEDULE = "0 11 * * 1";

function mask(s: string | null | undefined): string {
  if (!s) return "<empty>";
  if (s.length <= 12) return "***";
  return `${s.slice(0, 6)}…${s.slice(-4)} (len=${s.length})`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!serviceRole) {
      return new Response(JSON.stringify({ error: "missing_service_role" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceRole);

    // Validate platform admin via canonical RPC, executed AS the calling user
    const userScoped = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin, error: rpcErr } = await userScoped.rpc("is_platform_admin");
    if (rpcErr || !isAdmin) {
      console.warn(`[bootstrap-insights-cron] denied for ${userData.user.email}`);
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== REQUIRED_CONFIRM) {
      return new Response(JSON.stringify({ error: "confirmation_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the cron command using service_role from runtime env. Never logged in clear.
    const targetUrl = `${url}/functions/v1/command-insights-generate`;
    const headersJson = JSON.stringify({
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRole}`,
    });
    const command = `
  SELECT net.http_post(
    url := '${targetUrl}',
    headers := '${headersJson.replace(/'/g, "''")}'::jsonb,
    body := '{"trigger_type":"scheduled"}'::jsonb
  ) AS request_id;
`;

    const { data: result, error: schedErr } = await admin.rpc("_bootstrap_reschedule_cron", {
      p_unschedule_name: OLD_JOB,
      p_schedule_name: NEW_JOB,
      p_schedule: SCHEDULE,
      p_command: command,
    });

    if (schedErr) {
      console.error("[bootstrap-insights-cron] reschedule failed:", schedErr.message);
      return new Response(JSON.stringify({ error: "reschedule_failed", detail: schedErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[bootstrap-insights-cron] OK by ${userData.user.email} — service_role ${mask(serviceRole)}`);

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal_error";
    console.error("[bootstrap-insights-cron] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
