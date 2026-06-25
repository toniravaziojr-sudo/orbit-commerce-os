/**
 * Frontend mirror of the server-side readiness check.
 * Kept in sync with supabase/functions/_shared/product-context-loader.ts
 * (evaluateImageContextReadiness).
 *
 * Reads the product registry and reports which fields the AI image engine
 * needs for a high-quality, faithful image. Warning-only — never blocks.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ImageContextReadinessResult {
  severity: 'ok' | 'warning';
  missing: string[];
}

function has(v: any): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.filter(Boolean).length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

export async function fetchImageContextReadiness(
  tenantId: string,
  productId: string,
): Promise<ImageContextReadinessResult> {
  const [{ data: p }, { data: c }, { data: comps }] = await Promise.all([
    supabase
      .from('products')
      .select(
        'brand, product_type, ai_product_type, short_description, description, gender_audience, net_content_value, net_content_unit, product_format, name, regulatory_regime, recommended_hair_types, expected_effects, regulatory_info',
      )
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('ai_product_commercial_payload')
      .select('differentials, short_pitch, when_to_recommend, target_audience')
      .eq('product_id', productId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('product_components')
      .select('id')
      .eq('parent_product_id', productId),
  ]);

  const missing: string[] = [];
  const prod: any = p || {};
  const comm: any = c || {};

  if (!has(prod.brand)) missing.push('Marca');
  if (!has(prod.product_type) && !has(prod.ai_product_type)) missing.push('Tipo de produto');
  if (!has(prod.short_description) && !has(prod.description)) missing.push('Descrição');
  if (!has(comm.differentials) && !has(comm.short_pitch) && !has(comm.when_to_recommend)) {
    missing.push('Benefícios / quando recomendar');
  }
  if (!has(prod.gender_audience) && !has(comm.target_audience)) missing.push('Público-alvo');
  if (!has(prod.net_content_value) || !has(prod.net_content_unit)) missing.push('Conteúdo líquido');

  const isKit = prod.product_format === 'kit' || /\bkit\b/i.test(String(prod.name || ''));
  if (isKit && (!comps || comps.length === 0)) missing.push('Composição do kit');

  const isCosmetic =
    String(prod.regulatory_regime || '').toLowerCase().includes('cosm') ||
    /shampoo|condicion|cabel|cosm/i.test(String(prod.product_type || ''));
  if (isCosmetic && !has(prod.recommended_hair_types) && !has(prod.expected_effects)) {
    missing.push('Características capilares (tipos de cabelo / efeitos)');
  }
  if (isCosmetic && !has(prod.regulatory_info)) missing.push('Registro regulatório (ANVISA)');

  return { severity: missing.length ? 'warning' : 'ok', missing };
}
