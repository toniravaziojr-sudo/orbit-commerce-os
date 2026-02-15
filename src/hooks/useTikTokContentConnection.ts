// =============================================
// USE TIKTOK CONTENT CONNECTION
// Hook for TikTok Content (Login Kit) OAuth
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TikTokContentStatus {
  isConnected: boolean;
  connectionStatus: string;
  openId: string;
  displayName: string;
  avatarUrl: string;
  scopePacks: string[];
  connectedAt: string | null;
  isExpired: boolean;
  lastError: string | null;
  assets: Record<string, unknown>;
}

const DEFAULT_STATUS: TikTokContentStatus = {
  isConnected: false,
  connectionStatus: 'disconnected',
  openId: '',
  displayName: '',
  avatarUrl: '',
  scopePacks: [],
  connectedAt: null,
  isExpired: false,
  lastError: null,
  assets: {},
};

export function useTikTokContentConnection() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const { data: connectionStatus = DEFAULT_STATUS, isLoading } = useQuery({
    queryKey: ['tiktok-content-connection', currentTenant?.id],
    queryFn: async (): Promise<TikTokContentStatus> => {
      if (!currentTenant?.id) return DEFAULT_STATUS;

      const { data, error } = await supabase
        .from('tiktok_content_connections')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error || !data) return DEFAULT_STATUS;

      const isExpired = data.token_expires_at
        ? new Date(data.token_expires_at) < new Date()
        : false;

      return {
        isConnected: data.connection_status === 'connected' && data.is_active,
        connectionStatus: data.connection_status || 'disconnected',
        openId: data.open_id || '',
        displayName: data.display_name || '',
        avatarUrl: data.avatar_url || '',
        scopePacks: (data.scope_packs as string[]) || [],
        connectedAt: data.connected_at,
        isExpired,
        lastError: data.last_error,
        assets: (data.assets as Record<string, unknown>) || {},
      };
    },
    enabled: !!currentTenant?.id,
  });

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'tiktok-content:connected') {
        queryClient.invalidateQueries({ queryKey: ['tiktok-content-connection'] });
        if (event.data.success) {
          toast.success('TikTok Content conectado com sucesso!');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [queryClient]);

  const connect = useCallback(async (scopePacks?: string[]) => {
    if (!currentTenant?.id) {
      toast.error('Selecione um tenant primeiro');
      return;
    }

    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('tiktok-content-oauth-start', {
        body: {
          tenantId: currentTenant.id,
          scopePacks: scopePacks || ['content'],
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || 'Erro ao iniciar conexão');
        return;
      }

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        data.authUrl,
        'tiktok-content-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
    } catch (err) {
      toast.error('Erro ao iniciar conexão com TikTok Content');
    } finally {
      setIsConnecting(false);
    }
  }, [currentTenant?.id]);

  const disconnect = useCallback(async () => {
    if (!currentTenant?.id) return;

    setIsDisconnecting(true);
    try {
      const { error } = await supabase
        .from('tiktok_content_connections')
        .update({
          is_active: false,
          connection_status: 'disconnected',
          access_token: null,
          refresh_token: null,
        })
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['tiktok-content-connection'] });
      toast.success('TikTok Content desconectado');
    } catch (err) {
      toast.error('Erro ao desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  }, [currentTenant?.id, queryClient]);

  return {
    connectionStatus,
    isLoading,
    isConnecting,
    isDisconnecting,
    connect,
    disconnect,
  };
}
