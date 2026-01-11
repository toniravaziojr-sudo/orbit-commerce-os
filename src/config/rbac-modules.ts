/**
 * RBAC Module Permissions Configuration
 * Defines all modules and submodules that can be controlled via permissions
 */

export interface ModuleConfig {
  key: string;
  label: string;
  description: string;
  submodules?: SubmoduleConfig[];
}

export interface SubmoduleConfig {
  key: string;
  label: string;
  route?: string; // If submodule has a specific route
}

// Map routes to permission keys for route guard
export const ROUTE_TO_PERMISSION: Record<string, { module: string; submodule?: string }> = {
  // E-commerce
  '/orders': { module: 'ecommerce', submodule: 'orders' },
  '/products': { module: 'ecommerce', submodule: 'products' },
  '/categories': { module: 'ecommerce', submodule: 'categories' },
  '/customers': { module: 'ecommerce', submodule: 'customers' },
  '/discounts': { module: 'ecommerce', submodule: 'discounts' },
  
  // Loja Online
  '/storefront': { module: 'storefront', submodule: 'storefront' },
  '/cart-checkout': { module: 'storefront', submodule: 'cart-checkout' },
  '/menus': { module: 'storefront', submodule: 'menus' },
  '/pages': { module: 'storefront', submodule: 'pages' },
  '/blog': { module: 'storefront', submodule: 'blog' },
  
  // Marketing
  '/marketing': { module: 'marketing', submodule: 'integrations' },
  '/marketing/atribuicao': { module: 'marketing', submodule: 'attribution' },
  '/offers': { module: 'marketing', submodule: 'offers' },
  '/reviews': { module: 'marketing', submodule: 'reviews' },
  '/media': { module: 'marketing', submodule: 'media' },
  '/campaigns': { module: 'marketing', submodule: 'campaigns' },
  
  // CRM
  '/notifications': { module: 'crm', submodule: 'notifications' },
  '/support': { module: 'crm', submodule: 'support' },
  '/emails': { module: 'crm', submodule: 'emails' },
  
  // ERP
  '/fiscal': { module: 'erp', submodule: 'fiscal' },
  '/finance': { module: 'erp', submodule: 'finance' },
  '/purchases': { module: 'erp', submodule: 'purchases' },
  '/shipping': { module: 'erp', submodule: 'shipping' },
  
  // Parcerias
  '/influencers': { module: 'partnerships', submodule: 'influencers' },
  '/suppliers': { module: 'partnerships', submodule: 'suppliers' },
  '/affiliates': { module: 'partnerships', submodule: 'affiliates' },
  
  // Marketplaces
  '/marketplaces/mercadolivre': { module: 'marketplaces', submodule: 'mercadolivre' },
  
  // Sistema
  '/integrations': { module: 'system', submodule: 'integrations' },
  '/import': { module: 'system', submodule: 'import' },
  '/files': { module: 'system', submodule: 'files' },
  '/settings': { module: 'system', submodule: 'settings' },
  '/system/users': { module: 'system', submodule: 'users' }, // Owner only
};

