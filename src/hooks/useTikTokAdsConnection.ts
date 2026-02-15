// =============================================
// USE TIKTOK ADS CONNECTION (Hub v2)
// Hook for managing TikTok Ads connection per tenant
// Source of truth: tiktok_ads_connections table
// =============================================

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface TikTokAdsConnectionStatus {
  isConnected: boolean;
  connectionStatus: 'connected' | 'error' | 'disconnected';
  advertiserId: string | null;
  advertiserName: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  isExpired: boolean;
  scopePacks: string[];
  grantedScopes: string[];
  assets: {
    advertiser_ids?: string[];
    pixels?: string[];
  };
  lastError: string | null;
}

const EMPTY_STATUS: TikTokAdsConnectionStatus = {
  isConnected: false,
  connectionStatus: 'disconnected',
  advertiserId: null,
  advertiserName: null,
  connectedAt: null,
  tokenExpiresAt: null,
  isExpired: false,
  scopePacks: [],
  grantedScopes: [],
  assets: {},
  lastError: null,
};

export function useTikTokAdsConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: connectionStatus, isLoading, refetch } = useQuery({
    queryKey: ['tiktok-ads-connection', currentTenant?.id],
    queryFn: async (): Promise<TikTokAdsConnectionStatus> => {
      if (!currentTenant?.id) return EMPTY_STATUS;

      const { data, error } = await supabase
        .from('tiktok_ads_connections' as any)
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) {
        console.error('[useTikTokAdsConnection] Error:', error);
        throw error;
      }

      if (!data) return EMPTY_STATUS;

      const expiresAt = (data as any).token_expires_at;
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
      const connStatus = (data as any).connection_status || 'disconnected';

      return {
        isConnected: connStatus === 'connected' && !isExpired,
        connectionStatus: connStatus,
        advertiserId: (data as any).advertiser_id || null,
        advertiserName: (data as any).advertiser_name || null,
        connectedAt: (data as any).connected_at || null,
        tokenExpiresAt: expiresAt || null,
        isExpired,
        scopePacks: (data as any).scope_packs || [],
        grantedScopes: (data as any).granted_scopes || [],
        assets: (data as any).assets || {},
        lastError: (data as any).last_error || null,
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Iniciar OAuth
  const connectMutation = useMutation({
    mutationFn: async (scopePacks?: string[]) => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("tiktok-oauth-start", {
        body: { 
          tenantId: currentTenant.id,
          scopePacks: scopePacks || ["pixel", "ads_read"],
          returnPath: "/integrations",
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao iniciar conexão");
      return data;
    },
    onSuccess: (data) => {
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

  // Desconectar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { error } = await supabase
        .from('tiktok_ads_connections' as any)
        .update({
          access_token: null,
          refresh_token: null,
          is_active: false,
          connection_status: 'disconnected',
          last_error: null,
        })
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      // Also clear legacy
      await supabase
        .from('marketing_integrations')
        .update({
          tiktok_access_token: null,
          tiktok_refresh_token: null,
          tiktok_enabled: false,
          tiktok_events_api_enabled: false,
          tiktok_status: 'inactive',
        } as any)
        .eq('tenant_id', currentTenant.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-ads-connection'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
      toast.success("TikTok Ads desconectado");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao desconectar");
    },
  });

  // Listener popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'tiktok:connected') {
        if (event.data.success) {
          queryClient.invalidateQueries({ queryKey: ['tiktok-ads-connection'] });
          queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  const connect = useCallback((scopePacks?: string[]) => {
    setIsConnecting(true);
    connectMutation.mutate(scopePacks, {
      onSettled: () => setIsConnecting(false),
    });
  }, [connectMutation]);

  const disconnect = useCallback(() => {
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  return {
    connectionStatus: connectionStatus || EMPTY_STATUS,
    isLoading,
    isConnecting: isConnecting || connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    connect,
    disconnect,
    refetch,
  };
}
