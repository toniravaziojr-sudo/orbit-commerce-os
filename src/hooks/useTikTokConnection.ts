// =============================================
// USE TIKTOK CONNECTION
// Hook for managing TikTok OAuth connection per tenant
// =============================================

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TikTokConnectionStatus {
  isConnected: boolean;
  advertiserId: string | null;
  advertiserName: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  isExpired: boolean;
  pixelId: string | null;
  eventsApiEnabled: boolean;
}

interface TikTokConnectionResult {
  advertiserId: string;
  advertiserName: string;
  expiresAt: string;
  scopes: string[];
  advertiserCount: number;
}

export function useTikTokConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Query para verificar status da conexão
  const { data: connectionStatus, isLoading, refetch } = useQuery({
    queryKey: ['tiktok-connection', currentTenant?.id],
    queryFn: async (): Promise<TikTokConnectionStatus> => {
      if (!currentTenant?.id) {
        return {
          isConnected: false,
          advertiserId: null,
          advertiserName: null,
          connectedAt: null,
          tokenExpiresAt: null,
          isExpired: false,
          pixelId: null,
          eventsApiEnabled: false,
        };
      }

      const { data, error } = await supabase
        .from('marketing_integrations')
        .select('tiktok_access_token, tiktok_advertiser_id, tiktok_advertiser_name, tiktok_connected_at, tiktok_token_expires_at, tiktok_pixel_id, tiktok_events_api_enabled')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) {
        console.error('[useTikTokConnection] Erro ao buscar status:', error);
        throw error;
      }

      const hasToken = !!(data as any)?.tiktok_access_token;
      const expiresAt = (data as any)?.tiktok_token_expires_at;
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

      return {
        isConnected: hasToken && !isExpired,
        advertiserId: (data as any)?.tiktok_advertiser_id || null,
        advertiserName: (data as any)?.tiktok_advertiser_name || null,
        connectedAt: (data as any)?.tiktok_connected_at || null,
        tokenExpiresAt: expiresAt || null,
        isExpired,
        pixelId: data?.tiktok_pixel_id || null,
        eventsApiEnabled: (data as any)?.tiktok_events_api_enabled || false,
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Mutation para iniciar OAuth
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("tiktok-oauth-start", {
        body: { 
          tenantId: currentTenant.id,
          returnPath: "/marketing",
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Erro ao iniciar conexão");
      }

      return data;
    },
    onSuccess: (data) => {
      // Abrir popup com URL de autorização
      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        window.open(
          data.authUrl,
          'tiktok-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao conectar TikTok");
    },
  });

  // Mutation para processar callback (chamado pela página de callback)
  const processCallbackMutation = useMutation({
    mutationFn: async ({ authCode, state }: { authCode: string; state: string }) => {
      const { data, error } = await supabase.functions.invoke("tiktok-oauth-callback", {
        body: { auth_code: authCode, state },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Erro ao processar autorização");
      }

      return data as { success: true; connection: TikTokConnectionResult };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-connection'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
      toast.success("TikTok conectado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao processar autorização");
    },
  });

  // Mutation para desconectar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { error } = await supabase
        .from('marketing_integrations')
        .update({
          tiktok_access_token: null,
          tiktok_refresh_token: null,
          tiktok_advertiser_id: null,
          tiktok_advertiser_name: null,
          tiktok_connected_at: null,
          tiktok_connected_by: null,
          tiktok_token_expires_at: null,
          tiktok_enabled: false,
          tiktok_events_api_enabled: false,
          tiktok_status: 'inactive',
        } as any)
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-connection'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
      toast.success("TikTok desconectado");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao desconectar");
    },
  });

  // Listener para mensagem do popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'tiktok:connected') {
        if (event.data.success) {
          queryClient.invalidateQueries({ queryKey: ['tiktok-connection'] });
          queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  const connect = useCallback(() => {
    setIsConnecting(true);
    connectMutation.mutate(undefined, {
      onSettled: () => setIsConnecting(false),
    });
  }, [connectMutation]);

  const disconnect = useCallback(() => {
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  return {
    connectionStatus: connectionStatus || {
      isConnected: false,
      advertiserId: null,
      advertiserName: null,
      connectedAt: null,
      tokenExpiresAt: null,
      isExpired: false,
      pixelId: null,
      eventsApiEnabled: false,
    },
    isLoading,
    isConnecting: isConnecting || connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    connect,
    disconnect,
    processCallback: processCallbackMutation.mutateAsync,
    refetch,
  };
}
