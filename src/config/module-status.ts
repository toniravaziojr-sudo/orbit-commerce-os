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
  '/executions': 'pending',
  
  // E-commerce (Core Modules - Approved ✅)
  '/orders': 'ready',
  '/products': 'ready',
  '/categories': 'ready',
  '/customers': 'ready',
  '/discounts': 'pending',
  
  // Loja Online
  '/storefront': 'pending',
  '/abandoned-checkouts': 'pending',
  '/menus': 'ready',
  '/pages': 'pending',
  '/blog': 'pending',
  
  // Marketing
  '/marketing': 'pending',
  '/marketing/atribuicao': 'pending',
  '/offers': 'pending',
  '/reviews': 'pending',
  '/media': 'pending',
  '/campaigns': 'pending',
  
  // CRM
  '/notifications': 'pending',
  '/support': 'pending',
  '/emails': 'pending',
  
  // ERP
  '/fiscal': 'pending',
  '/finance': 'pending',
  '/purchases': 'pending',
  '/shipping': 'pending',
  
  // Sistema
  '/integrations': 'pending',
  '/import': 'pending',
  '/settings': 'pending',
  '/files': 'ready',
  '/marketplaces': 'pending',
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
