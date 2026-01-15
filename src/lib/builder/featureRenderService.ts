// =============================================
// FEATURE RENDER SERVICE - Central pipeline for feature/skeleton rendering
// AJUSTE 3: Skeleton por pageType
// AJUSTE 4: Lógica geral de toggles (builder vs público)
// =============================================

import { BlockNode } from './types';

// Render modes
export type RenderMode = 'editor' | 'public';

// Feature render result
export interface FeatureRenderResult {
  render: 'none' | 'skeleton' | 'real';
  reason?: string;
  dataSource?: unknown;
}

// Page type to feature slots mapping
export interface FeatureSlot {
  id: string;
  label: string;
  settingsKey: string;
  dataModule?: string; // Which module provides real data (e.g., 'offers', 'testimonials')
  checkRealData?: () => Promise<boolean>; // Function to check if real data exists
}

// Feature slots by page type
export const PAGE_FEATURE_SLOTS: Record<string, FeatureSlot[]> = {
  product: [
    { id: 'gallery', label: 'Galeria', settingsKey: 'showGallery' },
    { id: 'description', label: 'Descrição', settingsKey: 'showDescription' },
    { id: 'variants', label: 'Variantes', settingsKey: 'showVariants' },
    { id: 'stock', label: 'Estoque', settingsKey: 'showStock' },
    { id: 'related-products', label: 'Produtos Relacionados', settingsKey: 'showRelatedProducts' },
    { id: 'buy-together', label: 'Compre Junto', settingsKey: 'showBuyTogether', dataModule: 'buy_together_rules' },
    { id: 'reviews', label: 'Avaliações', settingsKey: 'showReviews', dataModule: 'product_reviews' },
  ],
  cart: [
    { id: 'mini-cart', label: 'Carrinho Suspenso', settingsKey: 'miniCartEnabled' },
    { id: 'shipping-calculator', label: 'Calculadora de Frete', settingsKey: 'shippingCalculatorEnabled' },
    { id: 'coupon', label: 'Cupom de Desconto', settingsKey: 'couponEnabled' },
    { id: 'cross-sell', label: 'Você também pode gostar', settingsKey: 'showCrossSell', dataModule: 'cross_sell_rules' },
    { id: 'banner-desktop', label: 'Banner Desktop', settingsKey: 'bannerDesktopEnabled' },
    { id: 'banner-mobile', label: 'Banner Mobile', settingsKey: 'bannerMobileEnabled' },
  ],
  checkout: [
    { id: 'coupon', label: 'Cupom de Desconto', settingsKey: 'couponEnabled' },
    { id: 'testimonials', label: 'Depoimentos', settingsKey: 'testimonialsEnabled', dataModule: 'checkout_testimonials' },
    { id: 'timeline', label: 'Timeline de Etapas', settingsKey: 'showTimeline' },
    { id: 'order-bump', label: 'Order Bump', settingsKey: 'showOrderBump', dataModule: 'order_bump_rules' },
  ],
  thank_you: [
    { id: 'upsell', label: 'Upsell', settingsKey: 'showUpsell', dataModule: 'upsell_rules' },
    { id: 'whatsapp', label: 'WhatsApp', settingsKey: 'showWhatsApp' },
  ],
  category: [
    { id: 'category-name', label: 'Nome da Categoria', settingsKey: 'showCategoryName' },
    { id: 'banner', label: 'Banner da Categoria', settingsKey: 'showBanner' },
    { id: 'ratings', label: 'Avaliações nos Produtos', settingsKey: 'showRatings' },
  ],
};

/**
 * Resolve feature render mode - CONTRATO ÚNICO (PASSO 5)
 * 
 * This is the SINGLE SOURCE OF TRUTH for feature/slot rendering decisions.
 * All feature slots (CrossSell, OrderBump, Upsell, Cupom, Frete, Depoimentos, etc.)
 * MUST use this function to determine what to render.
 * 
 * Rules:
 * - Editor + enabled + hasRealData => render 'real'
 * - Editor + enabled + !hasRealData => render 'skeleton'
 * - Editor + !enabled => render 'none'
 * - Public + enabled + hasRealData => render 'real'
 * - Public + enabled + !hasRealData => render 'none' (NEVER skeleton in public)
 * - Public + !enabled => render 'none'
 * 
 * @param enabled - Whether the feature toggle is enabled in settings
 * @param hasRealData - Whether real data exists for this feature
 * @param isEditor - Whether we're in editor mode (true) or public mode (false)
 * @param pageType - Optional: The current page type (for logging)
 * @param featureId - Optional: The feature slot ID (for logging)
 */
