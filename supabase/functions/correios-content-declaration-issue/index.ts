// correios-content-declaration-issue
// Motor único de Declaração de Conteúdo dos Correios (NÃO fiscal).
// Não chama Focus/Sefaz. Não altera fiscal_stage. Não substitui NF-e.
// Cria registro auditável e devolve número interno + snapshot para o cliente gerar o PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface IssueInput {
  tenant_id?: string;
  order_id?: string | null;
  fiscal_invoice_id?: string | null;
  source?: "manual" | "gateway" | "shipment";
  reason: string;
  responsibility_acknowledged: boolean;
  volumes_count?: number;
  total_weight_grams?: number; // override obrigatório quando o pedido não tiver peso
  emission_city?: string | null;
}

function genDcNumber(seedId: string): string {
  const ts = Date.now().toString().slice(-8);
  const sufix = (seedId || crypto.randomUUID()).replace(/-/g, "").slice(0, 4).toUpperCase();
  return `DC-${ts}-${sufix}`;
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Auth: service-role OU usuário autenticado com papel owner/admin/operator
  const authHeader = req.headers.get("authorization") || "";
  const isServiceRole = authHeader === `Bearer ${SERVICE_ROLE}`;
  let callerUserId: string | null = null;
  let callerTenantId: string | null = null;

  if (!isServiceRole) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return jsonResp({ success: false, error: "Não autorizado" }, 401);
    callerUserId = u.user.id;
    const { data: prof } = await sb.from("profiles").select("current_tenant_id").eq("id", u.user.id).single();
    callerTenantId = prof?.current_tenant_id ?? null;
    if (!callerTenantId) return jsonResp({ success: false, error: "Tenant não encontrado" });
  }

  let body: IssueInput;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ success: false, error: "invalid_json" });
  }

  const tenantId = isServiceRole ? body.tenant_id : callerTenantId;
  if (!tenantId) return jsonResp({ success: false, error: "tenant_id_required" });

  if (!body.reason || body.reason.trim().length < 3) {
    return jsonResp({ success: false, error: "reason_required" });
  }
  if (body.responsibility_acknowledged !== true) {
    return jsonResp({ success: false, error: "responsibility_required" });
  }

  // Validação de papel para usuário logado
  if (!isServiceRole && callerUserId) {
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const role = roleRow?.role ?? "viewer";
    if (!["owner", "admin", "operator"].includes(role)) {
      return jsonResp({ success: false, error: "Permissão insuficiente", code: "insufficient_role" }, 403);
    }
  }

  // Snapshots
  const [{ data: settings }, invoiceRes, orderRes] = await Promise.all([
    sb.from("fiscal_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    body.fiscal_invoice_id
      ? sb
          .from("fiscal_invoices")
          .select("*, fiscal_invoice_items(descricao, quantidade, valor_unitario, unidade, codigo_produto)")
          .eq("id", body.fiscal_invoice_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    body.order_id
      ? sb
          .from("orders")
          .select("id, customer_name, customer_cpf, customer_cnpj, customer_phone, shipping_address, total, items:order_items(name, quantity, unit_price, weight_grams, sku)")
          .eq("id", body.order_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const invoice: any = invoiceRes?.data ?? null;
  const order: any = orderRes?.data ?? null;

  if (!invoice && !order) {
    return jsonResp({ success: false, error: "no_source_record" });
  }

  // Sender (remetente)
  const sender = settings
    ? {
        razao_social: settings.razao_social,
        nome_fantasia: settings.nome_fantasia,
        cnpj: settings.cnpj,
        logradouro: settings.endereco_logradouro,
        numero: settings.endereco_numero,
        complemento: settings.endereco_complemento,
        bairro: settings.endereco_bairro,
        municipio: settings.endereco_municipio,
        uf: settings.endereco_uf,
        cep: settings.endereco_cep,
        telefone: settings.telefone,
        email: settings.email,
      }
    : {};

  // Recipient (destinatário) — prioriza invoice, depois order
  const recipient = invoice
    ? {
        nome: invoice.dest_nome,
        documento: invoice.dest_cpf_cnpj,
        logradouro: invoice.dest_endereco_logradouro,
        numero: invoice.dest_endereco_numero,
        complemento: invoice.dest_endereco_complemento,
        bairro: invoice.dest_endereco_bairro,
        municipio: invoice.dest_endereco_municipio,
        uf: invoice.dest_endereco_uf,
        cep: invoice.dest_endereco_cep,
        telefone: invoice.dest_telefone,
      }
    : order
    ? {
        nome: order.customer_name,
        documento: order.customer_cpf || order.customer_cnpj,
        ...((order.shipping_address as any) || {}),
        telefone: order.customer_phone,
      }
    : {};

  // Items
  const itemsRaw: any[] = invoice?.fiscal_invoice_items ?? order?.items ?? [];
  let totalCents = 0;
  let totalGrams = 0;
  const items = itemsRaw.map((it: any) => {
    const qtd = Number(it.quantidade ?? it.quantity ?? 0);
    const vu = Number(it.valor_unitario ?? it.unit_price ?? 0);
    const grams = Number(it.weight_grams ?? 0);
    const subtotal = qtd * vu;
    totalCents += Math.round(subtotal * 100);
    totalGrams += grams * qtd;
    return {
      descricao: it.descricao ?? it.name ?? "",
      codigo: it.codigo_produto ?? it.sku ?? null,
      quantidade: qtd,
      unidade: it.unidade ?? "UN",
      valor_unitario: vu,
      subtotal,
    };
  });

  if (items.length === 0) return jsonResp({ success: false, error: "no_items" });

  const seedId = invoice?.id || order?.id || crypto.randomUUID();
  const dcNumber = genDcNumber(seedId);

  const { data: inserted, error: insErr } = await sb
    .from("shipping_content_declarations")
    .insert({
      tenant_id: tenantId,
      order_id: body.order_id ?? order?.id ?? null,
      fiscal_invoice_id: body.fiscal_invoice_id ?? invoice?.id ?? null,
      source: body.source ?? "manual",
      dc_number: dcNumber,
      status: "issued",
      reason: body.reason,
      responsibility_acknowledged: true,
      acknowledged_by_user_id: callerUserId,
      sender_snapshot: sender,
      recipient_snapshot: recipient,
      items_snapshot: items,
      total_value_cents: totalCents,
      total_weight_grams: totalGrams || null,
      volumes_count: body.volumes_count ?? 1,
      emission_city: body.emission_city ?? settings?.endereco_municipio ?? null,
    })
    .select()
    .single();

  if (insErr) {
    console.error("[correios-content-declaration-issue]", insErr);
    return jsonResp({ success: false, error: insErr.message });
  }

  return jsonResp({ success: true, declaration: inserted });
});
