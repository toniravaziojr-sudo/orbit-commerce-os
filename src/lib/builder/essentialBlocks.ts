// =============================================
// ESSENTIAL BLOCKS - Blocks that cannot be deleted
// per page template type
// =============================================

/**
 * Essential blocks are blocks that are fundamental to the page type
 * and cannot be deleted by the user in the Builder.
 * 
 * These blocks can only be:
 * - Edited (props)
 * - Hidden (via toggle when applicable)
 * - Restored via "Restaurar padrão" action
 * 
 * RULE: Only blocks that can be re-added via BlockPalette can be deleted.
 * Essential blocks provide core functionality that would break the page
 * if removed.
 */

export interface EssentialBlockConfig {
  // Block types that are essential for this page type
  essentialTypes: string[];
  // Human-readable reason for each essential block type
  reasons: Record<string, string>;
}

/**
 * Essential blocks by page type
 * 
 * Product: ProductDetails is essential - provides main product info
 * Category: ProductGrid with category source is essential - shows products
 * Cart: CartSummary is essential - shows cart contents
 * Checkout: CheckoutSteps is essential - checkout flow
 * 
 * All pages: Header and Footer are essential for navigation
 */
export const ESSENTIAL_BLOCKS_BY_PAGE_TYPE: Record<string, EssentialBlockConfig> = {
  home: {
    essentialTypes: ['Header', 'Footer'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
    },
  },
  product: {
    essentialTypes: ['Header', 'Footer', 'ProductDetails'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
      'ProductDetails': 'O bloco de detalhes do produto é essencial para exibir informações do produto',
    },
  },
  category: {
    essentialTypes: ['Header', 'Footer', 'ProductGrid'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
      'ProductGrid': 'A grade de produtos é essencial para exibir os produtos da categoria',
    },
  },
  cart: {
    essentialTypes: ['Header', 'Footer', 'Cart'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
      'Cart': 'O carrinho é essencial para exibir os itens',
    },
  },
  checkout: {
    essentialTypes: ['Header', 'Footer', 'Checkout'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
      'Checkout': 'O checkout é essencial para o fluxo de compra',
    },
  },
  thank_you: {
    essentialTypes: ['Header', 'Footer', 'ThankYou'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
      'ThankYou': 'A confirmação de pedido é essencial para informar o cliente',
    },
  },
  // Institutional and landing pages have no essential blocks besides Header/Footer
  institutional: {
    essentialTypes: ['Header', 'Footer'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
    },
  },
  landing_page: {
    essentialTypes: [],
    reasons: {},
  },
  neutral: {
    essentialTypes: [],
    reasons: {},
  },
  // Account pages
  account: {
    essentialTypes: ['Header', 'Footer', 'AccountHub'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
      'AccountHub': 'O hub de conta é essencial para acessar funcionalidades do cliente',
    },
  },
  account_orders: {
    essentialTypes: ['Header', 'Footer', 'OrdersList'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
      'OrdersList': 'A lista de pedidos é essencial para exibir pedidos do cliente',
    },
  },
  account_order_detail: {
    essentialTypes: ['Header', 'Footer', 'OrderDetail'],
    reasons: {
      'Header': 'O cabeçalho é essencial para navegação',
      'Footer': 'O rodapé é essencial para informações da loja',
      'OrderDetail': 'O detalhe do pedido é essencial para exibir informações do pedido',
    },
  },
};

/**
 * Check if a block type is essential for a given page type
 */
export function isEssentialBlock(blockType: string, pageType: string): boolean {
  const config = ESSENTIAL_BLOCKS_BY_PAGE_TYPE[pageType];
  if (!config) return false;
  return config.essentialTypes.includes(blockType);
}

/**
 * Get the reason why a block is essential (for tooltips)
 */
export function getEssentialBlockReason(blockType: string, pageType: string): string | null {
  const config = ESSENTIAL_BLOCKS_BY_PAGE_TYPE[pageType];
  if (!config) return null;
  return config.reasons[blockType] || null;
}

/**
 * Get all essential block types for a page type
 */
export function getEssentialBlockTypes(pageType: string): string[] {
  const config = ESSENTIAL_BLOCKS_BY_PAGE_TYPE[pageType];
  if (!config) return [];
  return config.essentialTypes;
}

/**
 * Check if the current template is missing any essential blocks
 * Returns array of missing essential block types
 */
export function getMissingEssentialBlocks(
  pageType: string,
  blockTypes: string[]
): string[] {
  const essentialTypes = getEssentialBlockTypes(pageType);
  return essentialTypes.filter(type => !blockTypes.includes(type));
}

/**
 * Recursively collect all block types in a template
 */
export function collectBlockTypes(node: { type: string; children?: any[] }): string[] {
  const types: string[] = [node.type];
  if (node.children) {
    for (const child of node.children) {
      types.push(...collectBlockTypes(child));
    }
  }
  return types;
}
