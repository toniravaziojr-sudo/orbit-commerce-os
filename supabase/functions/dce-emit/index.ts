// dce-emit — issues Electronic Content Declaration (DC-e) via Focus NFe
// Used as alternative to NF-e for non-fiscal shipments (e.g., samples, returns)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FOCUS_NFE_TOKEN = Deno.env.get("FOCUS_NFE_TOKEN");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Auth gate: service-role bearer OR authenticated owner/admin/operator
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRole = authHeader === `Bearer ${SERVICE_ROLE}`;
  let callerTenantId: string | null = null;

  if (!isServiceRole) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: prof } = await sb.from("profiles").select("current_tenant_id").eq("id", u.user.id).single();
    callerTenantId = prof?.current_tenant_id ?? null;
    if (!callerTenantId) {
      return new Response(JSON.stringify({ success: false, error: "Tenant não encontrado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await sb.from("user_roles").select("role")
      .eq("user_id", u.user.id).eq("tenant_id", callerTenantId).maybeSingle();
    const role = roleRow?.role ?? "viewer";
    if (role !== "owner" && role !== "admin" && role !== "operator") {
      return new Response(JSON.stringify({ success: false, error: "Permissão insuficiente", code: "insufficient_role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const body = await req.json().catch(() => ({}));
  const orderIds: string[] = Array.isArray(body?.order_ids) ? body.order_ids : (body?.order_id ? [body.order_id] : []);

  if (!orderIds.length) {
    return new Response(JSON.stringify({ success: false, error: "order_ids_required" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  const results: any[] = [];

  for (const orderId of orderIds) {
    try {
      const { data: order } = await sb
        .from("orders")
        .select("id, tenant_id, order_number, customer_name, customer_cpf, customer_cnpj, shipping_address, total, items:order_items(name, quantity, weight_grams)")
        .eq("id", orderId)
        .maybeSingle();

      if (!order) throw new Error("order_not_found");

      // Create draft record first
      const { data: draft, error: draftErr } = await sb
        .from("fiscal_dce")
        .insert({
          tenant_id: order.tenant_id,
          order_id: order.id,
          status: "queued",
          payload: {
            recipient: {
              name: order.customer_name,
              document: order.customer_cpf || order.customer_cnpj,
            },
            address: order.shipping_address,
            items: order.items,
            total: order.total,
          },
        })
        .select()
        .single();

      if (draftErr) throw draftErr;

      // TODO: real Focus NFe DC-e endpoint integration
      // For now, leave in 'queued' state — real call to be implemented when
      // Focus NFe endpoint contract is finalized for this tenant.
      // The structure is ready: status flows queued → processing → authorized | rejected.

      if (!FOCUS_NFE_TOKEN) {
        results.push({ order_id: orderId, success: true, dce_id: draft.id, status: "queued", note: "queued — Focus NFe token not configured" });
        continue;
      }

      // Placeholder: when ready, call Focus NFe endpoint here, update status to 'authorized'
      // and trigger order status transition to 'fulfilled'.
      results.push({ order_id: orderId, success: true, dce_id: draft.id, status: "queued" });
    } catch (err: any) {
      results.push({ order_id: orderId, success: false, error: String(err?.message || err) });
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
