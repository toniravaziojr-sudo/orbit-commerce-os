import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type LateConnectionStatus = "disconnected" | "connecting" | "connected" | "error" | "expired";

export interface LateConnection {
  id: string;
  tenant_id: string;
  status: LateConnectionStatus;
  late_profile_id: string | null;
  late_profile_name: string | null;
  connected_accounts: {
    platform: string;
    external_id: string;
    name: string;
    username?: string;
    picture_url?: string;
  }[] | null;
  scopes: string[] | null;
  last_error: string | null;
  connected_at: string | null;
  updated_at: string;
}

export function useLateConnection() {
  const { currentTenant } = useAuth();

  const { data: connection, isLoading, error, refetch } = useQuery({
    queryKey: ["late-connection", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("late_connections")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        status: data.status as LateConnectionStatus,
        connected_accounts: data.connected_accounts as LateConnection["connected_accounts"],
      } as LateConnection;
    },
    enabled: !!currentTenant?.id,
  });

  const isConnected = connection?.status === "connected";
  const hasError = connection?.status === "error" || connection?.status === "expired";

  return {
    connection,
    isLoading,
    error,
    refetch,
    isConnected,
    hasError,
  };
}
