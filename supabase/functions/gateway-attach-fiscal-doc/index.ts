// gateway-attach-fiscal-doc — attaches NF-e/DC-e to gateway after issuance
// Triggered by user action ("Enviar à Frenet") or after fiscal authorization
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

  // Auth gate: accept service-role bearer (internal callers) OR authenticated owner/admin user
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
      // Load order + resolved provider + invoice
      const { data: order } = await sb
        .from("orders")
        .select(
          "id, tenant_id, order_number, customer_name, customer_email, customer_phone, customer_cpf, customer_cnpj, shipping_address, shipping_carrier, shipping_method, shipping_cost, total, resolved_shipping_provider_id, resolved_shipping_provider_kind, items:order_items(sku, name, quantity, unit_price, weight_grams, height_cm, width_cm, length_cm)"
        )
        .eq("id", orderId)
        .maybeSingle();

      if (!order) throw new Error("order_not_found");
      // Tenant ownership guard for user-authenticated callers
      if (!isServiceRole && callerTenantId && order.tenant_id !== callerTenantId) {
        throw new Error("forbidden_tenant_mismatch");
      }
      if (order.resolved_shipping_provider_kind !== "gateway") throw new Error("not_a_gateway_order");
      if (!order.resolved_shipping_provider_id) throw new Error("no_resolved_provider");

      const { data: provider } = await sb
        .from("shipping_providers")
        .select("provider, credentials, is_enabled")
        .eq("id", order.resolved_shipping_provider_id)
        .maybeSingle();

      if (!provider || !provider.is_enabled) throw new Error("provider_disabled");

      const adapter = getAdapter(provider.provider);
      if (!adapter) throw new Error(`no_adapter_for_${provider.provider}`);

      // Try NF-e first, fallback to DC-e
      const { data: nfe } = await sb
        .from("fiscal_invoices")
        .select("numero, serie, chave, authorized_at, total, xml_url, status")
        .eq("order_id", orderId)
        .eq("status", "authorized")
        .maybeSingle();

      let invoice: any = null;
      if (nfe?.chave) {
        invoice = {
          chave: nfe.chave,
          numero: nfe.numero,
          serie: nfe.serie,
          data_emissao: nfe.authorized_at,
          valor: nfe.total,
          xml_url: nfe.xml_url,
        };
      } else {
        // Fallback: Declaração de Conteúdo dos Correios (NÃO fiscal).
        // Motor único `shipping_content_declarations`. Se nenhuma DC existir, emite uma
        // automaticamente com source='gateway' e motivo padrão de despacho gateway.
        let { data: dc } = await sb
          .from("shipping_content_declarations")
          .select("id, dc_number, total_value_cents, issued_at, pdf_url")
          .eq("order_id", orderId)
          .eq("status", "issued")
          .order("issued_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!dc) {
          const issueRes = await fetch(
            `${SUPABASE_URL}/functions/v1/correios-content-declaration-issue`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SERVICE_ROLE}`,
              },
              body: JSON.stringify({
                tenant_id: order.tenant_id,
                order_id: order.id,
                source: "gateway",
                reason: "Emissão automática para despacho via gateway logístico (sem NF-e).",
                responsibility_acknowledged: true,
              }),
            },
          );
          const issueJson = await issueRes.json().catch(() => ({}));
          if (issueJson?.success && issueJson?.declaration) {
            const d = issueJson.declaration;
            dc = {
              id: d.id,
              dc_number: d.dc_number,
              total_value_cents: d.total_value_cents,
              issued_at: d.issued_at,
              pdf_url: d.pdf_url,
            } as any;
          }
        }

        if (dc) {
          invoice = {
            chave: null,
            numero: dc.dc_number,
            serie: null,
            data_emissao: dc.issued_at,
            valor: (dc.total_value_cents || 0) / 100,
            xml_url: dc.pdf_url,
            tipo: "DC_CORREIOS",
          };
        }
      }

      if (!invoice) throw new Error("no_authorized_fiscal_doc");

      const result = await adapter.attachInvoice(
        { token: provider.credentials?.token || provider.credentials?.api_token || "" },
        order as any,
        invoice
      );

      // Enqueue audit record + mark as fulfilled
      await sb.from("gateway_sync_queue").insert({
        tenant_id: order.tenant_id,
        order_id: order.id,
        provider_id: order.resolved_shipping_provider_id,
        action: "attach_invoice",
        status: "done",
        processed_at: new Date().toISOString(),
        payload: { invoice, result: result.raw },
      });

      // Mark order as fulfilled
      await sb.from("orders").update({ status: "fulfilled" }).eq("id", order.id);

      results.push({ order_id: orderId, success: true });
    } catch (err: any) {
      results.push({ order_id: orderId, success: false, error: String(err?.message || err) });
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
