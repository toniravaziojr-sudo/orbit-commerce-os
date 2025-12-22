// =============================================
// CANONICAL REDIRECT GUARD - Ensures storefront uses canonical domain
// Automatically redirects from platform subdomain to custom domain when active
// =============================================

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCanonicalDomain } from '@/contexts/StorefrontConfigContext';
import { 
  isPlatformSubdomain, 
  SAAS_CONFIG, 
  getPlatformSubdomainUrl 
} from '@/lib/canonicalDomainService';
import { 
  recordRedirectAndCheckLoop, 
  clearRedirectHistory, 
  reportViolation,
  getCurrentHost,
} from '@/lib/urlGuards';

interface CanonicalRedirectGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that ensures the user is on the canonical domain.
 * - If on platform subdomain and custom domain is active → redirects to custom domain
 * - Detects and prevents redirect loops
 * - Reports violations for telemetry
 */
export function CanonicalRedirectGuard({ children }: CanonicalRedirectGuardProps) {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const { customDomain } = useCanonicalDomain();
  const [shouldRender, setShouldRender] = useState(true);
  
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    const currentHost = getCurrentHost();
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    
    // Skip if no custom domain is active
    if (!customDomain) {
      clearRedirectHistory();
      return;
    }
    
    const normalizedCustomDomain = customDomain.toLowerCase().replace(/^www\./, '');
    
    // If already on custom domain, we're good
    if (currentHost === normalizedCustomDomain) {
      clearRedirectHistory();
      return;
    }
    
    // Check if we're on the platform subdomain for this tenant
    const platformHost = `${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}.${SAAS_CONFIG.domain}`;
    const isOnPlatformSubdomain = isPlatformSubdomain(currentHost) && currentHost === platformHost;
    
    if (!isOnPlatformSubdomain) {
      // Not on platform subdomain, don't redirect
      return;
    }
    
    // Build redirect URL
    // Remove preview params for public redirects
    const cleanSearch = new URLSearchParams(currentSearch);
    cleanSearch.delete('preview');
    cleanSearch.delete('previewId');
    cleanSearch.delete('draft');
    
    const queryString = cleanSearch.toString();
    const targetUrl = `https://${normalizedCustomDomain}${currentPath}${queryString ? `?${queryString}` : ''}`;
    
    // Check for redirect loop
    const isLoop = recordRedirectAndCheckLoop(targetUrl);
    
    if (isLoop) {
      console.error('[CanonicalRedirectGuard] Redirect loop detected, staying on current domain');
      reportViolation({
        type: 'redirect_loop',
        severity: 'critical',
        original: targetUrl,
        host: currentHost,
        path: currentPath,
      });
      clearRedirectHistory();
      return;
    }
    
    // Report the canonical redirect (info level for telemetry)
    console.log('[CanonicalRedirectGuard] Redirecting to canonical domain:', targetUrl);
    reportViolation({
      type: 'wrong_canonical_origin',
      severity: 'warning',
      original: `${window.location.protocol}//${currentHost}${currentPath}`,
      normalized: targetUrl,
      host: currentHost,
      path: currentPath,
    });
    
    // Hide content and redirect
    setShouldRender(false);
    window.location.replace(targetUrl);
    
  }, [customDomain, tenantSlug]);
  
  // Don't render children if we're about to redirect
  if (!shouldRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

export default CanonicalRedirectGuard;
