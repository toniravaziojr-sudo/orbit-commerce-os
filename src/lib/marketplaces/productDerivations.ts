// =============================================
// PRODUCT DERIVATIONS — Etapa 4 do plano de classificação universal
// Cálculos puros derivados do cadastro do produto + composição + categoria universal.
// Sem chamadas de banco aqui — receba os dados e devolva o que está derivado.
// Será consumido pelo dialog de envio ao Mercado Livre (Etapa 5) e demais marketplaces.
// =============================================

export interface DerivationProductInput {
  id: string;
  name?: string | null;
  sku?: string | null;
  gtin?: string | null;
  brand?: string | null;
  weight?: number | null;              // gramas (padrão do sistema)
  width?: number | null;
  height?: number | null;
  length?: number | null;
  warranty?: string | null;
  warranty_months?: number | null;
  condition?: string | null;
  product_format?: string | null;      // 'simple' | 'with_composition' | ...
  regulatory_regime?: string | null;
  universal_category_id?: string | null;
  net_content_value?: number | null;
  net_content_unit?: string | null;
  gender_audience?: string | null;
}

export interface DerivationComponentInput {
  component_product_id: string;
  quantity: number;
  component?: {
    weight?: number | null;
    net_content_value?: number | null;
    net_content_unit?: string | null;
  } | null;
}

export interface DerivationCategoryInput {
  id: string;
  regulatory_regime?: string | null;
}

export interface ProductDerivations {
  is_kit: boolean;
  units_per_package: number;
  net_weight_g: number | null;
  total_net_content: { value: number; unit: string } | null;
  condition: 'new' | 'used' | 'refurbished';
  warranty_text: string | null;
  regulatory_regime: string | null;
  gender_audience: string | null;
  source: {
    weight: 'product' | 'sum_components' | 'missing';
    units: 'product' | 'sum_components';
    regime: 'product' | 'category' | 'missing';
  };
}

/**
 * Calcula todas as derivações automáticas para um produto.
 * Pura, sem efeitos colaterais — segura para usar em dialog, edge function ou teste.
 */
export function deriveProductAttributes(
  product: DerivationProductInput,
  components: DerivationComponentInput[] = [],
  category?: DerivationCategoryInput | null,
): ProductDerivations {
  const hasComposition =
    product.product_format === 'with_composition' && components.length > 0;

  // is_kit
  const is_kit = hasComposition;

  // units_per_package — soma das quantidades da composição, ou 1
  const units_per_package = hasComposition
    ? components.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0) || 1
    : 1;

  // net_weight (gramas) — cadastro tem prioridade, fallback soma da composição
  let net_weight_g: number | null = null;
  let weightSource: ProductDerivations['source']['weight'] = 'missing';
  if (product.weight != null && Number(product.weight) > 0) {
    net_weight_g = Number(product.weight);
    weightSource = 'product';
  } else if (hasComposition) {
    const sum = components.reduce((s, c) => {
      const w = Number(c.component?.weight) || 0;
      return s + w * (Number(c.quantity) || 0);
    }, 0);
    if (sum > 0) {
      net_weight_g = sum;
      weightSource = 'sum_components';
    }
  }

  // conteúdo líquido total — só agrega se todas as unidades baterem
  let total_net_content: ProductDerivations['total_net_content'] = null;
  if (product.net_content_value != null && product.net_content_unit) {
    total_net_content = {
      value: Number(product.net_content_value),
      unit: product.net_content_unit,
    };
  } else if (hasComposition) {
    const units = components
      .map((c) => c.component?.net_content_unit)
      .filter(Boolean) as string[];
    const allSame = units.length === components.length && units.every((u) => u === units[0]);
    if (allSame && units.length > 0) {
      const total = components.reduce((s, c) => {
        const v = Number(c.component?.net_content_value) || 0;
        return s + v * (Number(c.quantity) || 0);
      }, 0);
      if (total > 0) total_net_content = { value: total, unit: units[0] };
    }
  }

  // condição — padrão 'new'
  const condition = (['new', 'used', 'refurbished'].includes(product.condition ?? '')
    ? product.condition
    : 'new') as ProductDerivations['condition'];

  // garantia — texto livre ou meses
  let warranty_text: string | null = null;
  if (product.warranty && product.warranty.trim()) {
    warranty_text = product.warranty.trim();
  } else if (product.warranty_months && product.warranty_months > 0) {
    const m = product.warranty_months;
    warranty_text = m === 1 ? '1 mês de garantia' : `${m} meses de garantia`;
  }

  // regime regulatório — produto tem prioridade, fallback categoria universal
  let regulatory_regime: string | null = null;
  let regimeSource: ProductDerivations['source']['regime'] = 'missing';
  if (product.regulatory_regime) {
    regulatory_regime = product.regulatory_regime;
    regimeSource = 'product';
  } else if (category?.regulatory_regime) {
    regulatory_regime = category.regulatory_regime;
    regimeSource = 'category';
  }

  return {
    is_kit,
    units_per_package,
    net_weight_g,
    total_net_content,
    condition,
    warranty_text,
    regulatory_regime,
    gender_audience: product.gender_audience ?? null,
    source: {
      weight: weightSource,
      units: hasComposition ? 'sum_components' : 'product',
      regime: regimeSource,
    },
  };
}

/**
 * Converte gramas para kg (formato esperado por adapters de frete e ML).
 */
export function gramsToKg(grams: number | null): number | null {
  if (grams == null || !Number.isFinite(grams)) return null;
  return Math.round((grams / 1000) * 1000) / 1000;
}
