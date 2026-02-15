// =============================================
// USE TIKTOK SHOP CONNECTION (Hub v3)
// Hook for managing TikTok Shop connection per tenant
// Source of truth: tiktok_shop_connections table
// =============================================

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface TikTokShopConnectionStatus {
  isConnected: boolean;
  connectionStatus: 'connected' | 'error' | 'disconnected';
  shopId: string | null;
  shopName: string | null;
  shopRegion: string | null;
  sellerId: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  isExpired: boolean;
  scopePacks: string[];
  grantedScopes: string[];
  assets: Record<string, unknown>;
  lastError: string | null;
}

const EMPTY_STATUS: TikTokShopConnectionStatus = {
  isConnected: false,
  connectionStatus: 'disconnected',
  shopId: null,
  shopName: null,
  shopRegion: null,
  sellerId: null,
  connectedAt: null,
  tokenExpiresAt: null,
  isExpired: false,
  scopePacks: [],
  grantedScopes: [],
  assets: {},
  lastError: null,
};

export function useTikTokShopConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: connectionStatus, isLoading, refetch } = useQuery({
    queryKey: ['tiktok-shop-connection', currentTenant?.id],
    queryFn: async (): Promise<TikTokShopConnectionStatus> => {
      if (!currentTenant?.id) return EMPTY_STATUS;

      const { data, error } = await supabase
        .from('tiktok_shop_connections' as any)
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) {
        console.error('[useTikTokShopConnection] Error:', error);
        throw error;
      }

      if (!data) return EMPTY_STATUS;

      const rec = data as any;
      const expiresAt = rec.token_expires_at;
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
      const connStatus = rec.connection_status || 'disconnected';

      return {
        isConnected: connStatus === 'connected' && !isExpired,
        connectionStatus: connStatus,
        shopId: rec.shop_id || null,
        shopName: rec.shop_name || null,
        shopRegion: rec.shop_region || null,
        sellerId: rec.seller_id || null,
        connectedAt: rec.connected_at || null,
        tokenExpiresAt: expiresAt || null,
        isExpired,
        scopePacks: rec.scope_packs || [],
        grantedScopes: rec.granted_scopes || [],
        assets: rec.assets || {},
        lastError: rec.last_error || null,
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

      const { data, error } = await supabase.functions.invoke("tiktok-shop-oauth-start", {
        body: {
          tenantId: currentTenant.id,
          scopePacks: scopePacks || ["catalog", "orders"],
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
          'tiktok-shop-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao conectar TikTok Shop");
    },
  });

  // Desconectar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { error } = await supabase
        .from('tiktok_shop_connections' as any)
        .update({
          access_token: null,
          refresh_token: null,
          is_active: false,
          connection_status: 'disconnected',
          last_error: null,
        })
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-connection'] });
      toast.success("TikTok Shop desconectado");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao desconectar");
    },
  });

  // Listener popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'tiktok-shop:connected') {
        if (event.data.success) {
          queryClient.invalidateQueries({ queryKey: ['tiktok-shop-connection'] });
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
