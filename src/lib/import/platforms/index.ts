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

// Shopify
import {
  normalizeShopifyProduct,
  normalizeShopifyCustomer,
  normalizeShopifyOrder,
  SHOPIFY_FIELD_MAPPING,
} from './shopify';

// Nuvemshop
import {
  normalizeNuvemshopProduct,
  normalizeNuvemshopCategory,
  normalizeNuvemshopCustomer,
  normalizeNuvemshopOrder,
  NUVEMSHOP_FIELD_MAPPING,
} from './nuvemshop';

// Tray
import {
  normalizeTrayProduct,
  normalizeTrayCategory,
  normalizeTrayCustomer,
  normalizeTrayOrder,
  TRAY_FIELD_MAPPING,
} from './tray';

// WooCommerce
import {
  normalizeWooCommerceProduct,
  normalizeWooCommerceCategory,
  normalizeWooCommerceCustomer,
  normalizeWooCommerceOrder,
  WOOCOMMERCE_FIELD_MAPPING,
} from './woocommerce';

// Bagy
import {
  normalizeBagyProduct,
  normalizeBagyCategory,
  normalizeBagyCustomer,
  normalizeBagyOrder,
  BAGY_FIELD_MAPPING,
} from './bagy';

// Yampi
import {
  normalizeYampiProduct,
  normalizeYampiCategory,
  normalizeYampiCustomer,
  normalizeYampiOrder,
  YAMPI_FIELD_MAPPING,
} from './yampi';

// Loja Integrada
import {
  normalizeLojaIntegradaProduct,
  normalizeLojaIntegradaCategory,
  normalizeLojaIntegradaCustomer,
  normalizeLojaIntegradaOrder,
  LOJA_INTEGRADA_FIELD_MAPPING,
} from './loja-integrada';

// Wix
import {
  normalizeWixProduct,
  normalizeWixCategory,
  normalizeWixCustomer,
  normalizeWixOrder,
  WIX_FIELD_MAPPING,
} from './wix';

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
  tray: {
    normalizeProduct: normalizeTrayProduct,
    normalizeCategory: normalizeTrayCategory,
    normalizeCustomer: normalizeTrayCustomer,
    normalizeOrder: normalizeTrayOrder,
    fieldMapping: TRAY_FIELD_MAPPING,
  },
  woocommerce: {
    normalizeProduct: normalizeWooCommerceProduct,
    normalizeCategory: normalizeWooCommerceCategory,
    normalizeCustomer: normalizeWooCommerceCustomer,
    normalizeOrder: normalizeWooCommerceOrder,
    fieldMapping: WOOCOMMERCE_FIELD_MAPPING,
  },
  bagy: {
    normalizeProduct: normalizeBagyProduct,
    normalizeCategory: normalizeBagyCategory,
    normalizeCustomer: normalizeBagyCustomer,
    normalizeOrder: normalizeBagyOrder,
    fieldMapping: BAGY_FIELD_MAPPING,
  },
  yampi: {
    normalizeProduct: normalizeYampiProduct,
    normalizeCategory: normalizeYampiCategory,
    normalizeCustomer: normalizeYampiCustomer,
    normalizeOrder: normalizeYampiOrder,
    fieldMapping: YAMPI_FIELD_MAPPING,
  },
  loja_integrada: {
    normalizeProduct: normalizeLojaIntegradaProduct,
    normalizeCategory: normalizeLojaIntegradaCategory,
    normalizeCustomer: normalizeLojaIntegradaCustomer,
    normalizeOrder: normalizeLojaIntegradaOrder,
    fieldMapping: LOJA_INTEGRADA_FIELD_MAPPING,
  },
  wix: {
    normalizeProduct: normalizeWixProduct,
    normalizeCategory: normalizeWixCategory,
    normalizeCustomer: normalizeWixCustomer,
    normalizeOrder: normalizeWixOrder,
    fieldMapping: WIX_FIELD_MAPPING,
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

// Obter todas as plataformas suportadas para detecção
// Nota: nem todas têm adaptadores de normalização completos
export function getSupportedPlatforms(): { id: PlatformType; name: string; logo?: string; hasAdapter: boolean }[] {
  return [
    { id: 'shopify', name: 'Shopify', logo: '🛒', hasAdapter: true },
    { id: 'nuvemshop', name: 'Nuvemshop', logo: '☁️', hasAdapter: true },
    { id: 'tray', name: 'Tray', logo: '📦', hasAdapter: true },
    { id: 'woocommerce', name: 'WooCommerce', logo: '🔧', hasAdapter: true },
    { id: 'bagy', name: 'Bagy', logo: '🛍️', hasAdapter: true },
    { id: 'yampi', name: 'Yampi', logo: '🎯', hasAdapter: true },
    { id: 'loja_integrada', name: 'Loja Integrada', logo: '🔗', hasAdapter: true },
    { id: 'wix', name: 'Wix', logo: '✨', hasAdapter: true },
    { id: 'vtex', name: 'VTEX', logo: '🏢', hasAdapter: false },
    { id: 'magento', name: 'Magento', logo: '🧲', hasAdapter: false },
    { id: 'opencart', name: 'OpenCart', logo: '🛒', hasAdapter: false },
    { id: 'prestashop', name: 'PrestaShop', logo: '🏪', hasAdapter: false },
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

export {
  normalizeTrayProduct,
  normalizeTrayCategory,
  normalizeTrayCustomer,
  normalizeTrayOrder,
  TRAY_FIELD_MAPPING,
} from './tray';

export {
  normalizeWooCommerceProduct,
  normalizeWooCommerceCategory,
  normalizeWooCommerceCustomer,
  normalizeWooCommerceOrder,
  WOOCOMMERCE_FIELD_MAPPING,
} from './woocommerce';

export {
  normalizeBagyProduct,
  normalizeBagyCategory,
  normalizeBagyCustomer,
  normalizeBagyOrder,
  BAGY_FIELD_MAPPING,
} from './bagy';

export {
  normalizeYampiProduct,
  normalizeYampiCategory,
  normalizeYampiCustomer,
  normalizeYampiOrder,
  YAMPI_FIELD_MAPPING,
} from './yampi';

export {
  normalizeLojaIntegradaProduct,
  normalizeLojaIntegradaCategory,
  normalizeLojaIntegradaCustomer,
  normalizeLojaIntegradaOrder,
  LOJA_INTEGRADA_FIELD_MAPPING,
} from './loja-integrada';

export {
  normalizeWixProduct,
  normalizeWixCategory,
  normalizeWixCustomer,
  normalizeWixOrder,
  WIX_FIELD_MAPPING,
} from './wix';
