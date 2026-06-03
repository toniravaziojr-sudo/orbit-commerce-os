// correios-content-declaration-issue
// Motor único de Declaração de Conteúdo dos Correios (NÃO fiscal).
// Não chama Focus/Sefaz. Não altera fiscal_stage. Não substitui NF-e.
// Cria registro auditável e devolve número interno + snapshot para o cliente gerar o PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { runPreflight } from "../_shared/fiscal-shipping-preflight.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface IssueInput {
  tenant_id?: string;
  order_id?: string | null;
  fiscal_invoice_id?: string | null;
  source?: "manual" | "gateway" | "shipment" | "auto";
  reason?: string;
  responsibility_acknowledged?: boolean;
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

  // Modo automático (DC nativa do PV): motivo e aceite são sistêmicos.
  // O lojista aceitou os termos uma vez nas Configurações Fiscais.
  const isAuto = body.source === "auto";
  const effectiveReason = (body.reason && body.reason.trim()) || (isAuto ? "Venda/remessa" : "");
  const effectiveAck = body.responsibility_acknowledged === true || isAuto;

  if (!effectiveReason || effectiveReason.length < 3) {
    return jsonResp({ success: false, error: "reason_required" });
  }
  if (!effectiveAck) {
    return jsonResp({ success: false, error: "responsibility_required" });
  }

  // ===== IDEMPOTÊNCIA =====
  // DC é artefato nativo do PV: 1 DC ativa por PV. Se já existir uma
  // 'issued' para este fiscal_invoice_id (ou order_id, fallback histórico),
  // devolve o registro existente em vez de criar duplicata.
  if (body.fiscal_invoice_id || body.order_id) {
    let dupQ = sb
      .from("shipping_content_declarations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "issued")
      .order("created_at", { ascending: false })
      .limit(1);
    if (body.fiscal_invoice_id) {
      dupQ = dupQ.eq("fiscal_invoice_id", body.fiscal_invoice_id);
    } else if (body.order_id) {
      dupQ = dupQ.eq("order_id", body.order_id).is("fiscal_invoice_id", null);
    }
    const { data: existing } = await dupQ.maybeSingle();
    if (existing) {
      return jsonResp({ success: true, already_existed: true, declaration: existing });
    }
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
          .select("*, fiscal_invoice_items(descricao, quantidade, valor_unitario, unidade, codigo_produto, order_item_id, product_id)")
          .eq("id", body.fiscal_invoice_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    body.order_id
      ? sb
          .from("orders")
          .select("id, customer_name, customer_cpf, customer_cnpj, customer_phone, shipping_address, total, items:order_items(product_name, quantity, unit_price, weight, sku, product_id)")
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

  // Enriquecer peso quando ausente:
  // - itens fiscais: buscar order_items via order_item_id
  // - itens com product_id: buscar products.weight
  const orderItemIds = itemsRaw.map((it: any) => it.order_item_id).filter(Boolean);
  const productIds = itemsRaw.map((it: any) => it.product_id).filter(Boolean);

  const weightByOrderItem = new Map<string, { weight: number | null; product_id: string | null }>();
  if (orderItemIds.length > 0) {
    const { data: oiRows } = await sb
      .from("order_items")
      .select("id, weight, product_id")
      .in("id", orderItemIds);
    for (const r of oiRows ?? []) {
      weightByOrderItem.set(r.id, { weight: Number(r.weight ?? 0) || null, product_id: r.product_id });
      if (r.product_id) productIds.push(r.product_id);
    }
  }

  const weightByProduct = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: pRows } = await sb
      .from("products")
      .select("id, weight")
      .in("id", productIds);
    for (const r of pRows ?? []) {
      const w = Number(r.weight ?? 0);
      if (w > 0) weightByProduct.set(r.id, w);
    }
  }

  let totalCents = 0;
  let totalGrams = 0;
  const items = itemsRaw.map((it: any) => {
    const qtd = Number(it.quantidade ?? it.quantity ?? 0);
    const vu = Number(it.valor_unitario ?? it.unit_price ?? 0);

    // Resolver peso (em gramas) com cascata: item -> order_item -> product
    let grams = Number(it.weight ?? it.weight_grams ?? 0);
    let pid = it.product_id ?? null;
    if (!grams && it.order_item_id) {
      const oi = weightByOrderItem.get(it.order_item_id);
      if (oi?.weight) grams = oi.weight;
      if (!pid && oi?.product_id) pid = oi.product_id;
    }
    if (!grams && pid && weightByProduct.has(pid)) {
      grams = weightByProduct.get(pid)!;
    }

    const subtotal = qtd * vu;
    totalCents += Math.round(subtotal * 100);
    totalGrams += grams * qtd;
    return {
      descricao: it.descricao ?? it.product_name ?? it.name ?? "",
      codigo: it.codigo_produto ?? it.sku ?? null,
      quantidade: qtd,
      unidade: it.unidade ?? "UN",
      valor_unitario: vu,
      subtotal,
    };
  });

  if (items.length === 0) return jsonResp({ success: false, error: "Nenhum item informado para a Declaração de Conteúdo.", code: "no_items" });

  // Peso: override do cliente tem prioridade. Caso contrário usa o calculado dos itens.
  const finalWeightGrams =
    typeof body.total_weight_grams === "number" && body.total_weight_grams > 0
      ? Math.round(body.total_weight_grams)
      : totalGrams > 0
      ? totalGrams
      : null;

  if (!finalWeightGrams || finalWeightGrams <= 0) {
    return jsonResp({
      success: false,
      error: "Peso total da Declaração de Conteúdo não pôde ser calculado. Cadastre o peso dos produtos ou informe o peso total ao emitir.",
      code: "weight_required",
    });
  }

  // ===== PRÉ-FLIGHT UNIFICADO (DC + Emitente) =====
  // Garante que todos os dados obrigatórios para a DC estão presentes ANTES
  // de gravar o registro auditável. Mensagens em PT-BR via motor único.
  // Doc: docs/especificacoes/fiscal/preflight-fiscal-logistico.md
  const docDigits = String((recipient as any).documento || "").replace(/\D/g, "");
  const preflight = runPreflight({
    scopes: ["dc", "emitente"],
    destinatario: {
      nome: (recipient as any).nome,
      cpf_cnpj: docDigits,
      telefone: (recipient as any).telefone,
      endereco: {
        cep: (recipient as any).cep,
        logradouro: (recipient as any).logradouro,
        numero: (recipient as any).numero,
        bairro: (recipient as any).bairro,
        municipio: (recipient as any).municipio,
        uf: (recipient as any).uf,
      },
    },
    itens: items.map((it: any) => ({
      descricao: it.descricao,
      codigo_produto: it.codigo,
      quantidade: it.quantidade,
      valor_unitario: it.valor_unitario,
      // Peso já foi consolidado em finalWeightGrams; aqui o motor só checa
      // descrição/quantidade/valor por item. Peso total da embalagem é checado
      // pelo escopo 'shipment' na hora do despacho.
      peso_unitario_g: 1, // marcador positivo — o gate de peso real é o finalWeightGrams acima
    })),
    emitente: {
      razao_social: (sender as any).razao_social,
      cnpj: (sender as any).cnpj,
      telefone: (sender as any).telefone,
      cep: (sender as any).cep,
      logradouro: (sender as any).logradouro,
      numero: (sender as any).numero,
      bairro: (sender as any).bairro,
      municipio: (sender as any).municipio,
      uf: (sender as any).uf,
    },
  });
  if (!preflight.ok) {
    console.warn("[correios-content-declaration-issue] Pré-flight bloqueou emissão:", preflight.blockingIssues);
    return jsonResp({
      success: false,
      error: preflight.message,
      code: "PREFLIGHT_BLOCKED",
      issues: preflight.blockingIssues,
    });
  }

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
      reason: effectiveReason,
      responsibility_acknowledged: true,
      acknowledged_by_user_id: callerUserId,
      sender_snapshot: sender,
      recipient_snapshot: recipient,
      items_snapshot: items,
      total_value_cents: totalCents,
      total_weight_grams: finalWeightGrams,
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
