// =============================================
// CENTRAL DE ADAPTADORES DE PLATAFORMA
// =============================================

import type {
  PlatformType,
  NormalizedProduct,
  NormalizedCategory,
  NormalizedCustomer,
  NormalizedOrder,
  NormalizedCoupon,
} from '../types';

import {
  normalizeShopifyProduct,
  normalizeShopifyCustomer,
  normalizeShopifyOrder,
  SHOPIFY_FIELD_MAPPING,
} from './shopify';

import {
  normalizeNuvemshopProduct,
  normalizeNuvemshopCategory,
  normalizeNuvemshopCustomer,
  normalizeNuvemshopOrder,
  NUVEMSHOP_FIELD_MAPPING,
} from './nuvemshop';

// Tipo do adaptador
export interface PlatformAdapter {
  normalizeProduct: (raw: any) => NormalizedProduct;
  normalizeCategory?: (raw: any) => NormalizedCategory;
  normalizeCustomer: (raw: any) => NormalizedCustomer;
  normalizeOrder: (raw: any) => NormalizedOrder;
  normalizeCoupon?: (raw: any) => NormalizedCoupon;
  fieldMapping: {
    products: Record<string, string>;
    customers: Record<string, string>;
    orders: Record<string, string>;
    categories?: Record<string, string>;
  };
}

// Adaptadores por plataforma
const adapters: Partial<Record<PlatformType, PlatformAdapter>> = {
  shopify: {
    normalizeProduct: normalizeShopifyProduct,
    normalizeCustomer: normalizeShopifyCustomer,
    normalizeOrder: normalizeShopifyOrder,
    fieldMapping: SHOPIFY_FIELD_MAPPING,
  },
  nuvemshop: {
    normalizeProduct: normalizeNuvemshopProduct,
    normalizeCategory: normalizeNuvemshopCategory,
    normalizeCustomer: normalizeNuvemshopCustomer,
    normalizeOrder: normalizeNuvemshopOrder,
    fieldMapping: NUVEMSHOP_FIELD_MAPPING,
  },
};

// Obter adaptador por plataforma
export function getAdapter(platform: PlatformType): PlatformAdapter | null {
  return adapters[platform] || null;
}

// Normalizar dados automaticamente baseado na plataforma
export function normalizeData<T extends 'product' | 'category' | 'customer' | 'order'>(
  platform: PlatformType,
  type: T,
  rawData: any[]
): T extends 'product' ? NormalizedProduct[] :
   T extends 'category' ? NormalizedCategory[] :
   T extends 'customer' ? NormalizedCustomer[] :
   T extends 'order' ? NormalizedOrder[] :
   never {
  
  const adapter = getAdapter(platform);
  if (!adapter) {
    console.warn(`No adapter found for platform: ${platform}, using generic normalization`);
    return rawData as any;
  }
  
  const results: any[] = [];
  
  for (const item of rawData) {
    try {
      let normalized: any;
      
      switch (type) {
        case 'product':
          normalized = adapter.normalizeProduct(item);
          break;
        case 'category':
          normalized = adapter.normalizeCategory?.(item) || genericNormalizeCategory(item);
          break;
        case 'customer':
          normalized = adapter.normalizeCustomer(item);
          break;
        case 'order':
          normalized = adapter.normalizeOrder(item);
          break;
      }
      
      if (normalized) {
        results.push(normalized);
      }
    } catch (error) {
      console.error(`Error normalizing ${type}:`, error, item);
    }
  }
  
  return results as any;
}

// Obter mapeamento de campos para exibição
export function getFieldMapping(
  platform: PlatformType,
  type: 'products' | 'customers' | 'orders' | 'categories'
): Record<string, string> {
  const adapter = getAdapter(platform);
  if (!adapter) return {};
  
  if (type === 'categories') {
    return adapter.fieldMapping.categories || {};
  }
  
  return adapter.fieldMapping[type] || {};
}

// Obter todas as plataformas suportadas
export function getSupportedPlatforms(): { id: PlatformType; name: string; logo?: string }[] {
  return [
    { id: 'shopify', name: 'Shopify', logo: '🟢' },
    { id: 'nuvemshop', name: 'Nuvemshop / Tiendanube', logo: '☁️' },
    { id: 'tray', name: 'Tray', logo: '🔵' },
    { id: 'vtex', name: 'VTEX', logo: '🔴' },
    { id: 'woocommerce', name: 'WooCommerce', logo: '🟣' },
    { id: 'loja_integrada', name: 'Loja Integrada', logo: '🟠' },
    { id: 'magento', name: 'Magento / Adobe Commerce', logo: '🟤' },
    { id: 'opencart', name: 'OpenCart', logo: '🔷' },
    { id: 'prestashop', name: 'PrestaShop', logo: '💜' },
  ];
}

// Normalização genérica para categorias (fallback)
function genericNormalizeCategory(raw: any): NormalizedCategory {
  const name = raw.name || raw.Nome || raw.title || raw.Title || 'Categoria';
  
  return {
    name,
    slug: slugify(raw.slug || raw.handle || raw.URL || name),
    description: raw.description || raw.Descrição || null,
    image_url: raw.image_url || raw.image || raw.Imagem || null,
    banner_desktop_url: null,
    banner_mobile_url: null,
    parent_slug: raw.parent_slug || raw.parent || raw['Categoria pai'] || null,
    seo_title: raw.seo_title || raw['Título SEO'] || null,
    seo_description: raw.seo_description || raw['Descrição SEO'] || null,
    sort_order: parseInt(raw.sort_order || raw.position || '0', 10),
    is_active: raw.is_active !== false && raw.Ativa !== 'Não',
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Re-exportar funções individuais (não re-exportar types para evitar conflitos)
export {
  normalizeShopifyProduct,
  normalizeShopifyCustomer,
  normalizeShopifyOrder,
  SHOPIFY_FIELD_MAPPING,
} from './shopify';

export {
  normalizeNuvemshopProduct,
  normalizeNuvemshopCategory,
  normalizeNuvemshopCustomer,
  normalizeNuvemshopOrder,
  NUVEMSHOP_FIELD_MAPPING,
} from './nuvemshop';
