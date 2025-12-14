// =============================================
// BUILDER TYPES - Core type definitions
// =============================================

export type BlockCategory = 
  | 'layout'
  | 'header-footer'
  | 'content'
  | 'media'
  | 'ecommerce'
  | 'utilities';

export interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: BlockNode[];
  hidden?: boolean;
}

export interface BlockPropsSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'image' | 'richtext' | 'array' | 'product' | 'category' | 'menu' | 'categoryList';
    label: string;
    defaultValue?: unknown;
    options?: { label: string; value: string }[];
    placeholder?: string;
    required?: boolean;
    min?: number;
    max?: number;
    itemType?: 'string' | 'category'; // For array types
  };
}

export interface BlockDefinition {
  type: string;
  label: string;
  category: BlockCategory;
  icon: string;
  defaultProps: Record<string, unknown>;
  propsSchema: BlockPropsSchema;
  canHaveChildren: boolean;
  slotConstraints?: {
    allowedTypes?: string[];
    maxChildren?: number;
  };
  isRemovable?: boolean;
}

export interface BuilderState {
  content: BlockNode;
  selectedBlockId: string | null;
  history: BlockNode[];
  historyIndex: number;
  isDirty: boolean;
}

export interface PageVersion {
  id: string;
  tenant_id: string;
  entity_type: 'page' | 'template';
  page_id: string | null;
  page_type: 'home' | 'category' | 'product' | 'cart' | 'checkout' | null;
  version: number;
  status: 'draft' | 'published' | 'archived';
  content: BlockNode;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorefrontTemplate {
  id: string;
  tenant_id: string;
  page_type: 'home' | 'category' | 'product' | 'cart' | 'checkout';
  published_version: number | null;
  draft_version: number | null;
  created_at: string;
  updated_at: string;
}

// Product context for product pages
export interface ProductContext {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  description?: string;
  short_description?: string;
  stock_quantity?: number;
  allow_backorder?: boolean;
  images?: { url: string; alt?: string; is_primary?: boolean }[];
}

// Category context for category pages
export interface CategoryContext {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
}

// Cart item for cart/checkout pages
export interface CartItemContext {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image_url?: string;
}

// Store settings context
export interface StoreSettingsContext {
  store_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  social_instagram?: string;
  social_facebook?: string;
  social_whatsapp?: string;
  store_description?: string;
}

// Context data passed to blocks during rendering
export interface BlockRenderContext {
  tenantSlug: string;
  isPreview: boolean;
  
  // Store settings
  settings?: StoreSettingsContext;
  
  // Menus
  headerMenu?: { id: string; label: string; url?: string }[];
  footerMenu?: { id: string; label: string; url?: string }[];
  
  // Category page context
  category?: CategoryContext;
  
  // Product page context
  product?: ProductContext;
  
  // Products list (for category pages, product grids, etc.)
  products?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price?: number;
    image_url?: string;
  }[];
  
  // Cart context
  cart?: {
    items: CartItemContext[];
    subtotal: number;
    updateQuantity: (id: string, quantity: number) => void;
    removeItem: (id: string) => void;
  };
  
  // Checkout context
  checkout?: {
    items: CartItemContext[];
    subtotal: number;
    clearCart: () => void;
  };
  
  // Institutional page context
  page?: {
    title: string;
    slug: string;
  };
}

// Default empty page structure
export const createEmptyPage = (): BlockNode => ({
  id: 'root',
  type: 'Page',
  props: {},
  children: []
});
