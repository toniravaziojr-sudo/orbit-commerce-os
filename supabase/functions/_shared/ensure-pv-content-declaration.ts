// =============================================================
// ENSURE PV CONTENT DECLARATION
// -------------------------------------------------------------
// Garante que todo Pedido de Venda nasce com uma Declaração de
// Conteúdo dos Correios "nativa" (status='issued'), idempotente.
//
// Chamado por:
//   • fiscal-create-manual (após salvar PV manual/duplicado)
//   • fiscal-create-draft  (após criar PV a partir de pedido real)
//   • dc-backfill-tenant   (one-shot retroativo)
//
// Regras:
//   • Se já existir DC 'issued' para este fiscal_invoice_id, NÃO
//     cria outra — apenas retorna o registro existente.
//   • Falha silenciosa nunca passa: retorna { ok:false, reason }
//     e o chamador decide se loga/marca pendência (não derruba o
//     salvamento do PV).
//   • Motivo padrão: "Venda/remessa".
//   • Responsabilidade: aceita sistemicamente — o lojista aceitou
//     uma vez nas Configurações Fiscais (premissa de operação).
// =============================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface EnsureDcResult {
  ok: boolean;
  alreadyExisted?: boolean;
  declarationId?: string;
  dcNumber?: string;
  reason?: string; // motivo da falha (em PT-BR p/ log)
  code?: string;
}

export async function ensurePvContentDeclaration(args: {
  tenantId: string;
  fiscalInvoiceId: string;
  orderId?: string | null;
  // Quando o chamador já tem um cliente Supabase service-role pode passar,
  // mas vamos sempre chamar via HTTP para reaproveitar a lógica/validação
  // do edge correios-content-declaration-issue (pré-flight, snapshots etc.).
}): Promise<EnsureDcResult> {
  try {
    // Auto-cura: se o PV está sem telefone/e-mail mas o pedido tem, copia
    // antes de chamar o emissor da DC. Cobre PVs antigos ou criados antes
    // da camada de origem garantir o preenchimento.
    try {
      const headers = {
        "apikey": SERVICE_ROLE,
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
      };
      const pvRes = await fetch(
        `${SUPABASE_URL}/rest/v1/fiscal_invoices?id=eq.${args.fiscalInvoiceId}&select=id,order_id,dest_telefone,dest_email`,
        { headers },
      );
      const pvRows = await pvRes.json().catch(() => []);
      const pv = Array.isArray(pvRows) ? pvRows[0] : null;
      const phoneDigits = String(pv?.dest_telefone || "").replace(/\D/g, "");
      const phoneMissing = phoneDigits.length < 10;
      const emailMissing = !pv?.dest_email;
      const orderId = pv?.order_id || args.orderId;
      if (pv && orderId && (phoneMissing || emailMissing)) {
        const orderRes = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=customer_phone,customer_email`,
          { headers },
        );
        const orderRows = await orderRes.json().catch(() => []);
        const order = Array.isArray(orderRows) ? orderRows[0] : null;
        const patch: Record<string, unknown> = {};
        if (phoneMissing) {
          const od = String(order?.customer_phone || "").replace(/\D/g, "");
          if (od.length >= 10) patch.dest_telefone = od.slice(0, 13);
        }
        if (emailMissing && order?.customer_email) {
          patch.dest_email = order.customer_email;
        }
        if (Object.keys(patch).length > 0) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/fiscal_invoices?id=eq.${args.fiscalInvoiceId}`,
            { method: "PATCH", headers, body: JSON.stringify(patch) },
          );
        }
      }
    } catch (_) { /* auto-cura é best-effort; segue para o emissor */ }

    const url = `${SUPABASE_URL}/functions/v1/correios-content-declaration-issue`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "apikey": SERVICE_ROLE,
      },
      body: JSON.stringify({
        tenant_id: args.tenantId,
        fiscal_invoice_id: args.fiscalInvoiceId,
        order_id: args.orderId ?? null,
        source: "auto",
        reason: "Venda/remessa",
        responsibility_acknowledged: true,
      }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.success) {
      return {
        ok: false,
        reason: data?.error || `HTTP ${res.status}`,
        code: data?.code,
      };
    }
    return {
      ok: true,
      alreadyExisted: !!data.already_existed,
      declarationId: data.declaration?.id,
      dcNumber: data.declaration?.dc_number,
    };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "ensure_dc_unknown_error" };
  }
}
