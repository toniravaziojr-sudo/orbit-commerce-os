// ============================================
// USE INTEGRATION CONFIG - Secure provider management
// Uses server-side endpoints to protect credentials
// ============================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface ProviderConfig {
  id: string;
  tenant_id: string;
  provider: string;
  is_enabled: boolean;
  environment?: 'sandbox' | 'production';
  credentials: Record<string, string>; // Masked
  settings: Record<string, any>;
  has_credentials: boolean;
  created_at: string;
  updated_at: string;
}

interface ProviderListResponse {
  providers: ProviderConfig[];
  fallback_active: boolean;
  fallback_provider: string | null;
}

interface TestResult {
  success: boolean;
  message: string;
  source?: string;
  tested_at?: string;
}

export function useIntegrationConfig(type: 'payment' | 'shipping') {
  const { currentTenant } = useAuth();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [fallbackActive, setFallbackActive] = useState(false);
  const [fallbackProvider, setFallbackProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const loadProviders = useCallback(async () => {
    if (!currentTenant?.id) return;
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('integration-config', {
        body: null,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      // Build URL with query params
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-config?action=list&type=${type}&tenant_id=${currentTenant.id}`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load providers');
      }

      const data: ProviderListResponse = await res.json();
      setProviders(data.providers);
      setFallbackActive(data.fallback_active);
      setFallbackProvider(data.fallback_provider);
    } catch (error: any) {
      console.error('Error loading providers:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, type]);

  const saveProvider = useCallback(async (config: {
    provider: string;
    is_enabled: boolean;
    environment?: 'sandbox' | 'production';
    credentials: Record<string, string>;
    settings?: Record<string, any>;
  }) => {
    if (!currentTenant?.id) return;

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-config?action=save&type=${type}`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: currentTenant.id,
          ...config,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save provider');
      }

      toast.success('Configurações salvas com sucesso');
      await loadProviders(); // Reload to get masked values
    } catch (error: any) {
      console.error('Error saving provider:', error);
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, type, loadProviders]);

  const testConnection = useCallback(async (provider: string): Promise<TestResult> => {
    if (!currentTenant?.id) {
      return { success: false, message: 'Tenant não selecionado' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-config?action=test&type=${type}`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: currentTenant.id,
          provider,
        }),
      });

      const result: TestResult = await res.json();
      setTestResults(prev => ({ ...prev, [provider]: result }));

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }

      return result;
    } catch (error: any) {
      console.error('Error testing connection:', error);
      const result = { success: false, message: error.message || 'Erro ao testar conexão' };
      setTestResults(prev => ({ ...prev, [provider]: result }));
      toast.error(result.message);
      return result;
    }
  }, [currentTenant?.id, type]);

  const getProvider = useCallback((providerName: string) => {
    return providers.find(p => p.provider === providerName);
  }, [providers]);

  return {
    providers,
    isLoading,
    fallbackActive,
    fallbackProvider,
    testResults,
    loadProviders,
    saveProvider,
    testConnection,
    getProvider,
  };
}
