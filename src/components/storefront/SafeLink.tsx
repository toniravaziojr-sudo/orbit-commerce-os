// =============================================
// SAFE LINK - URL-validated Link component for storefront
// Automatically validates URLs and blocks/normalizes violations
// =============================================

import React from 'react';
import { Link, LinkProps, useNavigate, useParams } from 'react-router-dom';
import { 
  validateStorefrontUrl, 
  normalizeStorefrontUrl, 
  reportViolation,
  type UrlViolation,
} from '@/lib/urlGuards';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';

interface SafeLinkProps extends Omit<LinkProps, 'to'> {
  to: string;
  /** Context for violation reporting (logged but not stored on violation object) */
  linkContext?: string;
  /** Fallback URL if the target is blocked */
  fallback?: string;
  /** Whether to skip validation (use sparingly) */
  skipValidation?: boolean;
}

/**
 * A Link component that validates URLs before navigation.
 * Use this instead of Link in all storefront components.
 */
export function SafeLink({
  to,
  linkContext,
  fallback,
  skipValidation = false,
  children,
  onClick,
  ...props
}: SafeLinkProps) {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const storefrontUrls = useStorefrontUrls(tenantSlug);
  const homeUrl = fallback || storefrontUrls.home();
  
  // Validate the URL
  const violation = skipValidation ? null : validateStorefrontUrl(to);
  
  // Determine final URL
  let finalUrl = to;
  let isCritical = false;
  
  if (violation) {
    // Report the violation
    if (linkContext) {
      console.warn(`[SafeLink] Violation in context "${linkContext}":`, violation);
    }
    reportViolation(violation);
    
    if (violation.severity === 'critical') {
      // Block critical violations - use home URL
      finalUrl = homeUrl;
      isCritical = true;
      
      if (import.meta.env.DEV) {
        console.error('[SafeLink] Blocked critical URL:', to, '→', homeUrl);
      }
    } else {
      // Try to normalize non-critical violations
      const { normalized } = normalizeStorefrontUrl(to, false);
      finalUrl = normalized;
    }
  }
  
  // Handle click with additional logging for blocked links
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isCritical && import.meta.env.DEV) {
      console.warn('[SafeLink] Critical violation blocked, redirecting to:', finalUrl);
    }
    onClick?.(e);
  };
  
  return (
    <Link to={finalUrl} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}

/**
 * Hook for safe navigation with URL validation
 */
export function useSafeNavigate() {
  const navigate = useNavigate();
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const storefrontUrls = useStorefrontUrls(tenantSlug);
  const homeUrl = storefrontUrls.home();
  
  const safeNavigate = React.useCallback((
    url: string,
    options: { replace?: boolean; navContext?: string } = {}
  ) => {
    const violation = validateStorefrontUrl(url);
    
    if (violation) {
      if (options.navContext) {
        console.warn(`[useSafeNavigate] Violation in context "${options.navContext}":`, violation);
      }
      reportViolation(violation);
      
      if (violation.severity === 'critical') {
        console.error('[useSafeNavigate] Blocking navigation to:', url);
        navigate(homeUrl, { replace: options.replace });
        return;
      }
    }
    
    const { normalized, blocked } = normalizeStorefrontUrl(url, false);
    
    if (blocked) {
      navigate(homeUrl, { replace: options.replace });
      return;
    }
    
    navigate(normalized, { replace: options.replace });
  }, [navigate, homeUrl]);
  
  return safeNavigate;
}

export default SafeLink;
