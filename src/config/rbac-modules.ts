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
// IMPORTANT: All protected routes MUST be listed here, otherwise they will be blocked
export const ROUTE_TO_PERMISSION: Record<string, { module: string; submodule?: string }> = {
  // E-commerce
  '/orders': { module: 'ecommerce', submodule: 'orders' },
  '/products': { module: 'ecommerce', submodule: 'products' },
  '/customers': { module: 'ecommerce', submodule: 'customers' },
  '/abandoned-checkouts': { module: 'ecommerce', submodule: 'abandoned-checkouts' },
  
  // Loja Online
  '/storefront': { module: 'storefront', submodule: 'storefront' },
  '/landing-pages': { module: 'storefront', submodule: 'landing-pages' },
  '/categories': { module: 'storefront', submodule: 'categories' },
  '/menus': { module: 'storefront', submodule: 'menus' },
  '/pages': { module: 'storefront', submodule: 'pages' },
  '/page-templates': { module: 'storefront', submodule: 'pages' },
  
  // Blog (under Marketing Básico)
  '/blog': { module: 'marketing', submodule: 'blog' },
  '/blog/campaigns': { module: 'marketing', submodule: 'blog' },
  
  // Marketing
  '/marketing': { module: 'marketing', submodule: 'integrations' },
  '/marketing/atribuicao': { module: 'marketing', submodule: 'attribution' },
  '/email-marketing': { module: 'marketing', submodule: 'email-marketing' },
  '/discounts': { module: 'marketing', submodule: 'discounts' },
  '/offers': { module: 'marketing', submodule: 'offers' },
  '/media': { module: 'marketing', submodule: 'media' },
  '/campaigns': { module: 'marketing', submodule: 'campaigns' },
  
  // CRM
  '/notifications': { module: 'crm', submodule: 'notifications' },
  '/support': { module: 'crm', submodule: 'support' },
  '/emails': { module: 'crm', submodule: 'emails' },
  '/reviews': { module: 'crm', submodule: 'reviews' },
  
  // ERP
  '/fiscal': { module: 'erp', submodule: 'fiscal' },
  '/finance': { module: 'erp', submodule: 'finance' },
  '/purchases': { module: 'erp', submodule: 'purchases' },
  '/shipping': { module: 'erp', submodule: 'shipping' },
  
  // Parcerias
  '/influencers': { module: 'partnerships', submodule: 'influencers' },
  
  '/affiliates': { module: 'partnerships', submodule: 'affiliates' },
  
  // Marketplaces
  '/marketplaces': { module: 'marketplaces' },
  '/marketplaces/mercadolivre': { module: 'marketplaces', submodule: 'mercadolivre' },
  '/marketplaces/shopee': { module: 'marketplaces', submodule: 'shopee' },
  '/marketplaces/tiktokshop': { module: 'marketplaces', submodule: 'tiktokshop' },
  '/marketplaces/olist': { module: 'marketplaces', submodule: 'olist' },
  
  // Sistema
  '/integrations': { module: 'system', submodule: 'integrations' },
  '/import': { module: 'system', submodule: 'import' },
  '/files': { module: 'utilities', submodule: 'files' },
  '/reports': { module: 'utilities', submodule: 'reports' },
  
  '/settings': { module: 'system', submodule: 'settings' },
  '/settings/domains': { module: 'system', submodule: 'settings' },
  '/settings/billing': { module: 'system', submodule: 'settings' },
  '/system/users': { module: 'system', submodule: 'users' }, // Owner only
  '/support-center': { module: 'system', submodule: 'support-center' }, // Support center for platform help
  '/ai-packages': { module: 'system', submodule: 'ai-packages' }, // AI packages for tenants
  
  // Platform routes (platform admins only - but checked in code)
  '/platform/integrations': { module: 'platform' },
  '/platform/health-monitor': { module: 'platform' },
  '/platform/block-suggestions': { module: 'platform' },
  '/platform/billing': { module: 'platform' },
  '/platform/announcements': { module: 'platform' },
  '/platform/tutorials': { module: 'platform' },
  
  // Getting started (always accessible to members)
  '/getting-started': { module: 'ecommerce' }, // Mapped to ecommerce so viewers can see it
};

