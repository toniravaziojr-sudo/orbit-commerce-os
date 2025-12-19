// =============================================
// CUSTOM DOMAIN RESOLVER - Component to handle custom domain root access
// Resolves hostname to tenant and redirects to /store/:tenantSlug
// =============================================

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PUBLIC_APP_ORIGIN } from '@/hooks/useTenantCanonicalDomain';

/**
 * Component that handles root access on custom domains
 * It resolves the hostname to find the tenant and redirects to the store
 */
export function CustomDomainResolver() {
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const resolveAndRedirect = async () => {
      const currentHost = window.location.host;
      const appHost = new URL(PUBLIC_APP_ORIGIN).host;

      // If we're on the default app host, redirect to auth
      if (currentHost === appHost) {
        setStatus('redirecting');
        window.location.replace('/auth');
        return;
      }

      // We're on a custom domain - try to resolve the tenant
      try {
        // Look up the domain in tenant_domains
        const { data: domainData, error: domainError } = await supabase
          .from('tenant_domains')
          .select('tenant_id, domain')
          .eq('domain', currentHost)
          .eq('status', 'verified')
          .eq('ssl_status', 'active')
          .maybeSingle();

        if (domainError) {
          console.error('[CustomDomainResolver] Domain lookup error:', domainError);
          setStatus('error');
          setErrorMessage('Erro ao resolver domínio');
          return;
        }

        if (!domainData) {
          // Try without www prefix
          const withoutWww = currentHost.replace(/^www\./, '');
          const { data: altDomainData, error: altError } = await supabase
            .from('tenant_domains')
            .select('tenant_id, domain')
            .eq('domain', withoutWww)
            .eq('status', 'verified')
            .eq('ssl_status', 'active')
            .maybeSingle();

          if (altError || !altDomainData) {
            setStatus('error');
            setErrorMessage('Domínio não encontrado');
            return;
          }

          // Found with alternate domain, use it
          Object.assign(domainData || {}, altDomainData);
        }

        // Now get the tenant slug
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('slug')
          .eq('id', domainData!.tenant_id)
          .single();

        if (tenantError || !tenantData) {
          console.error('[CustomDomainResolver] Tenant lookup error:', tenantError);
          setStatus('error');
          setErrorMessage('Loja não encontrada');
          return;
        }

        // Build redirect URL
        const targetPath = `/store/${tenantData.slug}`;
        
        // Preserve any path after root (but strip preview params)
        const currentPath = window.location.pathname;
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.delete('preview');
        searchParams.delete('previewId');
        searchParams.delete('draft');
        
        let finalPath = targetPath;
        if (currentPath && currentPath !== '/') {
          // If there's already a path, check if it already has /store/:slug
          if (!currentPath.startsWith('/store/')) {
            finalPath = targetPath + currentPath;
          } else {
            finalPath = currentPath;
          }
        }

        const queryString = searchParams.toString();
        const fullUrl = `${finalPath}${queryString ? `?${queryString}` : ''}`;

        console.log('[CustomDomainResolver] Redirecting to:', fullUrl);
        setStatus('redirecting');
        
        // Use replace to avoid adding to history
        window.location.replace(fullUrl);
      } catch (err) {
        console.error('[CustomDomainResolver] Unexpected error:', err);
        setStatus('error');
        setErrorMessage('Erro inesperado');
      }
    };

    resolveAndRedirect();
  }, []);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{errorMessage || 'Erro'}</h1>
          <p className="text-gray-600">Verifique se o endereço está correto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}