export function resolveFeatureRenderMode(
  enabled: boolean,
  hasRealData: boolean,
  isEditor: boolean,
  pageType?: string,
  featureId?: string
): FeatureRenderResult {
  // Feature disabled = never render anywhere
  if (!enabled) {
    return { 
      render: 'none', 
      reason: `Feature ${featureId || 'unknown'} disabled in settings` 
    };
  }

  // Editor mode: always show something when enabled (skeleton or real)
  if (isEditor) {
    if (hasRealData) {
      return { 
        render: 'real', 
        reason: `Real data available for ${featureId || 'feature'}` 
      };
    }
    return { 
      render: 'skeleton', 
      reason: `Showing skeleton for ${featureId || 'feature'} (no real data in editor)` 
    };
  }

  // Public mode: only render if real data exists (NEVER skeleton)
  if (hasRealData) {
    return { 
      render: 'real', 
      reason: `Real data available for ${featureId || 'feature'}` 
    };
  }

  return { 
    render: 'none', 
    reason: `No real data for ${featureId || 'feature'} in public mode` 
  };
}

// Legacy signature support (for backward compatibility during migration)
export function resolveFeatureRenderModeLegacy(
  pageType: string,
  featureId: string,
  enabled: boolean,
  hasRealData: boolean,
  mode: RenderMode
): FeatureRenderResult {
  return resolveFeatureRenderMode(enabled, hasRealData, mode === 'editor', pageType, featureId);
}

/**
 * Get skeleton content for a page type
 * Used when pages have no real content but need referential structure
 */
export function getPageTypeSkeleton(pageType: string): BlockNode {
  const skeletons: Record<string, BlockNode> = {
    home: createHomeSkeleton(),
    category: createCategorySkeleton(),
    product: createProductSkeleton(),
    cart: createCartSkeleton(),
    checkout: createCheckoutSkeleton(),
    thank_you: createThankYouSkeleton(),
    account: createAccountSkeleton(),
    account_orders: createAccountOrdersSkeleton(),
    account_order_detail: createOrderDetailSkeleton(),
    tracking: createTrackingSkeleton(),
    blog: createBlogSkeleton(),
  };

  return skeletons[pageType] || createGenericSkeleton(pageType);
}

// Skeleton generators for each page type
function createHomeSkeleton(): BlockNode {
  return {
    id: 'skeleton-home',
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Banner Principal', 'h-64'),
      createSkeletonSection('Categorias em Destaque', 'h-48'),
      createSkeletonSection('Produtos em Destaque', 'h-80'),
      createSkeletonSection('Banners Secundários', 'h-32'),
    ],
  };
}

function createCategorySkeleton(): BlockNode {
  return {
    id: 'skeleton-category',
    type: 'Page',
    props: {},
    children: [
      createSkeletonBreadcrumb(),
      createSkeletonSection('Banner da Categoria', 'h-40'),
      createSkeletonSection('Nome da Categoria', 'h-12'),
      createSkeletonProductGrid(),
      createSkeletonSection('Paginação', 'h-12'),
    ],
  };
}

function createProductSkeleton(): BlockNode {
  return {
    id: 'skeleton-product',
    type: 'Page',
    props: {},
    children: [
      createSkeletonBreadcrumb(),
      createSkeletonTwoColumn('Galeria do Produto', 'Informações do Produto'),
      createSkeletonSection('Descrição', 'h-48'),
      createSkeletonSection('Compre Junto', 'h-32'),
      createSkeletonSection('Produtos Relacionados', 'h-64'),
      createSkeletonSection('Avaliações', 'h-48'),
    ],
  };
}

function createCartSkeleton(): BlockNode {
  return {
    id: 'skeleton-cart',
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Título do Carrinho', 'h-12'),
      createSkeletonTwoColumn('Lista de Produtos', 'Resumo do Pedido'),
      createSkeletonSection('Você também pode gostar', 'h-48'),
    ],
  };
}

