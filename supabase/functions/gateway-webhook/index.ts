// gateway-webhook — receives status updates from shipping gateways (tracking, status, etc.)
// Public endpoint (verify_jwt=false). Identifies tenant via provider_id query param + secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const providerId = url.searchParams.get("provider_id");
  const secret = url.searchParams.get("secret");

  if (!providerId) {
    return new Response(JSON.stringify({ success: false, error: "provider_id_required" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: provider } = await sb
    .from("shipping_providers")
    .select("id, tenant_id, provider, credentials, is_enabled")
    .eq("id", providerId)
    .maybeSingle();

  if (!provider) {
    return new Response(JSON.stringify({ success: false, error: "provider_not_found" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate webhook secret
  const expectedSecret = provider.credentials?.webhook_secret;
  if (expectedSecret && secret !== expectedSecret) {
    return new Response(JSON.stringify({ success: false, error: "invalid_secret" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = await req.json().catch(() => ({}));

  // Persist raw event for audit
  await sb.from("gateway_sync_queue").insert({
    tenant_id: provider.tenant_id,
    order_id: payload.order_id || payload.OrderId || "00000000-0000-0000-0000-000000000000",
    provider_id: provider.id,
    action: "sync_order",
    status: "done",
    processed_at: new Date().toISOString(),
    payload: { webhook: true, body: payload },
  });

  // Frenet-specific: update tracking on order_shipments if present
  if (provider.provider === "frenet" && payload.OrderNumber && payload.TrackingNumber) {
    await sb
      .from("orders")
      .update({ tracking_code: payload.TrackingNumber })
      .eq("tenant_id", provider.tenant_id)
      .eq("order_number", payload.OrderNumber);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
