import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { normalizeDomain, generateVerificationToken } from '@/lib/normalizeDomain';
import { SAAS_CONFIG, getPlatformSubdomainUrl } from '@/lib/canonicalDomainService';

export interface TenantDomain {
  id: string;
  tenant_id: string;
  domain: string;
  type: 'platform_subdomain' | 'custom';
  is_primary: boolean;
  status: 'pending' | 'verified' | 'failed';
  verification_token: string;
  verified_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  ssl_status: 'none' | 'pending' | 'active' | 'failed';
  external_id: string | null;
  target_hostname: string;
}

// Default SaaS hostname for CNAME target (fallback origin for Cloudflare Custom Hostnames)
export const DEFAULT_TARGET_HOSTNAME = SAAS_CONFIG.targetHostname;

// Get the platform subdomain URL for a tenant
export { getPlatformSubdomainUrl };

export function useTenantDomains() {
  const { currentTenant } = useAuth();
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    if (!currentTenant?.id) {
      setDomains([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tenant_domains')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Map data with defaults for new fields
      const mappedDomains = (data || []).map(d => ({
        ...d,
        type: d.type || 'custom',
        ssl_status: d.ssl_status || 'none',
        external_id: d.external_id || null,
        target_hostname: d.target_hostname || DEFAULT_TARGET_HOSTNAME,
      })) as TenantDomain[];
      
      setDomains(mappedDomains);
    } catch (error) {
      console.error('Error fetching domains:', error);
      toast.error('Erro ao carregar domínios');
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // Add a custom domain (requires DNS verification + SSL via Cloudflare for SaaS)
  const addDomain = async (rawDomain: string): Promise<TenantDomain | null> => {
    if (!currentTenant?.id) {
      toast.error('Tenant não encontrado');
      return null;
    }

    const domain = normalizeDomain(rawDomain);
    const verification_token = generateVerificationToken();

    try {
      const { data, error } = await supabase
        .from('tenant_domains')
        .insert({
          tenant_id: currentTenant.id,
          domain,
          type: 'custom',
          verification_token,
          status: 'pending',
          is_primary: false,
          ssl_status: 'none',
          target_hostname: DEFAULT_TARGET_HOSTNAME,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Este domínio já está cadastrado');
        } else {
          throw error;
        }
        return null;
      }

      toast.success('Domínio adicionado com sucesso');
      await fetchDomains();
      return data as TenantDomain;
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error('Erro ao adicionar domínio');
      return null;
    }
  };

  // Verify DNS for custom domains
  const verifyDomain = async (domainId: string): Promise<boolean> => {
    if (!currentTenant?.id) return false;

    setIsVerifying(domainId);
    
    try {
      const { data, error } = await supabase.functions.invoke('domains-verify', {
        body: { tenant_id: currentTenant.id, domain_id: domainId },
      });

      if (error) throw error;

      await fetchDomains();

      if (data.verified) {
        toast.success('Domínio verificado com sucesso!');
        return true;
      } else {
        toast.info(data.error || 'Verificação pendente. O DNS pode levar alguns minutos para propagar.');
        return false;
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error('Erro ao verificar domínio');
      return false;
    } finally {
      setIsVerifying(null);
    }
  };

  // Provision SSL for custom domains (via Cloudflare for SaaS / Custom Hostnames)
  const provisionSSL = async (domainId: string): Promise<boolean> => {
    if (!currentTenant?.id) return false;

    setIsProvisioning(domainId);
    
    try {
      const { data, error } = await supabase.functions.invoke('domains-provision', {
        body: { 
          tenant_id: currentTenant.id, 
          domain_id: domainId,
          action: 'provision'
        },
      });

      if (error) throw error;

      await fetchDomains();

      if (data.ssl_status === 'active') {
        toast.success('SSL ativado com sucesso!');
        return true;
      } else if (data.ssl_status === 'pending') {
        toast.info('SSL sendo provisionado. Aguarde alguns minutos e verifique novamente.');
        return true;
      } else {
        toast.error(data.error || 'Erro ao provisionar SSL');
        return false;
      }
    } catch (error) {
      console.error('Error provisioning SSL:', error);
      toast.error('Erro ao ativar SSL. Verifique se as credenciais do Cloudflare estão configuradas.');
      return false;
    } finally {
      setIsProvisioning(null);
    }
  };

  // Check SSL status for custom domains
  const checkSSLStatus = async (domainId: string): Promise<boolean> => {
    if (!currentTenant?.id) return false;

    setIsProvisioning(domainId);
    
    try {
      const { data, error } = await supabase.functions.invoke('domains-provision', {
        body: { 
          tenant_id: currentTenant.id, 
          domain_id: domainId,
          action: 'check_status'
        },
      });

      if (error) throw error;

      await fetchDomains();

      if (data.ssl_status === 'active') {
        toast.success('SSL está ativo!');
        return true;
      } else if (data.ssl_status === 'pending') {
        toast.info('SSL ainda sendo provisionado. Tente novamente em alguns minutos.');
        return false;
      } else {
        toast.error(data.last_error || 'Erro no SSL. Verifique a configuração DNS.');
        return false;
      }
    } catch (error) {
      console.error('Error checking SSL status:', error);
      toast.error('Erro ao verificar status do SSL');
      return false;
    } finally {
      setIsProvisioning(null);
    }
  };

  const setPrimaryDomain = async (domainId: string): Promise<boolean> => {
    if (!currentTenant?.id) return false;

    const domain = domains.find(d => d.id === domainId);
    if (!domain) {
      toast.error('Domínio não encontrado');
      return false;
    }

    if (domain.status !== 'verified') {
      toast.error('Apenas domínios verificados podem ser definidos como principal');
      return false;
    }

    // For custom domains, require SSL to be active
    if (domain.type === 'custom' && domain.ssl_status !== 'active') {
      toast.error('Ative o SSL antes de definir como principal');
      return false;
    }

    try {
      // First, unset any existing primary
      await supabase
        .from('tenant_domains')
        .update({ is_primary: false })
        .eq('tenant_id', currentTenant.id)
        .eq('is_primary', true);

      // Then set the new primary
      const { error } = await supabase
        .from('tenant_domains')
        .update({ is_primary: true })
        .eq('id', domainId);

      if (error) throw error;

      toast.success('Domínio principal atualizado');
      await fetchDomains();
      return true;
    } catch (error) {
      console.error('Error setting primary domain:', error);
      toast.error('Erro ao definir domínio principal');
      return false;
    }
  };

  const removeDomain = async (domainId: string, forceRemovePrimary: boolean = false): Promise<boolean> => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) {
      toast.error('Domínio não encontrado');
      return false;
    }

    // Se é principal e não foi forçado, verificar se há outros domínios custom
    if (domain.is_primary && !forceRemovePrimary) {
      const otherCustomDomains = domains.filter(d => d.id !== domainId && d.type === 'custom');
      if (otherCustomDomains.length > 0) {
        toast.error('Defina outro domínio como principal antes de remover este.');
        return false;
      }
    }

    try {
      // For custom domains with external_id, try to delete from Cloudflare first
      if (domain.type === 'custom' && domain.external_id && currentTenant?.id) {
        await supabase.functions.invoke('domains-provision', {
          body: { 
            tenant_id: currentTenant.id, 
            domain_id: domainId,
            action: 'delete'
          },
        }).catch(err => {
          console.warn('Failed to delete from Cloudflare:', err);
        });
      }

      const { error } = await supabase
        .from('tenant_domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;

      toast.success('Domínio removido.');
      await fetchDomains();
      return true;
    } catch (error) {
      console.error('Error removing domain:', error);
      toast.error('Erro ao remover domínio');
      return false;
    }
  };

  // Provision default platform subdomain (SSL handled by ACM - no Cloudflare API calls)
  const provisionDefaultDomain = async (tenantSlug: string): Promise<boolean> => {
    if (!currentTenant?.id) return false;

    try {
      const { data, error } = await supabase.functions.invoke('domains-provision-default', {
        body: { 
          tenant_id: currentTenant.id, 
          tenant_slug: tenantSlug 
        },
      });

      if (error) throw error;

      await fetchDomains();

      if (data.ssl_status === 'active') {
        toast.success('Domínio padrão ativado!');
        return true;
      } else {
        toast.error(data.error || 'Erro ao provisionar domínio padrão');
        return false;
      }
    } catch (error) {
      console.error('Error provisioning default domain:', error);
      toast.error('Erro ao provisionar domínio padrão');
      return false;
    }
  };

  return {
    domains,
    isLoading,
    isVerifying,
    isProvisioning,
    addDomain,
    verifyDomain,
    provisionSSL,
    checkSSLStatus,
    setPrimaryDomain,
    removeDomain,
    provisionDefaultDomain,
    refetch: fetchDomains,
  };
}
