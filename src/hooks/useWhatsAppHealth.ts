import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppHealthSummary {
  configured: boolean;
  is_enabled?: boolean;
  connection_status?: string;
  display_phone_number?: string | null;
  last_error?: string | null;
  webhook_subscribed_at?: string | null;
  last_diagnosed_at?: string | null;
  last_inbound_at?: string | null;
  last_inbound_processed?: boolean;
  last_ai_reply_at?: string | null;
  subscription_status?: "green" | "yellow" | "red";
  silence_alert?: "none" | "yellow" | "red";
  orphan_count_24h?: number;
  open_incidents?: Array<{
    id: string;
    incident_type: string;
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string | null;
    metadata: Record<string, unknown>;
    detected_at: string;
  }>;
}

export function useWhatsAppHealth() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ["whatsapp-health", currentTenant?.id],
    queryFn: async (): Promise<WhatsAppHealthSummary | null> => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase.functions.invoke(
        "whatsapp-health-summary",
        { body: { tenant_id: currentTenant.id } },
      );
      if (error) throw error;
      if (!data?.success) return null;
      return data.data as WhatsAppHealthSummary;
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
