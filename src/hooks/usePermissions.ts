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
   */
  const canAccessRoute = (route: string): boolean => {
    // Platform operators always have access
    if (isPlatformOperator) return true;
    
    // Owners always have access
    if (isOwner) return true;

    // Command center is always accessible
    if (route === '/' || route === '/command-center') return true;

    // Find the route config
    const routeConfig = Object.entries(ROUTE_TO_PERMISSION).find(([path]) => {
      if (route === path) return true;
      // Check if route starts with path (for nested routes)
      if (route.startsWith(path + '/')) return true;
      return false;
    });

    if (!routeConfig) {
      // Route not in permission map - allow by default for unprotected routes
      return true;
    }

    const [, config] = routeConfig;
    
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
