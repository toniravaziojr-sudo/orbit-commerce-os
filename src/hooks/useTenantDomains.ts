import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { normalizeDomain, generateVerificationToken } from '@/lib/normalizeDomain';

export interface TenantDomain {
  id: string;
  tenant_id: string;
  domain: string;
  is_primary: boolean;
  status: 'pending' | 'verified' | 'failed';
  verification_token: string;
  verified_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
}

export function useTenantDomains() {
  const { currentTenant } = useAuth();
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState<string | null>(null);

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
      setDomains((data as TenantDomain[]) || []);
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
          verification_token,
          status: 'pending',
          is_primary: false,
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

  const removeDomain = async (domainId: string): Promise<boolean> => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) {
      toast.error('Domínio não encontrado');
      return false;
    }

    if (domain.is_primary) {
      toast.error('Não é possível remover o domínio principal. Defina outro domínio como principal primeiro.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('tenant_domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;

      toast.success('Domínio removido');
      await fetchDomains();
      return true;
    } catch (error) {
      console.error('Error removing domain:', error);
      toast.error('Erro ao remover domínio');
      return false;
    }
  };

  return {
    domains,
    isLoading,
    isVerifying,
    addDomain,
    verifyDomain,
    setPrimaryDomain,
    removeDomain,
    refetch: fetchDomains,
  };
}
