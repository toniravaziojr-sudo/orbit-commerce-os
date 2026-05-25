// =============================================
// FISCAL NATURE RESOLVER (v2 — sensível ao CRT do emitente)
// Fonte única para CFOP / CSOSN / CST ICMS / finalidade / tipo de documento
// em rascunhos de NF e Pedidos de Venda.
//
// Resolução da natureza (em ordem):
//   1) natureza_operacao_id explícito (do payload / da nota existente)
//   2) natureza_operacao (nome) explícito — match case-insensitive
//   3) fiscal_settings.default_sales_nature_id (natureza padrão do tenant)
//   4) natureza-sistema "Venda de Mercadoria" (fallback universal)
//   5) null → caller usa defaults rígidos (5102/6102, finalidade=1, tipo=1)
//
// Resolução do par tributário por CRT:
//   - CRT 3 (Lucro Presumido/Real): usa CST ICMS, CSOSN nulo.
//   - CRT 1/2/4 (Simples / MEI):     usa CSOSN, CST ICMS nulo.
//   - Merge: aplica `crt_overrides[crt]` sobre cfop_intra/cfop_inter/csosn/cst_icms
//     quando presente; senão usa o valor base da natureza.
// =============================================

export interface ResolvedFiscalNature {
  id: string;
  nome: string;
  cfop_intra: string;
  cfop_inter: string;
  finalidade: number;
  tipo_documento: number;
  csosn_padrao: string | null;
  cst_icms: string | null;
  regimes_compativeis: number[];
  crt_overrides: Record<string, { cfop_intra?: string | null; cfop_inter?: string | null; csosn?: string | null; cst_icms?: string | null }>;
}

export interface ResolveNatureOpts {
  natureId?: string | null;
  natureNome?: string | null;
  defaultNatureId?: string | null;
}

const SELECT_NATURE =
  'id, nome, cfop_intra, cfop_inter, finalidade, tipo_documento, csosn_padrao, cst_icms, regimes_compativeis, crt_overrides';

export async function resolveOperationNature(
  supabase: any,
  tenantId: string,
  opts: ResolveNatureOpts = {},
): Promise<ResolvedFiscalNature | null> {
  if (opts.natureId) {
    const { data } = await supabase
      .from('fiscal_operation_natures')
      .select(SELECT_NATURE)
      .eq('tenant_id', tenantId)
      .eq('id', opts.natureId)
      .maybeSingle();
    if (data) return data as ResolvedFiscalNature;
  }

  if (opts.natureNome && opts.natureNome.trim()) {
    const { data } = await supabase
      .from('fiscal_operation_natures')
      .select(SELECT_NATURE)
      .eq('tenant_id', tenantId)
      .ilike('nome', opts.natureNome.trim())
      .limit(1)
      .maybeSingle();
    if (data) return data as ResolvedFiscalNature;
  }

  if (opts.defaultNatureId) {
    const { data } = await supabase
      .from('fiscal_operation_natures')
      .select(SELECT_NATURE)
      .eq('tenant_id', tenantId)
      .eq('id', opts.defaultNatureId)
      .maybeSingle();
    if (data) return data as ResolvedFiscalNature;
  }

  const { data: fallback } = await supabase
    .from('fiscal_operation_natures')
    .select(SELECT_NATURE)
    .eq('tenant_id', tenantId)
    .eq('is_system', true)
    .eq('nome', 'Venda de Mercadoria')
    .maybeSingle();
  if (fallback) return fallback as ResolvedFiscalNature;

  return null;
}

export function pickCfopForUf(
  nature: ResolvedFiscalNature | null,
  originUf: string | null | undefined,
  destUf: string | null | undefined,
  crt?: number | null,
): string {
  const isIntra =
    !!originUf && !!destUf && String(originUf).toUpperCase() === String(destUf).toUpperCase();
  if (nature) {
    const ov = crt != null ? nature.crt_overrides?.[String(crt)] : undefined;
    const cfop = isIntra
      ? (ov?.cfop_intra ?? nature.cfop_intra)
      : (ov?.cfop_inter ?? nature.cfop_inter);
    if (cfop && String(cfop).trim()) return String(cfop).trim();
  }
  return isIntra ? '5102' : '6102';
}

/**
 * Devolve {csosn, cst_icms} corretos para o CRT do emitente.
 * - CRT 3 (Presumido/Real): aplica CST ICMS, CSOSN = null.
 * - CRT 1/2/4 (Simples/MEI): aplica CSOSN, CST ICMS = null.
 */
export function pickTaxCodesForCrt(
  nature: ResolvedFiscalNature | null,
  crt: number | null | undefined,
): { csosn: string | null; cst_icms: string | null } {
  if (!nature) return { csosn: null, cst_icms: null };
  const ov = crt != null ? nature.crt_overrides?.[String(crt)] : undefined;
  if (crt === 3) {
    const cst = ov?.cst_icms ?? nature.cst_icms ?? null;
    return { csosn: null, cst_icms: cst };
  }
  const csosn = ov?.csosn ?? nature.csosn_padrao ?? null;
  return { csosn, cst_icms: null };
}

/** Verifica se a natureza é compatível com o CRT do emitente. */
export function isNatureCompatibleWithCrt(
  nature: ResolvedFiscalNature | null,
  crt: number | null | undefined,
): boolean {
  if (!nature) return false;
  if (crt == null) return true;
  const list = nature.regimes_compativeis || [];
  return list.length === 0 || list.includes(Number(crt));
}
