// =============================================================
// DC BACKFILL TENANT
// -------------------------------------------------------------
// Reprocessa todos os Pedidos de Venda ATIVOS de um tenant que
// ainda não têm Declaração de Conteúdo (DC) nativa emitida, e
// emite a DC para cada um.
//
// Idempotente (delega ao correios-content-declaration-issue, que
// reaproveita DC existente).
//
// Acesso: somente service_role ou usuário com papel owner/admin
// do tenant alvo (e que seja o tenant atual do usuário).
//
// Doc: docs/especificacoes/fiscal/preflight-fiscal-logistico.md
//      docs/especificacoes/erp/logistica.md
// =============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensurePvContentDeclaration } from "../_shared/ensure-pv-content-declaration.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface BackfillBody {
  tenant_id?: string;
  /** Máximo de PVs a processar nesta execução. Padrão 500. */
  limit?: number;
  /** Se true, retorna lista de PVs sem DC sem emitir. */
  dry_run?: boolean;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const authHeader = req.headers.get("authorization") || "";
  const isServiceRole = authHeader === `Bearer ${SERVICE_ROLE}`;
  let callerTenantId: string | null = null;
  let callerUserId: string | null = null;

  if (!isServiceRole) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ success: false, error: "Não autorizado" }, 401);
    callerUserId = u.user.id;
    const { data: prof } = await sb.from("profiles").select("current_tenant_id").eq("id", u.user.id).single();
    callerTenantId = prof?.current_tenant_id ?? null;
  }

  let body: BackfillBody = {};
  try { body = await req.json(); } catch { /* aceita body vazio */ }

  const tenantId = isServiceRole ? body.tenant_id : callerTenantId;
  if (!tenantId) return json({ success: false, error: "tenant_id obrigatório" });

  if (!isServiceRole && callerUserId) {
    if (tenantId !== callerTenantId) {
      return json({ success: false, error: "Tenant alvo diferente do tenant atual do usuário" }, 403);
    }
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const role = roleRow?.role ?? "viewer";
    if (!["owner", "admin"].includes(role)) {
      return json({ success: false, error: "Acesso restrito a admin/owner do tenant" }, 403);
    }
  }

  const lim = Math.max(1, Math.min(1000, Number(body.limit) || 500));

  // Lista PVs ativos sem DC. Critério "ativo" alinha ao espelho do pedido
  // (mem://constraints/pv-pedido-status-mirror-from-order): exclui cancelado
  // e chargeback_perdido.
  const { data: pvs, error: pvErr } = await sb
    .from("fiscal_invoices")
    .select("id, numero, dest_nome, order_id, pedido_status, fiscal_stage, created_at")
    .eq("tenant_id", tenantId)
    .eq("fiscal_stage", "pedido_venda")
    .not("pedido_status", "in", "(cancelado,chargeback_perdido)")
    .order("created_at", { ascending: true });

  if (pvErr) return json({ success: false, error: pvErr.message });

  const pvIds = (pvs || []).map((p: any) => p.id);
  if (pvIds.length === 0) {
    return json({ success: true, total_pv: 0, processed: 0, created: 0, skipped: 0, failed: 0, failures: [] });
  }

  // Já com DC?
  const { data: dcs } = await sb
    .from("shipping_content_declarations")
    .select("fiscal_invoice_id")
    .eq("tenant_id", tenantId)
    .eq("status", "issued")
    .in("fiscal_invoice_id", pvIds);
  const haveDc = new Set((dcs || []).map((d: any) => d.fiscal_invoice_id));

  const pending = (pvs || []).filter((p: any) => !haveDc.has(p.id)).slice(0, lim);

  if (body.dry_run) {
    return json({
      success: true,
      mode: "dry_run",
      total_pv: pvs.length,
      already_with_dc: haveDc.size,
      pending: pending.length,
      sample_pending: pending.slice(0, 20).map((p: any) => ({ id: p.id, numero: p.numero, dest: p.dest_nome })),
    });
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ pv_id: string; numero: any; dest: any; reason?: string }> = [];

  for (const pv of pending) {
    const r = await ensurePvContentDeclaration({
      tenantId,
      fiscalInvoiceId: pv.id,
      orderId: pv.order_id ?? null,
    });
    if (!r.ok) {
      failed += 1;
      failures.push({ pv_id: pv.id, numero: pv.numero, dest: pv.dest_nome, reason: r.reason });
    } else {
      if (r.alreadyExisted) skipped += 1;
      else created += 1;
    }
    // Throttle leve para evitar rate-limit interno do edge runtime quando
    // o emissor de DC é chamado em sequência rápida (trace compartilhado).
    await new Promise((res) => setTimeout(res, 350));
  }


  return json({
    success: true,
    total_pv: pvs.length,
    already_with_dc: haveDc.size,
    processed: pending.length,
    created,
    skipped_existing: skipped,
    failed,
    failures: failures.slice(0, 100),
  });
});
