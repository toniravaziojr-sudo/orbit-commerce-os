/**
 * Product Context Loader
 *
 * Single source of truth for "full product context" used by AI image
 * generation. Loads the product row (all 75 columns), its commercial
 * payload, kit components, pain points and manual attribute memory, then
 * builds a structured Portuguese briefing for the visual engine.
 *
 * One read per related table per generation — no extra LLM calls.
 */

export interface ProductContext {
  product: Record<string, any> | null;
  commercial: Record<string, any> | null;
  components: Array<{ name: string | null; quantity: number | null }>;
  painPoints: Array<{ pain_point: string; weight: number | null }>;
  manualMemory: Array<{ attribute_name: string | null; value_name: string | null }>;
  tenantBrand: string | null;
  universalCategoryName: string | null;
}

export async function loadProductContext(
  supabase: any,
  tenantId: string,
  productId: string,
): Promise<ProductContext> {
  const [productRes, commercialRes, componentsRes, painsRes, memoryRes, tenantRes] =
    await Promise.all([
      supabase.from('products').select('*').eq('id', productId).eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('ai_product_commercial_payload')
        .select('*')
        .eq('product_id', productId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('product_components')
        .select('quantity, component_product_id, products:component_product_id(name)')
        .eq('parent_product_id', productId),
      supabase
        .from('product_pain_points')
        .select('pain_point, weight')
        .eq('product_id', productId)
        .eq('tenant_id', tenantId),
      supabase
        .from('meli_product_attribute_memory')
        .select('attribute_name, value_name')
        .eq('product_id', productId)
        .eq('tenant_id', tenantId),
      supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
    ]);

  const product = productRes?.data || null;
  const components = (componentsRes?.data || []).map((c: any) => ({
    name: c?.products?.name ?? null,
    quantity: c?.quantity ?? null,
  }));

  let universalCategoryName: string | null = null;
  if (product?.universal_category_id) {
    const { data: cat } = await supabase
      .from('system_universal_categories')
      .select('name')
      .eq('id', product.universal_category_id)
      .maybeSingle();
    universalCategoryName = cat?.name || null;
  }

  return {
    product,
    commercial: commercialRes?.data || null,
    components,
    painPoints: painsRes?.data || [],
    manualMemory: memoryRes?.data || [],
    tenantBrand: tenantRes?.data?.name || null,
    universalCategoryName,
  };
}

// ---------- helpers ----------

function fmt(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return ''; }
  }
  return String(v).trim();
}

function line(label: string, value: any): string | null {
  const s = fmt(value);
  return s ? `- ${label}: ${s}` : null;
}

function block(title: string, lines: Array<string | null>): string | null {
  const kept = lines.filter((l): l is string => !!l);
  if (!kept.length) return null;
  return `${title}\n${kept.join('\n')}`;
}

/**
 * Builds the structured product briefing in pt-BR consumed by the image
 * prompt. Empty sections are omitted. No invented content — only fields
 * present in the product registry are surfaced.
 */
