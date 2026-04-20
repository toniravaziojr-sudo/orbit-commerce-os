import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WhatsAppLinkStatus = "connected" | "incomplete" | "broken";
export type WhatsAppOperationalStatus =
  | "healthy"
  | "observation"
  | "degraded"
  | "no_delivery"
  | "unknown";

export interface WhatsAppStatus {
  isConfigured: boolean;
  /** True only when the link is technically connected. Does NOT prove operation. */
  isLinked: boolean;
  /** True only when there is recent operational evidence (inbound flow within 12h). */
  isOperational: boolean;
  /** Backwards-compat: now means BOTH linked AND operational, never just linked. */
  isConnected: boolean;
  linkStatus: WhatsAppLinkStatus | null;
  operationalStatus: WhatsAppOperationalStatus | null;
  inPostMigrationObservation: boolean;
  phoneNumber: string | null;
  lastError: string | null;
  lastInboundAt: string | null;
  /** Short, business-language summary for badges and toasts. */
  statusLabel: string;
}

const EMPTY: WhatsAppStatus = {
  isConfigured: false,
  isLinked: false,
  isOperational: false,
  isConnected: false,
  linkStatus: null,
  operationalStatus: null,
  inPostMigrationObservation: false,
  phoneNumber: null,
  lastError: null,
  lastInboundAt: null,
  statusLabel: "Não configurado",
};

function buildLabel(link: WhatsAppLinkStatus, op: WhatsAppOperationalStatus, observation: boolean) {
  if (link === "broken") return "Vínculo com defeito";
  if (link === "incomplete") return "Vínculo incompleto";
  if (op === "healthy") return "Recebendo normalmente";
  if (op === "observation") return observation ? "Vínculo trocado, em observação" : "Aguardando comprovação operacional";
  if (op === "degraded") return "Recepção instável";
  if (op === "no_delivery") return "Recepção comprometida";
  return "Operação ainda não comprovada";
}

export function useWhatsAppStatus() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-status", tenantId],
    queryFn: async (): Promise<WhatsAppStatus> => {
      if (!tenantId) return EMPTY;

      // Prefer the layered summary (link + operação). Falls back to the row if invoke fails.
      try {
        const { data: resp, error } = await supabase.functions.invoke("whatsapp-health-summary", {
          body: { tenant_id: tenantId },
        });
        if (!error && resp?.success && resp.data?.configured) {
          const d = resp.data as {
            is_enabled?: boolean;
            link_status?: WhatsAppLinkStatus;
            operational_status?: WhatsAppOperationalStatus;
            in_post_migration_observation?: boolean;
            display_phone_number?: string | null;
            last_error?: string | null;
            last_inbound_at?: string | null;
          };
          const link = d.link_status ?? "broken";
          const op = d.operational_status ?? "unknown";
          const isLinked = link === "connected";
          const isOperational = op === "healthy";
          return {
            isConfigured: !!d.is_enabled,
            isLinked,
            isOperational,
            isConnected: isLinked && isOperational,
            linkStatus: link,
            operationalStatus: op,
            inPostMigrationObservation: !!d.in_post_migration_observation,
            phoneNumber: d.display_phone_number ?? null,
            lastError: d.last_error ?? null,
            lastInboundAt: d.last_inbound_at ?? null,
            statusLabel: buildLabel(link, op, !!d.in_post_migration_observation),
          };
        }
      } catch (e) {
        console.warn("useWhatsAppStatus: health-summary fallback", e);
      }

      // Fallback: read row directly. Without operational evidence, we cannot claim "connected".
      const { data: config, error } = await supabase
        .from("whatsapp_configs")
        .select("id, connection_status, phone_number, last_error, is_enabled, last_inbound_at, migration_observation_until")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta")
        .maybeSingle();

      if (error || !config?.id || !config.is_enabled) {
        return { ...EMPTY, lastError: error?.message ?? null };
      }

      const link: WhatsAppLinkStatus = config.connection_status === "connected" ? "connected" : "broken";
      const inObservation =
        !!config.migration_observation_until &&
        new Date(config.migration_observation_until).getTime() > Date.now();
      const hoursSinceInbound = config.last_inbound_at
        ? (Date.now() - new Date(config.last_inbound_at).getTime()) / 36e5
        : null;
      const op: WhatsAppOperationalStatus =
        link !== "connected" ? "no_delivery"
        : hoursSinceInbound !== null && hoursSinceInbound < 12 ? "healthy"
        : hoursSinceInbound !== null && hoursSinceInbound < 24 ? "degraded"
        : inObservation ? "observation"
        : "unknown";

      return {
        isConfigured: true,
        isLinked: link === "connected",
        isOperational: op === "healthy",
        isConnected: link === "connected" && op === "healthy",
        linkStatus: link,
        operationalStatus: op,
        inPostMigrationObservation: inObservation,
        phoneNumber: config.phone_number || null,
        lastError: config.last_error || null,
        lastInboundAt: config.last_inbound_at || null,
        statusLabel: buildLabel(link, op, inObservation),
      };
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  return {
    status: data ?? EMPTY,
    isLoading,
  };
}
