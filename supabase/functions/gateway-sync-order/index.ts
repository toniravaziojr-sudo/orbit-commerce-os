// gateway-sync-order — processes pending sync_order jobs from gateway_sync_queue
// Pattern: callable on-demand or by cron. Uses service_role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { frenetAdapter } from "../_shared/frenet-adapter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getAdapter(provider: string) {
  if (provider === "frenet") return frenetAdapter;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body?.limit ?? 10), 50);

  // Pull pending sync_order jobs that are due
  const { data: jobs, error: jobsErr } = await sb
    .from("gateway_sync_queue")
    .select("id, tenant_id, order_id, provider_id, action, attempts, payload")
    .eq("action", "sync_order")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (jobsErr) {
    return new Response(JSON.stringify({ success: false, error: jobsErr.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const job of jobs ?? []) {
    // Mark processing
    await sb
      .from("gateway_sync_queue")
      .update({ status: "processing", attempts: (job.attempts ?? 0) + 1 })
      .eq("id", job.id);

    try {
      // Load provider + credentials
      const { data: provider } = await sb
        .from("shipping_providers")
        .select("provider, credentials, is_enabled")
        .eq("id", job.provider_id)
        .maybeSingle();

      if (!provider || !provider.is_enabled) {
        throw new Error("provider_disabled_or_missing");
      }

      const adapter = getAdapter(provider.provider);
      if (!adapter) throw new Error(`no_adapter_for_${provider.provider}`);

      // Load order with items + address
      const { data: order } = await sb
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_email, customer_phone, customer_cpf, customer_cnpj, shipping_address, shipping_carrier, shipping_method, shipping_cost, total, items:order_items(sku, name, quantity, unit_price, weight_grams, height_cm, width_cm, length_cm)"
        )
        .eq("id", job.order_id)
        .maybeSingle();

      if (!order) throw new Error("order_not_found");

      const result = await adapter.syncOrder(
        { token: provider.credentials?.token || provider.credentials?.api_token || "" },
        order as any
      );

      await sb
        .from("gateway_sync_queue")
        .update({
          status: "done",
          processed_at: new Date().toISOString(),
          external_ref: result.external_ref,
          payload: { ...(job.payload || {}), result: result.raw },
        })
        .eq("id", job.id);

      results.push({ id: job.id, success: true, external_ref: result.external_ref });
    } catch (err: any) {
      const attempts = (job.attempts ?? 0) + 1;
      const maxAttempts = 5;
      const newStatus = attempts >= maxAttempts ? "failed" : "pending";
      const backoffMin = Math.min(2 ** attempts, 60);
      await sb
        .from("gateway_sync_queue")
        .update({
          status: newStatus,
          last_error: String(err?.message || err),
          next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
        })
        .eq("id", job.id);
      results.push({ id: job.id, success: false, error: String(err?.message || err) });
    }
  }

  return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
