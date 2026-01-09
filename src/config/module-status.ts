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
  '/': 'ready',
  '/executions': 'pending',
  
  // E-commerce
  '/orders': 'ready',
  '/products': 'ready',
  '/categories': 'ready',
  '/customers': 'ready',
  '/discounts': 'ready',
  
  // Loja Online
  '/storefront': 'ready',
  '/cart-checkout': 'ready',
  '/menus': 'ready',
  '/pages': 'ready',
  '/blog': 'ready',
  
  // Marketing
  '/marketing': 'ready',
  '/marketing/atribuicao': 'pending',
  '/offers': 'pending',
  '/reviews': 'pending',
  '/media': 'pending',
  '/campaigns': 'pending',
  
  // CRM
  '/notifications': 'pending',
  '/support': 'pending',
  '/emails': 'ready',
  
  // ERP
  '/fiscal': 'pending',
  '/finance': 'pending',
  '/purchases': 'pending',
  '/shipping': 'pending',
  
  // Sistema
  '/integrations': 'ready',
  '/import': 'ready',
  '/settings': 'ready',
  '/files': 'pending',
  '/marketplaces': 'pending',
  
  // Plataforma
  '/platform/health-monitor': 'ready',
  '/platform/integrations': 'ready',
  '/platform/block-suggestions': 'pending',
};

export function getModuleStatus(href: string): ModuleStatus | undefined {
  return MODULE_STATUS_MAP[href];
}