function createCheckoutSkeleton(): BlockNode {
  return {
    id: 'skeleton-checkout',
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Timeline de Etapas', 'h-16'),
      createSkeletonTwoColumn('Formulário de Checkout', 'Resumo do Pedido'),
      createSkeletonSection('Depoimentos', 'h-32'),
    ],
  };
}

function createThankYouSkeleton(): BlockNode {
  return {
    id: 'skeleton-thank-you',
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Confirmação do Pedido', 'h-24'),
      createSkeletonSection('Detalhes do Pedido', 'h-48'),
      createSkeletonSection('Oferta Upsell', 'h-32'),
      createSkeletonSection('WhatsApp / Contato', 'h-16'),
    ],
  };
}

function createAccountSkeleton(): BlockNode {
  return {
    id: 'skeleton-account',
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Dados do Cliente', 'h-48'),
      createSkeletonSection('Menu da Conta', 'h-32'),
    ],
  };
}

function createAccountOrdersSkeleton(): BlockNode {
  return {
    id: 'skeleton-orders',
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Título - Meus Pedidos', 'h-12'),
      createSkeletonSection('Lista de Pedidos', 'h-64'),
    ],
  };
}

function createOrderDetailSkeleton(): BlockNode {
  return {
    id: 'skeleton-order-detail',
    type: 'Page',
    props: {},
    children: [
      createSkeletonBreadcrumb(),
      createSkeletonSection('Status do Pedido', 'h-24'),
      createSkeletonSection('Itens do Pedido', 'h-48'),
      createSkeletonSection('Endereço e Pagamento', 'h-32'),
    ],
  };
}

function createTrackingSkeleton(): BlockNode {
  return {
    id: 'skeleton-tracking',
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Buscar Pedido', 'h-24'),
      createSkeletonSection('Timeline de Rastreio', 'h-48'),
      createSkeletonSection('Detalhes da Entrega', 'h-32'),
    ],
  };
}

function createBlogSkeleton(): BlockNode {
  return {
    id: 'skeleton-blog',
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Posts em Destaque', 'h-48'),
      createSkeletonSection('Lista de Posts', 'h-64'),
      createSkeletonSection('Categorias / Tags', 'h-24'),
    ],
  };
}

function createGenericSkeleton(pageType: string): BlockNode {
  return {
    id: `skeleton-${pageType}`,
    type: 'Page',
    props: {},
    children: [
      createSkeletonSection('Conteúdo Principal', 'h-48'),
    ],
  };
}

// Helper skeleton components
function createSkeletonSection(label: string, heightClass: string): BlockNode {
  return {
    id: `skeleton-section-${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    type: 'SkeletonSection',
    props: { label, heightClass },
    children: [],
  };
}

function createSkeletonBreadcrumb(): BlockNode {
  return {
    id: `skeleton-breadcrumb-${Date.now()}`,
    type: 'SkeletonBreadcrumb',
    props: {},
    children: [],
  };
}

function createSkeletonProductGrid(): BlockNode {
  return {
    id: `skeleton-product-grid-${Date.now()}`,
    type: 'SkeletonProductGrid',
    props: { columns: 4 },
    children: [],
  };
}

function createSkeletonTwoColumn(leftLabel: string, rightLabel: string): BlockNode {
  return {
    id: `skeleton-two-col-${Date.now()}`,
    type: 'SkeletonTwoColumn',
    props: { leftLabel, rightLabel },
    children: [],
  };
}

/**
 * Check if content is essentially empty (only structural blocks, no real content)
 */
export function isContentEmpty(content: BlockNode | null): boolean {
  if (!content) return true;
  
  const structuralTypes = ['Page', 'Section', 'Layout', 'Header', 'Footer'];
  
  function hasRealContent(node: BlockNode): boolean {
    // If not a structural type, it has real content
    if (!structuralTypes.includes(node.type)) {
      return true;
    }
    
    // Check children
    if (node.children && node.children.length > 0) {
      // Filter out hidden blocks and structural containers
      const visibleChildren = node.children.filter(c => !c.hidden);
      for (const child of visibleChildren) {
        if (hasRealContent(child)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Check if there's any real content beyond Header/Footer
  const mainContent = content.children?.filter(
    c => c.type !== 'Header' && c.type !== 'Footer' && !c.hidden
  ) || [];
  
  for (const block of mainContent) {
    if (hasRealContent(block)) {
      return false;
    }
  }
  
  return true;
}
