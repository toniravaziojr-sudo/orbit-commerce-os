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

// =============================================
// CART CONFIG - Cart display and feature configuration
// =============================================

export interface CartConfig {
  // Unified cart action type: 'miniCart' | 'goToCart' | 'none'
  cartActionType: 'miniCart' | 'goToCart' | 'none';
  // Show add to cart button (required when cartActionType is not 'none')
  showAddToCartButton: boolean;
  
  // Funcionalidades
  crossSellEnabled: boolean;
  shippingCalculatorEnabled: boolean;
  couponEnabled: boolean;
  sessionTrackingEnabled: boolean;
  
  // Banner promocional (controle individual por formato)
  bannerDesktopEnabled: boolean;
  bannerDesktopUrl: string | null;
  bannerMobileEnabled: boolean;
  bannerMobileUrl: string | null;
  bannerLink: string | null;
  // Onde exibir o banner: 'cart_page' | 'mini_cart' | 'both'
  bannerDisplay: 'cart_page' | 'mini_cart' | 'both';
}

// =============================================
// CHECKOUT CONFIG - Checkout display and feature configuration
// =============================================

export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

// Custom labels/badges per payment method (e.g., "5% OFF no PIX")
export interface PaymentMethodCustomLabels {
  pix?: string;
  credit_card?: string;
  boleto?: string;
}

export interface CheckoutConfig {
  couponEnabled: boolean;
  orderBumpEnabled: boolean;
  testimonialsEnabled: boolean;
  paymentMethodsOrder: PaymentMethod[];
  purchaseEventTiming: 'all_orders' | 'paid_only';
  // Custom labels shown on each payment method (e.g., "5% OFF", "até 12x sem juros")
  paymentMethodLabels?: PaymentMethodCustomLabels;
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

export const defaultCartConfig: CartConfig = {
  cartActionType: 'miniCart',
  showAddToCartButton: true,
  crossSellEnabled: true,
  shippingCalculatorEnabled: true,
  couponEnabled: true,
  sessionTrackingEnabled: true,
  bannerDesktopEnabled: false,
  bannerDesktopUrl: null,
  bannerMobileEnabled: false,
  bannerMobileUrl: null,
  bannerLink: null,
  bannerDisplay: 'cart_page',
};

export const defaultCheckoutConfig: CheckoutConfig = {
  couponEnabled: true,
  orderBumpEnabled: true,
  testimonialsEnabled: false,
  paymentMethodsOrder: ['pix', 'credit_card', 'boleto'],
  purchaseEventTiming: 'paid_only',
  paymentMethodLabels: {},
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

export function parseCartConfig(data: unknown): CartConfig {
  if (!data || typeof data !== 'object') return defaultCartConfig;
  const obj = data as Record<string, unknown>;
  
  // Migrate from legacy: miniCartEnabled + showGoToCartButton -> cartActionType
  let cartActionType: 'miniCart' | 'goToCart' | 'none' = 'miniCart';
  if (obj.cartActionType) {
    cartActionType = obj.cartActionType as 'miniCart' | 'goToCart' | 'none';
  } else if (obj.miniCartEnabled === false) {
    cartActionType = 'none';
  } else if (obj.showGoToCartButton === true && obj.miniCartEnabled !== true) {
    cartActionType = 'goToCart';
  }
  
  // Parse bannerDisplay with migration support
  let bannerDisplay: 'cart_page' | 'mini_cart' | 'both' = 'cart_page';
  if (obj.bannerDisplay === 'mini_cart' || obj.bannerDisplay === 'both') {
    bannerDisplay = obj.bannerDisplay;
  }
  
  return {
    cartActionType,
    showAddToCartButton: obj.showAddToCartButton !== false,
    crossSellEnabled: obj.crossSellEnabled !== false,
    shippingCalculatorEnabled: obj.shippingCalculatorEnabled !== false,
    couponEnabled: obj.couponEnabled !== false,
    sessionTrackingEnabled: obj.sessionTrackingEnabled !== false,
    bannerDesktopEnabled: Boolean(obj.bannerDesktopEnabled),
    bannerDesktopUrl: obj.bannerDesktopUrl ? String(obj.bannerDesktopUrl) : null,
    bannerMobileEnabled: Boolean(obj.bannerMobileEnabled),
    bannerMobileUrl: obj.bannerMobileUrl ? String(obj.bannerMobileUrl) : null,
    bannerLink: obj.bannerLink ? String(obj.bannerLink) : null,
    bannerDisplay,
  };
}

export function parseCheckoutConfig(data: unknown): CheckoutConfig {
  if (!data || typeof data !== 'object') return defaultCheckoutConfig;
  const obj = data as Record<string, unknown>;
  
  const validMethods: PaymentMethod[] = ['pix', 'credit_card', 'boleto'];
  let paymentMethodsOrder: PaymentMethod[] = defaultCheckoutConfig.paymentMethodsOrder;
  
  if (Array.isArray(obj.paymentMethodsOrder)) {
    const parsed = obj.paymentMethodsOrder.filter(
      (m): m is PaymentMethod => validMethods.includes(m as PaymentMethod)
    );
    if (parsed.length > 0) paymentMethodsOrder = parsed;
  }
  
  // Parse payment method labels
  const paymentMethodLabels: PaymentMethodCustomLabels = {};
  if (obj.paymentMethodLabels && typeof obj.paymentMethodLabels === 'object') {
    const labels = obj.paymentMethodLabels as Record<string, unknown>;
    if (labels.pix) paymentMethodLabels.pix = String(labels.pix);
    if (labels.credit_card) paymentMethodLabels.credit_card = String(labels.credit_card);
    if (labels.boleto) paymentMethodLabels.boleto = String(labels.boleto);
  }
  
  return {
    couponEnabled: obj.couponEnabled !== false,
    orderBumpEnabled: obj.orderBumpEnabled !== false,
    testimonialsEnabled: Boolean(obj.testimonialsEnabled),
    paymentMethodsOrder,
    purchaseEventTiming: obj.purchaseEventTiming === 'all_orders' ? 'all_orders' : 'paid_only',
    paymentMethodLabels,
  };
}
