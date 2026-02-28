import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntegrationStatus {
  key: string;
  name: string;
  description: string;
  icon: string;
  docs: string;
  isSystem?: boolean;
  secrets: Record<string, boolean>;
  previews?: Record<string, string>;
  sources?: Record<string, 'db' | 'env' | null>;
  status: 'configured' | 'partial' | 'pending' | 'system';
  configuredCount: number;
  totalCount: number;
}

/**
 * Hook centralizado para buscar o status de TODAS as integrações da plataforma.
 * Faz UMA ÚNICA chamada à edge function e compartilha o cache via React Query.
 * 
 * Todas as abas de integração devem usar este hook em vez de fazer chamadas individuais.
 * O staleTime de 2 minutos evita re-fetches desnecessários ao trocar de aba.
 */
export function usePlatformSecretsStatus() {
  return useQuery<IntegrationStatus[]>({
    queryKey: ['platform-secrets-status'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('platform-secrets-check', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      return response.data.integrations as IntegrationStatus[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutos — evita re-fetch ao trocar abas
    gcTime: 5 * 60 * 1000, // 5 minutos no cache
  });
}

/**
 * Hook para obter o status de UMA integração específica.
 * Reutiliza o cache centralizado — NÃO faz chamada extra.
 */
export function usePlatformIntegrationStatus(integrationKey: string) {
  const query = usePlatformSecretsStatus();

  const integration = query.data?.find((i) => i.key === integrationKey) || null;

  return {
    ...query,
    data: integration,
  };
}
