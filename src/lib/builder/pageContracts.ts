// =============================================
// PAGE CONTRACTS - Structural requirements per page type
// Defines required blocks that cannot be removed
// Each template is independent - contracts enforce structure, not sharing
// =============================================

import type { BlockNode } from './types';
import { generateBlockId } from './utils';

/**
 * Page Contract definition
 * - requiredBlocks: block types that MUST exist in the page (locked, cannot be deleted)
 * - optionalSlots: toggleable feature slots (e.g., CompreJunto, Reviews)
 * - pageLabel: human-readable label for the page type
 * - isSystemPage: true for pages that have structural requirements
 */
export interface PageContract {
  pageType: string;
  pageLabel: string;
  isSystemPage: boolean;
  requiredBlocks: RequiredBlock[];
  optionalSlots: OptionalSlot[];
}

export interface RequiredBlock {
  type: string;
  label: string;
  description: string;
  lockDelete: boolean;
  lockMove: boolean;
}

export interface OptionalSlot {
  type: string;
  label: string;
  description: string;
  toggleKey: string;
  defaultEnabled: boolean;
}

// =============================================
// PAGE CONTRACTS DEFINITIONS
// =============================================

export const PAGE_CONTRACTS: Record<string, PageContract> = {
  home: {
    pageType: 'home',
    pageLabel: 'Página Inicial',
    isSystemPage: false, // Marketing page - fully customizable
    requiredBlocks: [],
    optionalSlots: [],
  },
  
  category: {
    pageType: 'category',
    pageLabel: 'Categoria',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'CategoryBanner',
        label: 'Banner da Categoria',
        description: 'Exibe o banner/título da categoria',
        lockDelete: true,
        lockMove: false,
      },
      {
        // REGRAS.md: filtros de busca avançada + listagem de produtos + ordenação (básico)
        type: 'CategoryPageLayout',
        label: 'Listagem com Filtros',
        description: 'Listagem de produtos com filtros avançados e ordenação',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [],
  },
  
  product: {
    pageType: 'product',
    pageLabel: 'Produto',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'ProductDetails',
        label: 'Detalhes do Produto',
        description: 'Galeria, preço, variações e CTA principal',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [
      {
        type: 'CompreJuntoSlot',
        label: 'Compre Junto',
        description: 'Sugestões de produtos para comprar junto',
        toggleKey: 'showBuyTogether',
        defaultEnabled: true,
      },
      {
        type: 'ProductGrid',
        label: 'Produtos Relacionados',
        description: 'Produtos similares ou da mesma categoria',
        toggleKey: 'showRelatedProducts',
        defaultEnabled: true,
      },
    ],
  },
  
  cart: {
    pageType: 'cart',
    pageLabel: 'Carrinho',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'Cart',
        label: 'Carrinho de Compras',
        description: 'Itens do carrinho e resumo',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [
      {
        type: 'CrossSellSlot',
        label: 'Cross-sell',
        description: 'Sugestões de produtos adicionais',
        toggleKey: 'showCrossSell',
        defaultEnabled: true,
      },
    ],
  },
  
  checkout: {
    pageType: 'checkout',
    pageLabel: 'Checkout',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'Checkout',
        label: 'Formulário de Checkout',
        description: 'Etapas de pagamento e finalização',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [
      // OrderBumpSlot removed - handled internally by CheckoutContent via OrderBumpSection
      // Toggle showOrderBump controls visibility of internal OrderBumpSection, not a separate block
    ],
  },
  
  thank_you: {
    pageType: 'thank_you',
    pageLabel: 'Obrigado',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'ThankYou',
        label: 'Confirmação do Pedido',
        description: 'Mensagem de sucesso e resumo',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [
      {
        type: 'UpsellSlot',
        label: 'Upsell',
        description: 'Ofertas pós-compra',
        toggleKey: 'showUpsell',
        defaultEnabled: true,
      },
    ],
  },
  
  account: {
    pageType: 'account',
    pageLabel: 'Minha Conta',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'AccountHub',
        label: 'Central da Conta',
        description: 'Navegação e dados do cliente',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [],
  },
  
  account_orders: {
    pageType: 'account_orders',
    pageLabel: 'Meus Pedidos',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'OrdersList',
        label: 'Lista de Pedidos',
        description: 'Histórico de pedidos do cliente',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [],
  },
  
  account_order_detail: {
    pageType: 'account_order_detail',
    pageLabel: 'Detalhe do Pedido',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'OrderDetail',
        label: 'Detalhes do Pedido',
        description: 'Informações completas do pedido',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [],
  },
  
  tracking: {
    pageType: 'tracking',
    pageLabel: 'Rastreio',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'TrackingLookup',
        label: 'Consulta de Rastreio',
        description: 'Formulário para rastrear pedidos',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [],
  },
  
  blog: {
    pageType: 'blog',
    pageLabel: 'Blog',
    isSystemPage: true,
    requiredBlocks: [
      {
        type: 'BlogListing',
        label: 'Listagem do Blog',
        description: 'Lista de posts do blog',
        lockDelete: true,
        lockMove: false,
      },
    ],
    optionalSlots: [],
  },
};

/**
 * Get the contract for a page type
 */
export function getPageContract(pageType: string): PageContract | null {
  // Normalize page type aliases
  const normalizedType = pageType === 'obrigado' ? 'thank_you' : pageType;
  return PAGE_CONTRACTS[normalizedType] || null;
}

/**
 * Check if a block type is required (locked) for a given page type
 */
