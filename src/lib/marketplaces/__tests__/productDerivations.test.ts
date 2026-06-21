import { describe, it, expect } from 'vitest';
import { deriveProductAttributes, gramsToKg } from '../productDerivations';

describe('deriveProductAttributes', () => {
  it('produto simples sem composição', () => {
    const d = deriveProductAttributes({
      id: 'p1',
      product_format: 'simple',
      weight: 250,
      net_content_value: 200,
      net_content_unit: 'ml',
      regulatory_regime: 'anvisa_cosmetico',
    });
    expect(d.is_kit).toBe(false);
    expect(d.units_per_package).toBe(1);
    expect(d.net_weight_g).toBe(250);
    expect(d.total_net_content).toEqual({ value: 200, unit: 'ml' });
    expect(d.condition).toBe('new');
    expect(d.regulatory_regime).toBe('anvisa_cosmetico');
    expect(d.source.weight).toBe('product');
    expect(d.source.regime).toBe('product');
  });

  it('kit soma unidades e peso da composição', () => {
    const d = deriveProductAttributes(
      { id: 'k1', product_format: 'with_composition', weight: null },
      [
        { component_product_id: 'a', quantity: 2, component: { weight: 100 } },
        { component_product_id: 'b', quantity: 1, component: { weight: 50 } },
      ],
    );
    expect(d.is_kit).toBe(true);
    expect(d.units_per_package).toBe(3);
    expect(d.net_weight_g).toBe(250);
    expect(d.source.weight).toBe('sum_components');
  });

  it('regime regulatório vem da categoria universal quando produto não tem', () => {
    const d = deriveProductAttributes(
      { id: 'p2', product_format: 'simple' },
      [],
      { id: 'c1', regulatory_regime: 'inmetro' },
    );
    expect(d.regulatory_regime).toBe('inmetro');
    expect(d.source.regime).toBe('category');
  });

  it('garantia em meses gera texto legível', () => {
    const d = deriveProductAttributes({
      id: 'p3',
      product_format: 'simple',
      warranty_months: 12,
    });
    expect(d.warranty_text).toBe('12 meses de garantia');
  });

  it('conteúdo líquido total só agrega se unidades baterem', () => {
    const d = deriveProductAttributes(
      { id: 'k2', product_format: 'with_composition' },
      [
        { component_product_id: 'a', quantity: 2, component: { net_content_value: 100, net_content_unit: 'ml' } },
        { component_product_id: 'b', quantity: 1, component: { net_content_value: 50, net_content_unit: 'g' } },
      ],
    );
    expect(d.total_net_content).toBeNull();
  });
});

describe('gramsToKg', () => {
  it('converte gramas para kg com 3 casas', () => {
    expect(gramsToKg(1500)).toBe(1.5);
    expect(gramsToKg(250)).toBe(0.25);
    expect(gramsToKg(null)).toBeNull();
  });
});
