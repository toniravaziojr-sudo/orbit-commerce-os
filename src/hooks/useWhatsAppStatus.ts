import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WhatsAppStatus {
  isConfigured: boolean;
  isConnected: boolean;
  phoneNumber: string | null;
  lastError: string | null;
}

export function useWhatsAppStatus() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-status", tenantId],
    queryFn: async (): Promise<WhatsAppStatus> => {
      if (!tenantId) {
        return { isConfigured: false, isConnected: false, phoneNumber: null, lastError: null };
      }

      const { data: config, error } = await supabase
        .from("whatsapp_configs")
        .select("id, connection_status, phone_number, last_error, is_enabled")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching WhatsApp config:", error);
        return { isConfigured: false, isConnected: false, phoneNumber: null, lastError: error.message };
      }

      if (!config) {
        return { isConfigured: false, isConnected: false, phoneNumber: null, lastError: null };
      }

      return {
        isConfigured: !!config.id && !!config.is_enabled,
        isConnected: config.connection_status === 'connected',
        phoneNumber: config.phone_number || null,
        lastError: config.last_error || null,
      };
    },
    enabled: !!tenantId,
    staleTime: 30000, // 30 seconds
  });

  return {
    status: data ?? { isConfigured: false, isConnected: false, phoneNumber: null, lastError: null },
    isLoading,
  };
}
