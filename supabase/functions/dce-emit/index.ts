// dce-emit — issues Electronic Content Declaration (DC-e) via Nuvem Fiscal
// Used as alternative to NF-e for non-fiscal shipments (e.g., samples, returns)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NUVEM_FISCAL_TOKEN = Deno.env.get("NUVEM_FISCAL_TOKEN");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
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

      // TODO: real Nuvem Fiscal DC-e endpoint integration
      // For now, leave in 'queued' state — real call to be implemented when
      // Nuvem Fiscal endpoint contract is finalized for this tenant.
      // The structure is ready: status flows queued → processing → authorized | rejected.

      if (!NUVEM_FISCAL_TOKEN) {
        results.push({ order_id: orderId, success: true, dce_id: draft.id, status: "queued", note: "queued — Nuvem Fiscal token not configured" });
        continue;
      }

      // Placeholder: when ready, call Nuvem Fiscal endpoint here, update status to 'authorized'
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
