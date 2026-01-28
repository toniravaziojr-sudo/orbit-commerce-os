// ============================================
// USE YOUTUBE CONNECTION - Manage YouTube OAuth
// ============================================

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface YouTubeConnection {
  id: string;
  tenant_id: string;
  channel_id: string;
  channel_title: string | null;
  channel_thumbnail_url: string | null;
  channel_custom_url: string | null;
  subscriber_count: number | null;
  video_count: number | null;
  is_active: boolean;
  connection_status: string;
  token_expires_at: string;
  last_sync_at: string | null;
  last_error: string | null;
  scopes: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useYouTubeConnection() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch connection status
  const {
    data: connection,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["youtube-connection", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("youtube_connections")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data as YouTubeConnection | null;
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Check if token is expired
  const isExpired = connection
    ? new Date(connection.token_expires_at) < new Date()
    : false;

  const isConnected = !!connection?.is_active && !isExpired;

  // Start OAuth flow
  const connect = useCallback(async () => {
    if (!currentTenant?.id || !user?.id) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    setIsConnecting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Sessão expirada");
      }

      const response = await supabase.functions.invoke("youtube-oauth-start", {
        body: {
          tenant_id: currentTenant.id,
          redirect_url: window.location.origin,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data as { success: boolean; authorization_url?: string; error?: string };

      if (!data.success || !data.authorization_url) {
        throw new Error(data.error || "Erro ao iniciar autenticação");
      }

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.authorization_url,
        "youtube-oauth",
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      if (!popup) {
        // Popup blocked - redirect instead
        window.location.href = data.authorization_url;
        return;
      }

      // Listen for popup message
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "youtube:connected") {
          window.removeEventListener("message", handleMessage);
          setIsConnecting(false);
          queryClient.invalidateQueries({ queryKey: ["youtube-connection"] });

          if (event.data.success) {
            toast.success(
              `YouTube conectado! Canal: ${event.data.channel || "Seu canal"}`
            );
          } else {
            // Show detailed error based on error code
            const errorCode = event.data.errorCode;
            let errorMessage = event.data.error || "Erro ao conectar YouTube";
            
            // Add context for specific errors
            if (errorCode === 'testing_mode_restriction') {
              errorMessage = "OAuth em modo Testing: seu email não é um usuário de teste";
            } else if (errorCode === 'unverified_app_cap') {
              errorMessage = "Limite de usuários atingido. App precisa de verificação.";
            } else if (errorCode === 'access_denied') {
              errorMessage = "Você cancelou a autorização";
            }
            
            toast.error(errorMessage);
          }
        }
      };

      window.addEventListener("message", handleMessage);

      // Clean up listener after timeout
      setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        setIsConnecting(false);
      }, 300000); // 5 minutes timeout

    } catch (error) {
      console.error("[useYouTubeConnection] Connect error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao conectar");
      setIsConnecting(false);
    }
  }, [currentTenant?.id, user?.id, queryClient]);

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não encontrado");

      const { error } = await supabase
        .from("youtube_connections")
        .update({
          is_active: false,
          connection_status: "disconnected",
          access_token: null,
          refresh_token: null,
        })
        .eq("tenant_id", currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["youtube-connection"] });
      toast.success("YouTube desconectado");
    },
    onError: (error) => {
      toast.error("Erro ao desconectar");
      console.error(error);
    },
  });

  // Listen for popup callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "youtube:connected") {
        queryClient.invalidateQueries({ queryKey: ["youtube-connection"] });
        setIsConnecting(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [queryClient]);

  return {
    connection,
    isConnected,
    isExpired,
    isLoading,
    isConnecting,
    isDisconnecting: disconnectMutation.isPending,
    error,
    connect,
    disconnect: disconnectMutation.mutate,
    refetch,
  };
}