// Module configurations with submodules
export const MODULES: ModuleConfig[] = [
  {
    key: 'ecommerce',
    label: 'E-commerce',
    description: 'Pedidos, produtos, categorias, clientes e descontos',
    submodules: [
      { key: 'orders', label: 'Pedidos', route: '/orders' },
      { key: 'products', label: 'Produtos', route: '/products' },
      { key: 'categories', label: 'Categorias', route: '/categories' },
      { key: 'customers', label: 'Clientes', route: '/customers' },
      { key: 'discounts', label: 'Descontos', route: '/discounts' },
    ],
  },
  {
    key: 'storefront',
    label: 'Loja Online',
    description: 'Loja virtual, checkout, menus, páginas e blog',
    submodules: [
      { key: 'storefront', label: 'Loja Virtual', route: '/storefront' },
      { key: 'cart-checkout', label: 'Carrinho e Checkout', route: '/cart-checkout' },
      { key: 'menus', label: 'Menus', route: '/menus' },
      { key: 'pages', label: 'Páginas da Loja', route: '/pages' },
      { key: 'blog', label: 'Blog', route: '/blog' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description: 'Integrações, atribuição, ofertas, avaliações e campanhas',
    submodules: [
      { key: 'integrations', label: 'Integrações Marketing', route: '/marketing' },
      { key: 'attribution', label: 'Atribuição de Venda', route: '/marketing/atribuicao' },
      { key: 'offers', label: 'Aumentar Ticket', route: '/offers' },
      { key: 'reviews', label: 'Avaliações', route: '/reviews' },
      { key: 'media', label: 'Gestão de Mídias', route: '/media' },
      { key: 'campaigns', label: 'Criador de Campanhas', route: '/campaigns' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    description: 'Notificações, atendimento e emails',
    submodules: [
      { key: 'notifications', label: 'Notificações', route: '/notifications' },
      { key: 'support', label: 'Atendimento', route: '/support' },
      { key: 'emails', label: 'Emails', route: '/emails' },
    ],
  },
  {
    key: 'erp',
    label: 'ERP',
    description: 'Fiscal, financeiro, compras e logística',
    submodules: [
      { key: 'fiscal', label: 'Fiscal', route: '/fiscal' },
      { key: 'finance', label: 'Financeiro', route: '/finance' },
      { key: 'purchases', label: 'Compras', route: '/purchases' },
      { key: 'shipping', label: 'Logística', route: '/shipping' },
    ],
  },
  {
    key: 'partnerships',
    label: 'Parcerias',
    description: 'Influencers, fornecedores e afiliados',
    submodules: [
      { key: 'influencers', label: 'Influencers', route: '/influencers' },
      { key: 'suppliers', label: 'Fornecedores', route: '/suppliers' },
      { key: 'affiliates', label: 'Afiliados', route: '/affiliates' },
    ],
  },
  {
    key: 'marketplaces',
    label: 'Marketplaces',
    description: 'Integrações com marketplaces',
    submodules: [
      { key: 'mercadolivre', label: 'Mercado Livre', route: '/marketplaces/mercadolivre' },
    ],
  },
  {
    key: 'system',
    label: 'Sistema',
    description: 'Integrações, importação, arquivos e configurações',
    submodules: [
      { key: 'integrations', label: 'Integrações', route: '/integrations' },
      { key: 'import', label: 'Importar Dados', route: '/import' },
      { key: 'files', label: 'Meu Drive', route: '/files' },
      { key: 'settings', label: 'Configurações', route: '/settings' },
    ],
  },
];

// User type presets with default permissions
export const USER_TYPE_PRESETS: Record<string, {
  label: string;
  description: string;
  permissions: Record<string, boolean | Record<string, boolean>>;
}> = {
  manager: {
    label: 'Gerente',
    description: 'Acesso total a todas as áreas, exceto configurações de usuários',
    permissions: {
      ecommerce: true,
      storefront: true,
      marketing: true,
      crm: true,
      erp: true,
      partnerships: true,
      marketplaces: true,
      system: {
        integrations: true,
        import: true,
        files: true,
        settings: true,
      },
    },
  },
  editor: {
    label: 'Editor',
    description: 'Gerencia conteúdo: produtos, loja online, blog e marketing',
    permissions: {
      ecommerce: {
        products: true,
        categories: true,
      },
      storefront: true,
      marketing: {
        media: true,
        campaigns: true,
      },
      system: {
        files: true,
      },
    },
  },
  attendant: {
    label: 'Atendente',
    description: 'Foco em atendimento ao cliente e pedidos',
    permissions: {
      ecommerce: {
        orders: true,
        customers: true,
      },
      crm: {
        support: true,
        emails: true,
      },
    },
  },
  assistant: {
    label: 'Auxiliar',
    description: 'Suporte operacional: pedidos, estoque e logística',
    permissions: {
      ecommerce: {
        orders: true,
        products: true,
      },
      erp: {
        shipping: true,
        purchases: true,
      },
    },
  },
  viewer: {
    label: 'Visualizador',
    description: 'Apenas visualização, sem permissão de edição',
    permissions: {
      ecommerce: {
        orders: true,
        products: true,
        customers: true,
      },
    },
  },
};

// Helper to check if a permission is granted
export function hasPermission(
  permissions: Record<string, boolean | Record<string, boolean>> | undefined,
  moduleKey: string,
  submoduleKey?: string
): boolean {
  if (!permissions) return false;

  const modulePermission = permissions[moduleKey];
  
  // If no permission for this module at all
  if (modulePermission === undefined) return false;
  
  // If module permission is a boolean (full access or no access)
  if (typeof modulePermission === 'boolean') {
    return modulePermission;
  }
  
  // If module permission is an object (granular submodule permissions)
  if (typeof modulePermission === 'object') {
    // If no specific submodule requested, check if any submodule is allowed
    if (!submoduleKey) {
      return Object.values(modulePermission).some(v => v === true);
    }
    // Check specific submodule
    return modulePermission[submoduleKey] === true;
  }
  
  return false;
}

// Helper to get all allowed routes for a set of permissions
export function getAllowedRoutes(
  permissions: Record<string, boolean | Record<string, boolean>> | undefined
): string[] {
  if (!permissions) return [];
  
  const allowedRoutes: string[] = [];
  
  for (const [route, config] of Object.entries(ROUTE_TO_PERMISSION)) {
    if (hasPermission(permissions, config.module, config.submodule)) {
      allowedRoutes.push(route);
    }
  }
  
  return allowedRoutes;
}
