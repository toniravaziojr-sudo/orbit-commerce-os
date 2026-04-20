import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type WhatsAppLinkStatus = "connected" | "incomplete" | "broken";
export type WhatsAppOperationalStatus =
  | "healthy"
  | "observation"
  | "degraded"
  | "no_delivery"
  | "unknown";

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
  // Layered status
  link_status?: WhatsAppLinkStatus;
  link_label?: string;
  operational_status?: WhatsAppOperationalStatus;
  operational_label?: string;
  in_post_migration_observation?: boolean;
  observation_until?: string | null;
  previous_phone_number_id?: string | null;
  previous_waba_id?: string | null;
  linked_at?: string | null;
  // Legacy
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
