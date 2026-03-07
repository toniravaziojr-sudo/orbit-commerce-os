// =============================================
// BLOCK COMPILER — Shared Types
// =============================================
// These types mirror src/lib/builder/types.ts BlockNode
// to maintain a single source of truth for the block schema.
// The BlockNode structure IS the contract between builder and compiler.
// =============================================

export interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: BlockNode[];
  hidden?: boolean;
}

/**
 * Data context passed to block compilers during rendering.
 * Allows blocks to access fetched data (products, categories, etc.)
 * without each block needing to fetch its own data.
 */
export interface CompilerContext {
  tenantSlug: string;
  hostname: string;
  /** Map of product ID → product data */
  products: Map<string, ProductData>;
  /** Map of product ID → primary image URL */
  productImages: Map<string, string>;
  /** Map of category ID → category data */
  categories: Map<string, CategoryData>;
  /** Theme settings from template */
  themeSettings: any;
  /** Category display settings */
  categorySettings: any;
  /** Product display settings */
  productSettings: any;
  /** Store settings */
  storeSettings: any;
  /** Menu items for header */
  menuItems: any[];
  /** Footer menus */
  footerMenus: { footer1: any; footer2: any };
  /** Global layout config */
  globalLayout: any;
  /** Tenant data */
  tenant: any;

  // === Route-specific data ===
  
  /** Current category data (for category pages) */
  currentCategory?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
    banner_desktop_url?: string;
    banner_mobile_url?: string;
  };
  /** Products list for current category page */
  categoryProducts?: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price?: number;
    stock_quantity?: number;
    status?: string;
    free_shipping?: boolean;
    avg_rating?: number;
    review_count?: number;
    product_images?: Array<{ url: string; is_primary?: boolean; sort_order?: number }>;
  }>;

  /** Current product data (for product pages) */
  currentProduct?: {
    id: string;
    name: string;
    slug: string;
    sku?: string;
    price: number;
    compare_at_price?: number;
    description?: string;
    short_description?: string;
    brand?: string;
    stock_quantity?: number;
    status?: string;
    free_shipping?: boolean;
    has_variants?: boolean;
    tags?: string[];
    seo_title?: string;
    seo_description?: string;
    avg_rating?: number;
    review_count?: number;
    allow_backorder?: boolean;
  };
  /** Category breadcrumb for current product */
  currentProductCategory?: {
    name: string;
    slug: string;
  };
  /** Images for the current product */
  currentProductImages?: Array<{
    id?: string;
    url: string;
    alt_text?: string;
    is_primary?: boolean;
    sort_order?: number;
  }>;

  /** Approved reviews for the current product */
  currentProductReviews?: Array<{
    id: string;
    customer_name: string;
    rating: number;
    title?: string;
    content?: string;
    created_at: string;
    is_verified_purchase?: boolean;
    media_urls?: string[];
  }>;

  /** Related products for the current product */
  currentRelatedProducts?: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price?: number;
    free_shipping?: boolean;
    avg_rating?: number;
    review_count?: number;
    image_url?: string;
  }>;

  /** Variants for the current product */
  currentProductVariants?: Array<{
    id: string;
    sku?: string;
    price: number;
    compare_at_price?: number;
    stock_quantity: number;
    image_url?: string;
    is_active: boolean;
    option1_name?: string;
    option1_value?: string;
    option2_name?: string;
    option2_value?: string;
    option3_name?: string;
    option3_value?: string;
  }>;

  /** Buy together rule for the current product */
  currentBuyTogether?: {
    id: string;
    title?: string;
    discount_type: string;
    discount_value: number;
    suggestedProduct: {
      id: string;
      name: string;
      slug: string;
      price: number;
      compare_at_price?: number;
      image_url?: string;
    };
  };
}

export interface ProductData {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price?: number;
  status?: string;
  free_shipping?: boolean;
  avg_rating?: number;
  review_count?: number;
}

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
}

/**
 * A block compiler function.
 * Takes the block's props and a compiler context, returns static HTML string.
 * This is the co-located equivalent of the React component's render output.
 */
export type BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
  children?: string
) => string;
