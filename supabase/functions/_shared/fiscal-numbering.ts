export async function getNextFiscalNumber(params: {
  supabase: any;
  tenantId: string;
  serie: number;
  fallbackNumeroAtual?: number | null;
}): Promise<number> {
  const { supabase, tenantId, serie, fallbackNumeroAtual } = params;

  const { data, error } = await supabase
    .from('fiscal_invoices')
    .select('numero')
    .eq('tenant_id', tenantId)
    .eq('serie', serie)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const maxNumero = Number(data?.numero || 0);
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

    const isDuplicateNumber =
      error?.code === '23505' &&
      (String(error?.message || '').includes('fiscal_invoices_numero_unique') ||
        String(error?.message || '').includes('(tenant_id, serie, numero)'));

    if (!isDuplicateNumber) {
      throw error;
    }

    console.warn(
      `[${logPrefix}] Número ${numero} já utilizado para tenant=${tenantId}, série=${serie} (tentativa ${attempt}/${maxAttempts}).`
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
}): Promise<number> {
  const { supabase, tenantId, serie, currentCursor, logPrefix } = params;

  const nextCursor = await getNextFiscalNumber({
    supabase,
    tenantId,
    serie,
    fallbackNumeroAtual: currentCursor,
  });

  const { error } = await supabase
    .from('fiscal_settings')
    .update({ numero_nfe_atual: nextCursor })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error(`[${logPrefix}] Falha ao sincronizar numero_nfe_atual:`, error);
  }

  return nextCursor;
}
