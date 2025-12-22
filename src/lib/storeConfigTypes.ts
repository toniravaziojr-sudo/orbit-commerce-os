// =============================================
// STORE CONFIG TYPES - Typed schemas for store configurations
// =============================================

// Shipping configuration
export interface ShippingRule {
  id: string;
  zipRangeStart: string;
  zipRangeEnd: string;
  minWeight?: number;
  maxWeight?: number;
  minValue?: number;
  maxValue?: number;
  price: number;
  deliveryDays: number;
  label?: string;
}

export interface ShippingConfig {
  provider: 'mock' | 'manual_table' | 'frenet' | 'external' | 'multi';
  originZip: string;
  defaultPrice: number;
  defaultDays: number;
  freeShippingThreshold: number | null;
  rules: ShippingRule[];
  // Frenet specific
  frenetEnabled?: boolean;
}

// Benefit bar configuration
export interface BenefitConfig {
  enabled: boolean;
  mode: 'free_shipping' | 'gift';
  thresholdValue: number;
  rewardLabel: string;
  successLabel: string;
  progressColor: string;
}

// Cross-sell configuration
export interface CrossSellConfig {
  enabled: boolean;
  strategy: 'manual' | 'related' | 'bestsellers';
  productIds: string[];
  maxItems: number;
  title: string;
}

// Bundles configuration
export interface BundlesConfig {
  enabled: boolean;
  bundleProductIds: string[];
  title: string;
  showSavings: boolean;
}

// Order bump configuration
export interface OrderBumpConfig {
  enabled: boolean;
  productIds: string[];
  title: string;
  description: string;
  discountPercent: number;
  defaultChecked: boolean;
}

// Buy together configuration (integrates with existing buy_together_rules)
export interface BuyTogetherConfig {
  enabled: boolean;
  useExistingRules: boolean;
}

// Complete offers configuration
export interface OffersConfig {
  crossSell: CrossSellConfig;
  bundles: BundlesConfig;
  orderBump: OrderBumpConfig;
  buyTogether: BuyTogetherConfig;
}

// Default configurations
export const defaultShippingConfig: ShippingConfig = {
  provider: 'mock',
  originZip: '',
  defaultPrice: 15,
  defaultDays: 7,
  freeShippingThreshold: null,
  rules: [],
  frenetEnabled: false,
};

export const defaultBenefitConfig: BenefitConfig = {
  enabled: false,
  mode: 'free_shipping',
  thresholdValue: 200,
  rewardLabel: 'Frete Grátis',
  successLabel: 'Você ganhou frete grátis!',
  progressColor: '#22c55e',
};

export const defaultOffersConfig: OffersConfig = {
  crossSell: {
    enabled: false,
    strategy: 'manual',
    productIds: [],
    maxItems: 4,
    title: 'Complete seu pedido',
  },
  bundles: {
    enabled: false,
    bundleProductIds: [],
    title: 'Kits com desconto',
    showSavings: true,
  },
  orderBump: {
    enabled: false,
    productIds: [],
    title: 'Aproveite esta oferta!',
    description: 'Adicione ao seu pedido com desconto especial',
    discountPercent: 10,
    defaultChecked: false,
  },
  buyTogether: {
    enabled: true,
    useExistingRules: true,
  },
};

// Parse functions for database JSONB
export function parseShippingConfig(data: unknown): ShippingConfig {
  if (!data || typeof data !== 'object') return defaultShippingConfig;
  const obj = data as Record<string, unknown>;
  return {
    provider: (obj.provider as ShippingConfig['provider']) || 'mock',
    originZip: String(obj.originZip || ''),
    defaultPrice: Number(obj.defaultPrice) || 15,
    defaultDays: Number(obj.defaultDays) || 7,
    freeShippingThreshold: obj.freeShippingThreshold != null ? Number(obj.freeShippingThreshold) : null,
    rules: Array.isArray(obj.rules) ? obj.rules.map(parseShippingRule) : [],
    frenetEnabled: Boolean(obj.frenetEnabled),
  };
}

function parseShippingRule(data: unknown): ShippingRule {
  if (!data || typeof data !== 'object') {
    return { id: '', zipRangeStart: '', zipRangeEnd: '', price: 0, deliveryDays: 7 };
  }
  const obj = data as Record<string, unknown>;
  return {
    id: String(obj.id || crypto.randomUUID()),
    zipRangeStart: String(obj.zipRangeStart || ''),
    zipRangeEnd: String(obj.zipRangeEnd || ''),
    minWeight: obj.minWeight != null ? Number(obj.minWeight) : undefined,
    maxWeight: obj.maxWeight != null ? Number(obj.maxWeight) : undefined,
    minValue: obj.minValue != null ? Number(obj.minValue) : undefined,
    maxValue: obj.maxValue != null ? Number(obj.maxValue) : undefined,
    price: Number(obj.price) || 0,
    deliveryDays: Number(obj.deliveryDays) || 7,
    label: obj.label ? String(obj.label) : undefined,
  };
}

export function parseBenefitConfig(data: unknown): BenefitConfig {
  if (!data || typeof data !== 'object') return defaultBenefitConfig;
  const obj = data as Record<string, unknown>;
  return {
    enabled: Boolean(obj.enabled),
    mode: (obj.mode as BenefitConfig['mode']) || 'free_shipping',
    thresholdValue: Number(obj.thresholdValue) || 200,
    rewardLabel: String(obj.rewardLabel || 'Frete Grátis'),
    successLabel: String(obj.successLabel || 'Você ganhou frete grátis!'),
    progressColor: String(obj.progressColor || '#22c55e'),
  };
}

export function parseOffersConfig(data: unknown): OffersConfig {
  if (!data || typeof data !== 'object') return defaultOffersConfig;
  const obj = data as Record<string, unknown>;
  
  const crossSellData = obj.crossSell as Record<string, unknown> | undefined;
  const bundlesData = obj.bundles as Record<string, unknown> | undefined;
  const orderBumpData = obj.orderBump as Record<string, unknown> | undefined;
  const buyTogetherData = obj.buyTogether as Record<string, unknown> | undefined;
  
  return {
    crossSell: {
      enabled: Boolean(crossSellData?.enabled),
      strategy: (crossSellData?.strategy as CrossSellConfig['strategy']) || 'manual',
      productIds: Array.isArray(crossSellData?.productIds) ? crossSellData.productIds.map(String) : [],
      maxItems: Number(crossSellData?.maxItems) || 4,
      title: String(crossSellData?.title || 'Complete seu pedido'),
    },
    bundles: {
      enabled: Boolean(bundlesData?.enabled),
      bundleProductIds: Array.isArray(bundlesData?.bundleProductIds) ? bundlesData.bundleProductIds.map(String) : [],
      title: String(bundlesData?.title || 'Kits com desconto'),
      showSavings: bundlesData?.showSavings !== false,
    },
    orderBump: {
      enabled: Boolean(orderBumpData?.enabled),
      productIds: Array.isArray(orderBumpData?.productIds) ? orderBumpData.productIds.map(String) : [],
      title: String(orderBumpData?.title || 'Aproveite esta oferta!'),
      description: String(orderBumpData?.description || 'Adicione ao seu pedido com desconto especial'),
      discountPercent: Number(orderBumpData?.discountPercent) || 10,
      defaultChecked: Boolean(orderBumpData?.defaultChecked),
    },
    buyTogether: {
      enabled: buyTogetherData?.enabled !== false,
      useExistingRules: buyTogetherData?.useExistingRules !== false,
    },
  };
}