// Module configurations with submodules
export const MODULES: ModuleConfig[] = [
  {
    key: 'ecommerce',
    label: 'E-commerce',
    description: 'Pedidos, produtos, clientes e checkout abandonado',
    submodules: [
      { key: 'orders', label: 'Pedidos', route: '/orders' },
      { key: 'abandoned-checkouts', label: 'Checkout Abandonado', route: '/abandoned-checkouts' },
      { key: 'products', label: 'Produtos', route: '/products' },
      { key: 'customers', label: 'Clientes', route: '/customers' },
    ],
  },
  {
    key: 'storefront',
    label: 'Loja Online',
    description: 'Loja virtual, landing pages, categorias, menus e páginas',
    submodules: [
      { key: 'storefront', label: 'Loja Virtual', route: '/storefront' },
      { key: 'landing-pages', label: 'Landing Pages', route: '/landing-pages' },
      { key: 'categories', label: 'Categorias', route: '/categories' },
      { key: 'menus', label: 'Menus', route: '/menus' },
      { key: 'pages', label: 'Páginas da Loja', route: '/pages' },
    ],
  },
  {
    key: 'marketing-basic',
    label: 'Marketing Básico',
    description: 'Blog, integrações, atribuição, descontos e ofertas',
    submodules: [
      { key: 'blog', label: 'Blog', route: '/blog' },
      { key: 'integrations', label: 'Integrações Marketing', route: '/marketing' },
      { key: 'attribution', label: 'Atribuição de Venda', route: '/marketing/atribuicao' },
      { key: 'discounts', label: 'Descontos', route: '/discounts' },
      { key: 'offers', label: 'Aumentar Ticket', route: '/offers' },
    ],
  },
  {
    key: 'marketing-advanced',
    label: 'Marketing Avançado',
    description: 'Email marketing, quizzes, gestor de mídias, tráfego e criativos IA',
    submodules: [
      { key: 'email-marketing', label: 'Email Marketing', route: '/email-marketing' },
      { key: 'quizzes', label: 'Quizzes', route: '/quizzes' },
      { key: 'media', label: 'Gestor de Mídias IA', route: '/media' },
      { key: 'campaigns', label: 'Gestor de Tráfego IA', route: '/campaigns' },
      { key: 'creatives', label: 'Gestão de Criativos', route: '/creatives' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    description: 'Notificações, atendimento, emails e avaliações',
    submodules: [
      { key: 'notifications', label: 'Notificações', route: '/notifications' },
      { key: 'support', label: 'Atendimento', route: '/support' },
      { key: 'emails', label: 'Emails', route: '/emails' },
      { key: 'reviews', label: 'Avaliações', route: '/reviews' },
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
    description: 'Influencers e afiliados',
    submodules: [
      { key: 'influencers', label: 'Influencers', route: '/influencers' },
      
      { key: 'affiliates', label: 'Afiliados', route: '/affiliates' },
    ],
  },
  {
    key: 'marketplaces',
    label: 'Marketplaces',
    description: 'Integrações com marketplaces',
    submodules: [
      { key: 'mercadolivre', label: 'Mercado Livre', route: '/marketplaces/mercadolivre' },
      { key: 'shopee', label: 'Shopee', route: '/marketplaces/shopee' },
      { key: 'tiktokshop', label: 'TikTok Shop', route: '/marketplaces/tiktokshop' },
      { key: 'olist', label: 'Olist', route: '/marketplaces/olist' },
    ],
  },
  {
    key: 'system',
    label: 'Sistema',
    description: 'Integrações, importação e configurações',
    submodules: [
      { key: 'integrations', label: 'Integrações', route: '/integrations' },
      { key: 'import', label: 'Importar Dados', route: '/import' },
      { key: 'settings', label: 'Configurações', route: '/settings' },
      { key: 'support-center', label: 'Suporte', route: '/support-center' },
      { key: 'ai-packages', label: 'Pacotes IA', route: '/ai-packages' },
    ],
  },
  {
    key: 'utilities',
    label: 'Utilitários',
    description: 'Meu Drive e Relatórios',
    submodules: [
      { key: 'files', label: 'Meu Drive', route: '/files' },
      { key: 'reports', label: 'Relatórios', route: '/reports' },
      
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
        settings: true,
      },
      utilities: true,
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
      utilities: {
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