export function isBlockRequired(pageType: string, blockType: string): boolean {
  const contract = getPageContract(pageType);
  if (!contract) return false;
  return contract.requiredBlocks.some(rb => rb.type === blockType);
}

/**
 * Check if a block can be deleted based on page contract
 */
export function canDeleteBlock(pageType: string, blockType: string): boolean {
  const contract = getPageContract(pageType);
  if (!contract) return true;
  
  const requiredBlock = contract.requiredBlocks.find(rb => rb.type === blockType);
  return !requiredBlock?.lockDelete;
}

/**
 * Get required block info for display
 */
export function getRequiredBlockInfo(pageType: string, blockType: string): RequiredBlock | null {
  const contract = getPageContract(pageType);
  if (!contract) return null;
  return contract.requiredBlocks.find(rb => rb.type === blockType) || null;
}

/**
 * Validate and repair a page content to ensure all required blocks exist
 * Returns the repaired content and a list of added blocks
 */
export function validateAndRepairPageContent(
  pageType: string,
  content: BlockNode | null
): { content: BlockNode; addedBlocks: string[] } {
  const contract = getPageContract(pageType);
  const addedBlocks: string[] = [];
  
  // If no contract or no required blocks, return as-is
  if (!contract || contract.requiredBlocks.length === 0) {
    return { content: content || createMinimalPage(), addedBlocks };
  }
  
  // Start with existing content or minimal page
  let repairedContent = content || createMinimalPage();
  
  // Find all block types currently in the tree
  const existingTypes = new Set<string>();
  collectBlockTypes(repairedContent, existingTypes);
  
  // Check which required blocks are missing
  for (const requiredBlock of contract.requiredBlocks) {
    if (!existingTypes.has(requiredBlock.type)) {
      // Add the missing block
      repairedContent = injectRequiredBlock(repairedContent, requiredBlock.type);
      addedBlocks.push(requiredBlock.type);
    }
  }
  
  return { content: repairedContent, addedBlocks };
}

/**
 * Collect all block types in a content tree
 */
function collectBlockTypes(node: BlockNode, types: Set<string>): void {
  types.add(node.type);
  if (node.children) {
    for (const child of node.children) {
      collectBlockTypes(child, types);
    }
  }
}

/**
 * Create a minimal page structure
 */
function createMinimalPage(): BlockNode {
  return {
    id: 'root',
    type: 'Page',
    props: {},
    children: [
      {
        id: generateBlockId('Header'),
        type: 'Header',
        props: { menuId: '', showSearch: true, showCart: true, sticky: true },
      },
      {
        id: generateBlockId('Section'),
        type: 'Section',
        props: { paddingY: 32 },
        children: [],
      },
      {
        id: generateBlockId('Footer'),
        type: 'Footer',
        props: { menuId: '', showSocial: true },
      },
    ],
  };
}

/**
 * Inject a required block into the content tree
 * Places it in the first available Section after Header
 */
function injectRequiredBlock(content: BlockNode, blockType: string): BlockNode {
  const cloned = JSON.parse(JSON.stringify(content)) as BlockNode;
  
  // Find the first Section to inject into
  const children = cloned.children || [];
  let sectionIndex = children.findIndex(c => c.type === 'Section');
  
  // If no section, create one
  if (sectionIndex === -1) {
    // Find index after Header (if exists)
    const headerIndex = children.findIndex(c => c.type === 'Header');
    const insertAt = headerIndex >= 0 ? headerIndex + 1 : 0;
    
    children.splice(insertAt, 0, {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
      children: [],
    });
    sectionIndex = insertAt;
  }
  
  // Add the required block to the section
  const section = children[sectionIndex];
  if (!section.children) section.children = [];
  
  section.children.push({
    id: generateBlockId(blockType),
    type: blockType,
    props: getDefaultPropsForBlockType(blockType),
  });
  
  cloned.children = children;
  return cloned;
}

/**
 * Get default props for a block type (minimal/clean)
 */
function getDefaultPropsForBlockType(blockType: string): Record<string, unknown> {
  const defaults: Record<string, Record<string, unknown>> = {
    ProductDetails: { showGallery: true, showDescription: true, showVariants: true, showStock: true },
    CategoryBanner: { showTitle: true, titlePosition: 'center', overlayOpacity: 40, height: 'md' },
    ProductGrid: { title: '', source: 'category', columns: 4, limit: 24, showPrice: true },
    Cart: {},
    Checkout: { showTimeline: true },
    ThankYou: { showTimeline: true, showWhatsApp: true },
    AccountHub: {},
    OrdersList: {},
    OrderDetail: {},
    TrackingLookup: { title: 'Rastrear Pedido', description: 'Acompanhe o status da sua entrega' },
    BlogListing: { title: 'Blog', postsPerPage: 9, showExcerpt: true, showImage: true, showTags: true, showPagination: true },
    // AJUSTE 5: All slots enabled by default (showWhenEmpty: true) for demonstration
    CompreJuntoSlot: { title: 'Compre Junto', maxItems: 3, variant: 'normal', showWhenEmpty: true },
    CrossSellSlot: { title: 'Você também pode gostar', maxItems: 4, variant: 'normal', showWhenEmpty: true },
    OrderBumpSlot: { title: 'Aproveite', maxItems: 2, variant: 'compact', showWhenEmpty: true },
    UpsellSlot: { title: 'Oferta Especial', maxItems: 3, variant: 'normal', showWhenEmpty: true },
  };
  
  return defaults[blockType] || {};
}
