// =============================================
// TIPOS INTERNOS DA PLATAFORMA (DESTINO)
// Todos os dados importados são convertidos para este formato
// =============================================

// Produto normalizado (formato interno)
export interface NormalizedProduct {
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  sku: string | null;
  barcode: string | null;
  weight: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  stock_quantity: number | null;
  is_featured: boolean;
  status: 'active' | 'draft' | 'archived';
  seo_title: string | null;
  seo_description: string | null;
  images: NormalizedProductImage[];
  variants: NormalizedProductVariant[];
  categories: string[]; // slugs das categorias
}

export interface NormalizedProductImage {
  url: string;
  alt: string | null;
  is_primary: boolean;
  position: number;
}

export interface NormalizedProductVariant {
  name: string;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number | null;
  options: Record<string, string>; // { "Cor": "Azul", "Tamanho": "M" }
}

// Categoria normalizada (formato interno)
export interface NormalizedCategory {
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  banner_desktop_url: string | null;
  banner_mobile_url: string | null;
  parent_slug: string | null;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
  is_active: boolean;
}

// Cliente normalizado (formato interno)
export interface NormalizedCustomer {
  email: string;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  gender: string | null;
  accepts_marketing: boolean;
  status: 'active' | 'inactive';
  addresses: NormalizedAddress[];
  tags: string[];
  notes: string | null;
}

export interface NormalizedAddress {
  label: string;
  recipient_name: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

// Pedido normalizado (formato interno)
export interface NormalizedOrder {
  order_number: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  payment_method: string | null;
  shipping_status: string | null;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  total: number;
  currency: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  shipping_address: NormalizedAddress | null;
  billing_address: NormalizedAddress | null;
  items: NormalizedOrderItem[];
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking_code: string | null;
  tracking_carrier: string | null;
}

export interface NormalizedOrderItem {
  product_name: string;
  product_sku: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

// Cupom normalizado (formato interno)
export interface NormalizedCoupon {
  code: string;
  name: string;
  description: string | null;
  type: 'percentage' | 'fixed';
  value: number;
  min_subtotal: number | null;
  usage_limit_total: number | null;
  usage_limit_per_customer: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

// Visual/Tema normalizado (formato interno)
export interface NormalizedVisual {
  logo_url: string | null;
  favicon_url: string | null;
  colors: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
    background: string | null;
    text: string | null;
  };
  fonts: {
    heading: string | null;
    body: string | null;
  };
  social_links: {
    facebook: string | null;
    instagram: string | null;
    twitter: string | null;
    youtube: string | null;
    tiktok: string | null;
    whatsapp: string | null;
  };
  store_name: string | null;
  store_description: string | null;
}

// Menu normalizado (formato interno)
export interface NormalizedMenu {
  name: string;
  slug: string;
  location: 'header' | 'footer' | 'mobile';
  items: NormalizedMenuItem[];
}

export interface NormalizedMenuItem {
  label: string;
  url: string;
  type: 'link' | 'category' | 'page' | 'product';
  target: '_self' | '_blank';
  children: NormalizedMenuItem[];
  position: number;
}

// Avaliação normalizada (formato interno)
export interface NormalizedReview {
  product_slug: string;
  customer_name: string;
  customer_email: string | null;
  rating: number; // 1-5
  title: string | null;
  comment: string | null;
  is_verified: boolean;
  created_at: string;
}

// Página normalizada (formato interno)
export interface NormalizedPage {
  title: string;
  slug: string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
}

// Banner normalizado (formato interno)
export interface NormalizedBanner {
  title: string | null;
  subtitle: string | null;
  image_desktop_url: string;
  image_mobile_url: string | null;
  link_url: string | null;
  button_text: string | null;
  position: number;
  is_active: boolean;
}

// Tipos de plataforma suportadas
export type PlatformType = 
  | 'shopify'
  | 'nuvemshop'
  | 'tray'
  | 'vtex'
  | 'woocommerce'
  | 'loja_integrada'
  | 'magento'
  | 'opencart'
  | 'prestashop'
  | 'unknown';

// Resultado da detecção de plataforma
export interface PlatformDetectionResult {
  platform: PlatformType;
  confidence: number; // 0-100
  version: string | null;
  features: string[];
}

// Resultado da importação
export interface ImportResult<T> {
  success: boolean;
  data: T[];
  errors: ImportError[];
  warnings: ImportWarning[];
  stats: {
    total: number;
    imported: number;
    skipped: number;
    failed: number;
  };
}

export interface ImportError {
  field: string;
  message: string;
  originalValue: any;
  row?: number;
}

export interface ImportWarning {
  field: string;
  message: string;
  suggestion: string;
}

// Status de importação
export interface ImportProgress {
  module: string;
  status: 'pending' | 'analyzing' | 'importing' | 'completed' | 'failed';
  progress: number; // 0-100
  current: number;
  total: number;
  currentItem: string | null;
  errors: ImportError[];
}
