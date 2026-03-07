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
