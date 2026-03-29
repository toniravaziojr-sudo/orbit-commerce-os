/**
 * Module status configuration for the sidebar
 * Used to show status indicators in the special tenant (respeiteohomem)
 * 
 * Status values:
 * - 'ready': ✅ Module is 100% functional
 * - 'pending': 🟧 Module is pending/under construction
 */

export type ModuleStatus = 'ready' | 'pending';

export const MODULE_STATUS_MAP: Record<string, ModuleStatus> = {
  // Principal
  '/': 'pending',
  '/command-center': 'pending',
  '/chatgpt': 'ready',
  
  // E-commerce (Core Modules - Approved ✅)
  '/orders': 'ready',
  '/products': 'ready',
  '/categories': 'ready',
  '/customers': 'ready',
  
  // Loja Online
  '/storefront': 'ready',
  '/landing-pages': 'pending',
  '/abandoned-checkouts': 'ready',
  '/menus': 'ready',
  '/pages': 'ready',
  // Marketing Básico
  '/blog': 'ready',
  '/marketing': 'pending',
  '/marketing/atribuicao': 'pending',
  '/discounts': 'ready',
  '/offers': 'ready',
  
  // Marketing Avançado
  '/email-marketing': 'pending',
  '/quizzes': 'pending',
  '/media': 'ready',
  '/campaigns': 'pending',
  '/creatives': 'pending',
  
  // CRM
  '/notifications': 'ready',
  '/support': 'pending',
  '/ai-packages': 'pending',
  '/emails': 'ready',
  '/reviews': 'ready',
  
  // ERP
  '/fiscal': 'ready',
  '/finance': 'pending',
  '/purchases': 'ready',
  '/shipping': 'pending',
  
  // Sistema
  '/integrations': 'pending',
  '/import': 'ready',
  '/settings': 'pending',
  '/files': 'ready',
  '/reports': 'ready',
  '/marketplaces': 'pending',
  '/marketplaces/mercadolivre': 'pending',
  '/marketplaces/shopee': 'pending',
  '/marketplaces/tiktokshop': 'pending',
  '/system/users': 'ready',
  
  // Plataforma
  '/platform/health-monitor': 'pending',
  '/platform/integrations': 'pending',
  '/platform/block-suggestions': 'pending',
  '/platform/emails': 'ready',
};

export function getModuleStatus(href: string): ModuleStatus | undefined {
  return MODULE_STATUS_MAP[href];
}