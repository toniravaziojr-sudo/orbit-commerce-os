// ============================================
// USE YOUTUBE CONNECTION - Reads from google_connections (Hub Google)
// Fallback to youtube_connections for retrocompatibility
// ============================================

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useGoogleConnection } from "./useGoogleConnection";
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
  // Source tracking
  _source?: "google_hub" | "legacy";
}

export function useYouTubeConnection() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Try Google Hub first
  const googleHub = useGoogleConnection();
  const hasYouTubeInHub =
    googleHub.isConnected &&
    googleHub.connection?.scopePacks?.includes("youtube");

  // Fetch legacy connection (only if not in Hub)
  const {
    data: legacyConnection,
    isLoading: legacyLoading,
    error: legacyError,
    refetch: legacyRefetch,
  } = useQuery({
    queryKey: ["youtube-connection-legacy", currentTenant?.id],
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
    enabled: !!currentTenant?.id && !hasYouTubeInHub,
    staleTime: 1000 * 60 * 5,
  });

  // Build unified connection from Google Hub data
  const hubConnection: YouTubeConnection | null = hasYouTubeInHub
    ? (() => {
        const gc = googleHub.connection!;
        const channels = gc.assets?.youtube_channels || [];
        const ch = channels[0];
        return {
          id: "google-hub",
          tenant_id: currentTenant?.id || "",
          channel_id: ch?.id || "",
          channel_title: ch?.title || gc.displayName,
          channel_thumbnail_url: ch?.thumbnail_url || gc.avatarUrl,
          channel_custom_url: null,
          subscriber_count: ch?.subscriber_count || null,
          video_count: null,
          is_active: true,
          connection_status: "connected",
          token_expires_at: gc.tokenExpiresAt || "",
          last_sync_at: gc.lastSyncAt,
          last_error: gc.lastError,
          scopes: gc.grantedScopes,
          created_at: gc.connectedAt,
          updated_at: gc.connectedAt,
          _source: "google_hub" as const,
        };
      })()
    : null;

  const connection = hubConnection || legacyConnection;
  const isLoading = googleHub.isLoading || (!hasYouTubeInHub && legacyLoading);
  const error = legacyError;

  const isExpired = connection
    ? new Date(connection.token_expires_at) < new Date()
    : false;

  const isConnected = !!connection?.is_active && !isExpired;

  // Connect: use Google Hub OAuth (youtube pack)
  const connect = useCallback(async () => {
    if (!currentTenant?.id || !user?.id) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    // If there's already a Google Hub connection, add youtube pack
    if (googleHub.isConnected) {
      const currentPacks = googleHub.connection?.scopePacks || [];
      if (!currentPacks.includes("youtube")) {
        googleHub.connect([...currentPacks, "youtube"] as any);
      }
      return;
    }

    // Start fresh Google Hub connection with youtube pack
    googleHub.connect(["youtube"]);
  }, [currentTenant?.id, user?.id, googleHub]);

  // Disconnect: via Google Hub or legacy
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não encontrado");

      if (hubConnection) {
        // Disconnect via Google Hub
        googleHub.disconnect();
        return;
      }

      // Legacy disconnect
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
      queryClient.invalidateQueries({ queryKey: ["youtube-connection-legacy"] });
      queryClient.invalidateQueries({ queryKey: ["google-connection-status"] });
      toast.success("YouTube desconectado");
    },
    onError: (error) => {
      toast.error("Erro ao desconectar");
      console.error(error);
    },
  });

  const refetch = useCallback(() => {
    googleHub.refetch();
    legacyRefetch();
  }, [googleHub, legacyRefetch]);

  // Listen for popup callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "youtube:connected" ||
        event.data?.type === "google:connected"
      ) {
        queryClient.invalidateQueries({ queryKey: ["youtube-connection-legacy"] });
        queryClient.invalidateQueries({ queryKey: ["google-connection-status"] });
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
    isConnecting: isConnecting || googleHub.isConnecting,
    isDisconnecting: disconnectMutation.isPending || googleHub.isDisconnecting,
    error,
    connect,
    disconnect: disconnectMutation.mutate,
    refetch,
  };
}
