import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';
import { hasPermission, ROUTE_TO_PERMISSION } from '@/config/rbac-modules';

export interface UserRole {
  id: string;
  user_id: string;
  tenant_id: string;
  role: 'owner' | 'admin' | 'operator' | 'support' | 'finance' | 'viewer';
  user_type?: 'owner' | 'manager' | 'editor' | 'attendant' | 'assistant' | 'viewer';
  permissions?: Record<string, boolean | Record<string, boolean>>;
}

export function usePermissions() {
  const { currentTenant, userRoles } = useAuth();
  const { isPlatformOperator } = usePlatformOperator();

  // Get the current user's role for the active tenant
  const currentRole = useMemo(() => {
    if (!currentTenant) return null;
    return userRoles.find(r => r.tenant_id === currentTenant.id) as UserRole | undefined;
  }, [currentTenant, userRoles]);

  // Check if user is owner of current tenant
  const isOwner = useMemo(() => {
    return currentRole?.role === 'owner';
  }, [currentRole]);

  // Get user type (owner, manager, etc.)
  const userType = useMemo(() => {
    if (isOwner) return 'owner';
    return currentRole?.user_type || 'viewer';
  }, [isOwner, currentRole]);

  // Get permissions object
  const permissions = useMemo(() => {
    // Owner has all permissions
    if (isOwner) return null; // null = unlimited access
    return (currentRole as any)?.permissions || {};
  }, [isOwner, currentRole]);

  /**
   * Check if user can access a specific module/submodule
   * Platform admins and owners always have access
   */
  const canAccess = (moduleKey: string, submoduleKey?: string): boolean => {
    // Platform operators always have access
    if (isPlatformOperator) return true;
    
    // Owners always have access
    if (isOwner) return true;
    
    // Check permissions
    return hasPermission(permissions, moduleKey, submoduleKey);
  };

  /**
   * Check if user can access a specific route
   * Routes not in ROUTE_TO_PERMISSION should be BLOCKED by default (unless whitelisted)
   */
  const canAccessRoute = (route: string): boolean => {
    // Platform operators always have access
    if (isPlatformOperator) return true;
    
    // Owners always have access
    if (isOwner) return true;

    // Command center and root are always accessible
    if (route === '/' || route === '/command-center') return true;
    
    // Account routes are always accessible
    if (route.startsWith('/account/')) return true;
    
    // Getting started is always accessible
    if (route === '/getting-started') return true;
    
    // Dev routes (only for development)
    if (route.startsWith('/dev/')) return true;

    // Find the route config - try exact match first, then prefix match
    let routeConfig: [string, { module: string; submodule?: string }] | undefined;
    
    // First try exact match
    if (ROUTE_TO_PERMISSION[route]) {
      routeConfig = [route, ROUTE_TO_PERMISSION[route]];
    } else {
      // Then try prefix match (for nested routes like /orders/123)
      routeConfig = Object.entries(ROUTE_TO_PERMISSION).find(([path]) => {
        return route.startsWith(path + '/');
      });
    }

    if (!routeConfig) {
      // Route not in permission map - BLOCK by default for security
      console.log(`[usePermissions] Route "${route}" not in permission map - blocking`);
      return false;
    }

    const [, config] = routeConfig;
    
    // Platform routes are only for platform operators (already checked above)
    if (config.module === 'platform') {
      return isPlatformOperator;
    }
    
    // Special case: system/users is owner-only
    if (config.module === 'system' && config.submodule === 'users') {
      return isOwner;
    }

    return hasPermission(permissions, config.module, config.submodule);
  };

  /**
   * Check if a sidebar item should be visible
   */
  const isSidebarItemVisible = (href: string): boolean => {
    return canAccessRoute(href);
  };

  return {
    isOwner,
    userType,
    permissions,
    canAccess,
    canAccessRoute,
    isSidebarItemVisible,
    isPlatformOperator,
  };
}
