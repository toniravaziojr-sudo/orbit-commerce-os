// =============================================
// DOMAIN DISABLED GUARD - Shows 404/410 when accessing disabled host
// POLICY: "Domínio muda, tudo muda" - SEM REDIRECTS
// When custom domain is active, platform subdomain shows "domain disabled"
// =============================================

import { useParams } from 'react-router-dom';
import { useCanonicalDomain } from '@/contexts/StorefrontConfigContext';
import { 
  getHostDisabledInfo, 
  reportViolation,
  getCurrentHost,
} from '@/lib/urlGuards';
import { AlertCircle } from 'lucide-react';

interface DomainDisabledGuardProps {
  children: React.ReactNode;
  tenantSlug?: string;
}

/**
 * Guard component that checks if the current host is disabled.
 * - If custom domain is active and user accesses via .shops subdomain → show "domain disabled"
 * - NO REDIRECTS - just blocks access and shows message
 * - Reports violation for telemetry
 */
export function DomainDisabledGuard({ children, tenantSlug }: DomainDisabledGuardProps) {
  const { tenantSlug: routeTenantSlug } = useParams<{ tenantSlug: string }>();
  const { customDomain } = useCanonicalDomain();
  
  const effectiveTenantSlug = tenantSlug || routeTenantSlug || '';
  
  // Check if current host is disabled
  const { isDisabled, canonicalHost } = getHostDisabledInfo(effectiveTenantSlug, customDomain);
  
  if (isDisabled && canonicalHost) {
    // Report the violation
    const currentHost = getCurrentHost();
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
    
    reportViolation({
      type: 'host_disabled',
      severity: 'critical',
      original: `${currentHost}${currentPath}`,
      normalized: `${canonicalHost}${currentPath}`,
      host: currentHost,
      path: currentPath,
    });
    
    // Show "domain disabled" page - NO REDIRECT
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-6">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Domínio desativado
          </h1>
          <p className="text-muted-foreground mb-6">
            Esta loja não está mais disponível neste endereço.
          </p>
          <p className="text-sm text-muted-foreground">
            Acesse através do endereço correto:
          </p>
          <p className="mt-2 font-medium text-primary">
            {canonicalHost}
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

export default DomainDisabledGuard;