export function buildProductBriefing(ctx: ProductContext): string {
  const p = ctx.product || {};
  const c = ctx.commercial || {};

  const identity = block('🧾 IDENTIDADE', [
    line('Nome', p.name),
    line('Marca da loja', ctx.tenantBrand),
    line('Marca do produto', p.brand),
    line('Linha', p.line),
    line('Modelo', p.model),
    line('SKU', p.sku),
    line('GTIN/Código de barras', p.gtin || p.barcode),
    line('Tipo de produto', p.product_type || p.ai_product_type),
    line('Formato', p.product_format),
    line('Categoria', ctx.universalCategoryName),
    line('Função principal', p.ai_main_function),
  ]);

  const technical = block('📐 FICHA TÉCNICA', [
    line('Peso (g)', p.weight),
    line('Dimensões (LxAxP cm)', [p.width, p.height, p.depth].filter(Boolean).join(' x ')),
    line('Conteúdo líquido', p.net_content_value && p.net_content_unit
      ? `${p.net_content_value} ${p.net_content_unit}` : null),
    line('Unidade de medida', p.uom),
  ]);

  const cosmetic = block('🧴 ATRIBUTOS COSMÉTICOS', [
    line('Dermatologicamente testado', p.dermatologically_tested),
    line('Hipoalergênico', p.hypoallergenic),
    line('Cruelty-free', p.cruelty_free),
    line('Vegano', p.vegan),
    line('Com fragrância', p.has_fragrance),
    line('Nome da fragrância', p.fragrance_name),
    line('Tipos de cabelo recomendados', p.recommended_hair_types),
    line('Tipos de tratamento', p.treatment_types),
    line('Efeitos esperados', p.expected_effects),
  ]);

  const regulatory = block('📋 REGULATÓRIO', [
    line('Regime', p.regulatory_regime),
    line('Categoria regulatória', p.regulatory_category),
    line('Registros (ANVISA/AFE/etc.)', p.regulatory_info),
    line('Restrições comerciais', p.commercial_restrictions),
  ]);

  const audience = block('🎯 PÚBLICO / GARANTIA', [
    line('Gênero/audiência', p.gender_audience),
    line('Garantia', [p.warranty_type, p.warranty_duration].filter(Boolean).join(' ')),
  ]);

  const descriptions = block('📝 DESCRIÇÕES (literais do cadastro)', [
    line('Descrição curta', p.short_description),
    line('Descrição completa', p.description),
    line('Palavras-chave', p.meta_keywords || p.tags),
  ]);

  const commercialBlock = block('🧠 VISÃO IA (curadoria comercial)', [
    line('Papel comercial', c.commercial_role || c.product_kind),
    line('Pitch curto', c.short_pitch),
    line('Pitch médio', c.medium_pitch),
    line('Diferenciais', c.differentials),
    line('Quando recomendar', c.when_to_recommend),
    line('Quando NÃO indicar', c.when_not_to_indicate),
    line('Público-alvo (IA)', c.target_audience),
    line('Notas de recomendação', c.recommendation_notes),
    line('Argumentos de comparação', c.comparison_arguments),
    line('Prova social', c.social_proof_snippet),
  ]);

  const kit = ctx.components.length
    ? block('📦 COMPOSIÇÃO DO KIT (itens reais — usar EXATAMENTE estes na cena)',
        ctx.components.map((it, i) => line(`Item ${i + 1}`,
          it.quantity && it.quantity > 1 ? `${it.quantity}x ${it.name || '—'}` : (it.name || '—'))))
    : null;

  const pains = ctx.painPoints.length
    ? block('💢 DORES QUE O PRODUTO RESOLVE',
        ctx.painPoints.map((pp) => line('Dor', pp.pain_point)))
    : null;

  const memory = ctx.manualMemory.length
    ? block('🧷 AJUSTES MANUAIS PREVIAMENTE APROVADOS (prioridade máxima)',
        ctx.manualMemory.map((m) => line(m.attribute_name || 'Ajuste', m.value_name)))
    : null;

  const restrictions = block('🚫 RESTRIÇÕES OBRIGATÓRIAS', [
    '- NÃO invente texto no rótulo, embalagem ou selos. Use apenas o que está acima.',
    '- NÃO crie benefícios, certificações ou ingredientes que não constem do cadastro.',
    p.product_format === 'kit' || ctx.components.length > 1
      ? '- Cena deve mostrar EXATAMENTE os itens listados na composição do kit.'
      : '- Produto único: mostrar 1 unidade do produto na cena.',
    p.gender_audience ? `- Cena coerente com o público: ${fmt(p.gender_audience)}.` : null,
  ]);

  return [identity, technical, cosmetic, regulatory, audience, descriptions, commercialBlock, kit, pains, memory, restrictions]
    .filter((b): b is string => !!b)
    .join('\n\n');
}

// ---------- readiness ----------

export interface ImageContextReadiness {
  severity: 'ok' | 'warning';
  missing: string[];
}

/**
 * Inspects the same context the briefing uses and reports which
 * registry fields are missing for a high-quality image.
 */
export function evaluateImageContextReadiness(ctx: ProductContext): ImageContextReadiness {
  const p = ctx.product || {};
  const c = ctx.commercial || {};
  const missing: string[] = [];

  if (!fmt(p.brand)) missing.push('Marca');
  if (!fmt(p.product_type || p.ai_product_type)) missing.push('Tipo de produto');
  if (!fmt(p.short_description) && !fmt(p.description)) missing.push('Descrição');

  const hasBenefits = fmt(c.differentials) || fmt(c.short_pitch) || fmt(c.when_to_recommend);
  if (!hasBenefits) missing.push('Benefícios / quando recomendar');

  if (!fmt(p.gender_audience) && !fmt(c.target_audience)) missing.push('Público-alvo');

  if (!fmt(p.net_content_value) || !fmt(p.net_content_unit)) missing.push('Conteúdo líquido');

  if ((p.product_format === 'kit' || /\bkit\b/i.test(String(p.name || ''))) && ctx.components.length === 0) {
    missing.push('Composição do kit');
  }

  const isCosmetic = String(p.regulatory_regime || '').toLowerCase().includes('cosm')
    || String(p.product_type || '').toLowerCase().match(/shampoo|condicion|cabel|cosm/);
  if (isCosmetic && !fmt(p.recommended_hair_types) && !fmt(p.expected_effects)) {
    missing.push('Características capilares (tipos de cabelo / efeitos)');
  }

  if (isCosmetic && !fmt(p.regulatory_info)) missing.push('Registro regulatório (ANVISA)');

  return { severity: missing.length ? 'warning' : 'ok', missing };
}
