// =============================================
// BUILDER TYPES - Core type definitions
// =============================================

export type BlockCategory = 
  | 'layout'
  | 'header-footer'
  | 'content'
  | 'ecommerce';

export interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: BlockNode[];
}

export interface BlockPropsSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'image' | 'richtext' | 'array' | 'product' | 'category' | 'menu';
    label: string;
    defaultValue?: unknown;
    options?: { label: string; value: string }[];
    placeholder?: string;
    required?: boolean;
    min?: number;
    max?: number;
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

// Context data passed to blocks during rendering
export interface BlockRenderContext {
  tenantSlug: string;
  isPreview: boolean;
  // For template pages
  category?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
  };
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    description?: string;
    images?: { url: string; alt_text?: string }[];
  };
  // Store settings
  settings?: {
    store_name?: string;
    logo_url?: string;
    primary_color?: string;
  };
  // Menus
  headerMenu?: { id: string; label: string; url?: string }[];
  footerMenu?: { id: string; label: string; url?: string }[];
}

// Default empty page structure
export const createEmptyPage = (): BlockNode => ({
  id: 'root',
  type: 'Page',
  props: {},
  children: []
});
