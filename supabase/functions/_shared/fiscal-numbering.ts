// ============================================================
// FISCAL NUMBERING — sequências independentes por classe
// Doc class:
//   - 'pedido_venda' (Pedido de Venda) -> cursor fiscal_settings.numero_pedido_atual
//   - 'nf'           (Nota Fiscal)     -> cursor fiscal_settings.numero_nfe_atual
// Regra: monotônica — número excluído NÃO é reaproveitado (o cursor só avança).
// ============================================================

export type FiscalDocClass = 'pedido_venda' | 'nf';

function cursorColumnFor(docClass: FiscalDocClass): 'numero_pedido_atual' | 'numero_nfe_atual' {
  return docClass === 'pedido_venda' ? 'numero_pedido_atual' : 'numero_nfe_atual';
}

async function maxNumberFor(
  supabase: any,
  tenantId: string,
  serie: number,
  docClass: FiscalDocClass,
): Promise<number> {
  let q = supabase
    .from('fiscal_invoices')
    .select('numero')
    .eq('tenant_id', tenantId)
    .eq('serie', serie)
    .order('numero', { ascending: false })
    .limit(1);

  if (docClass === 'pedido_venda') {
    q = q.eq('fiscal_stage', 'pedido_venda');
  } else {
    q = q.neq('fiscal_stage', 'pedido_venda');
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return Number(data?.numero || 0);
}

export async function getNextFiscalNumber(params: {
  supabase: any;
  tenantId: string;
  serie: number;
  fallbackNumeroAtual?: number | null;
  docClass?: FiscalDocClass;
}): Promise<number> {
  const { supabase, tenantId, serie, fallbackNumeroAtual } = params;
  const docClass: FiscalDocClass = params.docClass || 'nf';

  const maxNumero = await maxNumberFor(supabase, tenantId, serie, docClass);
  const fallback = Math.max(1, Number(fallbackNumeroAtual || 1));
  return Math.max(maxNumero + 1, fallback);
}

export async function insertFiscalInvoiceWithRetry(params: {
  supabase: any;
  tenantId: string;
  serie: number;
  initialNumber: number;
  buildDraftData: (numero: number) => Record<string, unknown>;
  logPrefix: string;
  maxAttempts?: number;
  docClass?: FiscalDocClass;
}): Promise<{ invoice: any; numero: number }> {
  const {
    supabase,
    tenantId,
    serie,
    initialNumber,
    buildDraftData,
    logPrefix,
    maxAttempts = 20,
  } = params;
  const docClass: FiscalDocClass = params.docClass || 'nf';

  let numero = Math.max(1, initialNumber);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from('fiscal_invoices')
      .insert(buildDraftData(numero))
      .select()
      .single();

    if (!error && data) {
      return { invoice: data, numero };
    }

    const msg = String(error?.message || '');
    const isDuplicateNumber =
      error?.code === '23505' &&
      (msg.includes('fiscal_invoices_numero_unique') ||
        msg.includes('fiscal_invoices_numero_pedido_unique') ||
        msg.includes('fiscal_invoices_numero_nf_unique') ||
        msg.includes('(tenant_id, serie, numero)'));

    const isDuplicateOrder =
      error?.code === '23505' && msg.includes('idx_fiscal_invoices_order_unique');

    if (isDuplicateOrder) {
      console.log(`[${logPrefix}] Invoice já existe para esse pedido (unique index). Pulando.`);
      const draftData = buildDraftData(numero);
      const { data: existing } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('order_id', draftData.order_id)
        .not('status', 'in', '(cancelled,rejected)')
        .limit(1)
        .maybeSingle();
      if (existing) {
        return { invoice: existing, numero: existing.numero };
      }
      throw new Error(`[${logPrefix}] Duplicate order detected mas não conseguiu buscar a NF existente.`);
    }

    if (!isDuplicateNumber) {
      throw error;
    }

    console.warn(
      `[${logPrefix}] Número ${numero} já utilizado (${docClass}) para tenant=${tenantId}, série=${serie} (tentativa ${attempt}/${maxAttempts}).`
    );
    numero += 1;
  }

  throw new Error(
    `[${logPrefix}] Não foi possível reservar número fiscal após ${maxAttempts} tentativas.`
  );
}

export async function syncFiscalNumberCursor(params: {
  supabase: any;
  tenantId: string;
  serie: number;
  currentCursor?: number | null;
  logPrefix: string;
  docClass?: FiscalDocClass;
}): Promise<number> {
  const { supabase, tenantId, serie, currentCursor, logPrefix } = params;
  const docClass: FiscalDocClass = params.docClass || 'nf';
  const column = cursorColumnFor(docClass);

  const nextCursor = await getNextFiscalNumber({
    supabase,
    tenantId,
    serie,
    fallbackNumeroAtual: currentCursor,
    docClass,
  });

  const { error } = await supabase
    .from('fiscal_settings')
    .update({ [column]: nextCursor })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error(`[${logPrefix}] Falha ao sincronizar ${column}:`, error);
  }

  return nextCursor;
}
