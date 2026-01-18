// =============================================
// BUILDER TYPES - Core type definitions
// =============================================

import React from 'react';

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
    type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'image' | 'video' | 'richtext' | 'array' | 'product' | 'category' | 'menu' | 'categoryList' | 'textarea' | 'productMultiSelect' | 'categoryMultiSelect';
    label: string;
    defaultValue?: unknown;
    options?: { label: string; value: string }[];
    placeholder?: string;
    required?: boolean;
    min?: number;
    max?: number;
    itemType?: 'string' | 'category'; // For array types
    helpText?: string; // Help text / recommended sizes hint
    showWhen?: Record<string, string>; // Conditional visibility based on other props
    imageDimensions?: {
      desktop: string;
      mobile: string;
      aspectRatio?: string;
    }; // For categoryMultiSelect - recommended image dimensions
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

export type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'tracking' | 'blog';

export interface PageVersion {
  id: string;
  tenant_id: string;
  entity_type: 'page' | 'template';
  page_id: string | null;
  page_type: PageType | null;
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
  page_type: PageType;
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
  banner_desktop_url?: string;
  banner_mobile_url?: string;
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
  tenant_id?: string;
  store_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  // Contact info
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  contact_support_hours?: string;
  // Social
  social_instagram?: string;
  social_facebook?: string;
  social_whatsapp?: string;
  store_description?: string;
}

/**
 * Context data passed to blocks during rendering
 * 
 * SLOTS ARCHITECTURE (anti-regression pattern):
 * =============================================
 * Slots are used to inject content at FIXED positions in the page layout.
 * They are rendered in PublicTemplateRenderer.tsx in this order:
 * 
 *   1. Header
 *   2. afterHeaderSlot (e.g., category banner)
 *   3. Content (page blocks)
 *   4. afterContentSlot (e.g., related products, reviews, buy together)
 *   5. Footer
 * 
 * IMPORTANT: Never insert slot content by children index in PageBlock.
 * Slots must be rendered at the renderer level (PublicTemplateRenderer),
 * NOT by manipulating BlockNode.children array positions.
 * 
 * This prevents layout regressions where content appears in wrong positions.
 */
export interface BlockRenderContext {
  tenantSlug: string;
  isPreview: boolean;
  
  // Page type for essential block detection
  pageType?: PageType | 'institutional' | 'landing_page';
  
  // Viewport override for builder (forces mobile/tablet/desktop layout)
  viewport?: 'desktop' | 'tablet' | 'mobile';
  
  // Show ratings on product cards (controlled by category settings)
  showRatings?: boolean;
  
  /**
   * Slot rendered immediately after Header, before main content.
   * Use for: category banners, promotional bars, etc.
   * Rendered in PublicTemplateRenderer, NOT in PageBlock.
   */
  afterHeaderSlot?: React.ReactNode;
  
  /**
   * Slot rendered after main content, before Footer.
   * Use for: related products, reviews, buy together sections, etc.
   * Rendered in PublicTemplateRenderer, NOT in PageBlock.
   */
  afterContentSlot?: React.ReactNode;
  
  // Store settings
  settings?: StoreSettingsContext;
  
  // Menus
  headerMenu?: { 
    id: string; 
    label: string; 
    url?: string; 
    item_type?: string;
    ref_id?: string | null;
    sort_order?: number | null;
    parent_id?: string | null;
  }[];
  footerMenu?: { 
    id: string; 
    label: string; 
    url?: string;
    item_type?: string;
    ref_id?: string | null;
    sort_order?: number | null;
    parent_id?: string | null;
  }[];
  
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
  
  // Individual page content (text/HTML) for template-based pages
  pageContent?: string;
  
  // Order confirmation context (for thank you page)
  order?: {
    orderNumber?: string;
  };
}

// Default empty page structure
export const createEmptyPage = (): BlockNode => ({
  id: 'root',
  type: 'Page',
  props: {},
  children: []
});
