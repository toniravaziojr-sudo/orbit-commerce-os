// =====================================================================
// FISCAL TAX CALCULATOR — Helper compartilhado
// Calcula PIS, COFINS e ICMS por item conforme o regime tributário
// configurado em fiscal_settings, com possibilidade de override por produto
// via fiscal_products.
//
// Regras:
//   - Simples Nacional: PIS/COFINS/ICMS zerados; usa CSOSN (não CST).
//     A tributação real é apurada via DAS, fora da NF-e.
//   - Lucro Presumido / Lucro Real: aplica alíquotas (% sobre o valor do item),
//     usa CST. Base de cálculo = valor_total do item (sem desconto).
//
// Precedência das alíquotas: fiscal_products (override) → fiscal_settings (padrão).
//
// Fonte de verdade: docs/especificacoes/erp/erp-fiscal.md
// =====================================================================

export type RegimeTributario = 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei';

export interface FiscalSettingsTax {
  regime_tributario: RegimeTributario;
  pis_aliquota_padrao: number;
  cofins_aliquota_padrao: number;
  icms_aliquota_padrao: number;
  pis_cst_padrao: string;
  cofins_cst_padrao: string;
  cst_padrao?: string | null;       // ICMS CST (para regime normal)
  csosn_padrao?: string | null;     // CSOSN (para Simples Nacional)
}

export interface ProductFiscalOverride {
  pis_aliquota?: number | null;
  cofins_aliquota?: number | null;
  icms_aliquota?: number | null;
  pis_cst?: string | null;
  cofins_cst?: string | null;
  cst_override?: string | null;
  csosn_override?: string | null;
}

export interface CalculatedTaxes {
  icms_base: number;
  icms_aliquota: number;
  icms_valor: number;
  pis_cst: string;
  pis_base: number;
  pis_aliquota: number;
  pis_valor: number;
  cofins_cst: string;
  cofins_base: number;
  cofins_aliquota: number;
  cofins_valor: number;
  cst: string | null;     // ICMS CST (regime normal)
  csosn: string | null;   // CSOSN (Simples)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula impostos do item.
 * @param valorTotalItem Valor total do item (qty × unit_price, sem desconto)
 * @param settings Configuração fiscal do tenant
 * @param override Override fiscal por produto (opcional)
 * @param natureTax Códigos tributários vindos da Natureza de Operação resolvida
 *                  pelo CRT do emitente. Precedência: produto → natureza → settings.
 */
export function calculateItemTaxes(
  valorTotalItem: number,
  settings: FiscalSettingsTax,
  override?: ProductFiscalOverride | null,
  natureTax?: { csosn?: string | null; cst_icms?: string | null } | null,
): CalculatedTaxes {
  const base = Number(valorTotalItem) || 0;

  // Simples Nacional e MEI → zerado, usa CSOSN
  if (settings.regime_tributario === 'simples_nacional' || settings.regime_tributario === 'mei') {
    return {
      icms_base: 0,
      icms_aliquota: 0,
      icms_valor: 0,
      pis_cst: '49',
      pis_base: 0,
      pis_aliquota: 0,
      pis_valor: 0,
      cofins_cst: '49',
      cofins_base: 0,
      cofins_aliquota: 0,
      cofins_valor: 0,
      cst: null,
      csosn: override?.csosn_override || natureTax?.csosn || settings.csosn_padrao || '102',
    };
  }

  // Regime Normal (Lucro Presumido / Real) → aplica alíquotas, usa CST
  const pisAliq = Number(override?.pis_aliquota ?? settings.pis_aliquota_padrao) || 0;
  const cofinsAliq = Number(override?.cofins_aliquota ?? settings.cofins_aliquota_padrao) || 0;
  const icmsAliq = Number(override?.icms_aliquota ?? settings.icms_aliquota_padrao) || 0;

  return {
    icms_base: base,
    icms_aliquota: icmsAliq,
    icms_valor: round2(base * icmsAliq / 100),
    pis_cst: override?.pis_cst || settings.pis_cst_padrao || '01',
    pis_base: base,
    pis_aliquota: pisAliq,
    pis_valor: round2(base * pisAliq / 100),
    cofins_cst: override?.cofins_cst || settings.cofins_cst_padrao || '01',
    cofins_base: base,
    cofins_aliquota: cofinsAliq,
    cofins_valor: round2(base * cofinsAliq / 100),
    cst: override?.cst_override || natureTax?.cst_icms || settings.cst_padrao || '00',
    csosn: null,
  };
}
