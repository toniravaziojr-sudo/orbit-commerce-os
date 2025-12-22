// =============================================
// SAFE NAVIGATION HOOK
// Provides navigation functions that validate URLs and handle violations
// =============================================

import { useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  validateStorefrontUrl,
  normalizeStorefrontUrl,
  reportViolation,
  getSafeLinkHref,
  type UrlViolation,
} from '@/lib/urlGuards';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';

export interface SafeNavigationOptions {
  replace?: boolean;
  report?: boolean;
}

export interface UseSafeNavigationReturn {
  safeNavigate: (url: string, options?: SafeNavigationOptions) => void;
  getSafeHref: (url: string) => string;
  isUrlSafe: (url: string) => boolean;
  validateUrl: (url: string) => UrlViolation | null;
  currentPath: string;
}

/**
 * Hook for safe navigation in storefront contexts
 * Validates URLs and handles violations automatically
 */
export function useSafeNavigation(): UseSafeNavigationReturn {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const { currentTenant } = useAuth();
  const storefrontUrls = useStorefrontUrls(tenantSlug);
  
  const tenantId = currentTenant?.id;
  const homeUrl = storefrontUrls.home();

  const safeNavigate = useCallback((
    url: string, 
    options: SafeNavigationOptions = {}
  ) => {
    const { replace = false, report = true } = options;
    
    const violation = validateStorefrontUrl(url);
    
    if (violation) {
      if (report) {
        reportViolation(violation, tenantId);
      }
      
      // Block critical violations
      if (violation.severity === 'critical') {
        console.error('[useSafeNavigation] Blocking navigation to:', url);
        navigate(homeUrl, { replace });
        return;
      }
    }
    
    // Try to normalize (pass boolean allowCritical=false)
    const { normalized, wasModified } = normalizeStorefrontUrl(url, false);
    navigate(wasModified ? normalized : url, { replace });
  }, [navigate, homeUrl, tenantId]);

  const getSafeHrefCallback = useCallback((url: string) => {
    return getSafeLinkHref(url, homeUrl);
  }, [homeUrl]);

  const isUrlSafe = useCallback((url: string) => {
    const violation = validateStorefrontUrl(url);
    return !violation || violation.severity !== 'critical';
  }, []);

  const validateUrl = useCallback((url: string) => {
    return validateStorefrontUrl(url);
  }, []);

  return {
    safeNavigate,
    getSafeHref: getSafeHrefCallback,
    isUrlSafe,
    validateUrl,
    currentPath: location.pathname,
  };
}
