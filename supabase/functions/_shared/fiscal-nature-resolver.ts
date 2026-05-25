// =============================================
// FISCAL NATURE RESOLVER (Fase 2)
// Fonte única para CFOP / finalidade / tipo de documento em rascunhos de NF
// e Pedidos de Venda.
//
// Resolução (em ordem):
//   1) natureza_operacao_id explícito (do payload / da nota existente)
//   2) natureza_operacao (nome) explícito — match case-insensitive
//   3) fiscal_settings.default_sales_nature_id (natureza padrão do tenant)
//   4) natureza-sistema "Venda de Mercadoria" (fallback universal)
//   5) null → caller usa defaults rígidos (5102/6102, finalidade=1, tipo=1)
//
// pickCfopForUf: dado a natureza resolvida, devolve o CFOP da UF correta
// (intra se origem === destino, inter caso contrário).
// =============================================

export interface ResolvedFiscalNature {
  id: string;
  nome: string;
  cfop_intra: string;
  cfop_inter: string;
  finalidade: number;       // 1 normal, 4 devolução, etc.
  tipo_documento: number;   // 1 saída, 0 entrada
}

export interface ResolveNatureOpts {
  natureId?: string | null;
  natureNome?: string | null;
  defaultNatureId?: string | null; // ex.: fiscal_settings.default_sales_nature_id
}

const SELECT_NATURE = 'id, nome, cfop_intra, cfop_inter, finalidade, tipo_documento';

export async function resolveOperationNature(
  supabase: any,
  tenantId: string,
  opts: ResolveNatureOpts = {},
): Promise<ResolvedFiscalNature | null> {
  // 1) por id explícito
  if (opts.natureId) {
    const { data } = await supabase
      .from('fiscal_operation_natures')
      .select(SELECT_NATURE)
      .eq('tenant_id', tenantId)
      .eq('id', opts.natureId)
      .maybeSingle();
    if (data) return data as ResolvedFiscalNature;
  }

  // 2) por nome explícito (case-insensitive)
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

  // 3) natureza padrão do tenant
  if (opts.defaultNatureId) {
    const { data } = await supabase
      .from('fiscal_operation_natures')
      .select(SELECT_NATURE)
      .eq('tenant_id', tenantId)
      .eq('id', opts.defaultNatureId)
      .maybeSingle();
    if (data) return data as ResolvedFiscalNature;
  }

  // 4) "Venda de Mercadoria" do catálogo-sistema do tenant
  const { data: fallback } = await supabase
    .from('fiscal_operation_natures')
    .select(SELECT_NATURE)
    .eq('tenant_id', tenantId)
    .eq('is_system', true)
    .eq('nome', 'Venda de Mercadoria')
    .maybeSingle();
  if (fallback) return fallback as ResolvedFiscalNature;

  // 5) sem natureza cadastrada → caller usa hardcoded
  return null;
}

export function pickCfopForUf(
  nature: ResolvedFiscalNature | null,
  originUf: string | null | undefined,
  destUf: string | null | undefined,
): string {
  const isIntra =
    !!originUf && !!destUf && String(originUf).toUpperCase() === String(destUf).toUpperCase();
  if (nature) {
    const cfop = isIntra ? nature.cfop_intra : nature.cfop_inter;
    if (cfop && String(cfop).trim()) return String(cfop).trim();
  }
  return isIntra ? '5102' : '6102';
}
