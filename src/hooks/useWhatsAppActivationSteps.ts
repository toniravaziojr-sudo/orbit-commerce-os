import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * useWhatsAppActivationSteps
 *
 * Deriva o status dos 4 passos obrigatórios do onboarding WhatsApp Cloud API (modelo BYOA),
 * combinando o diagnóstico atual da Meta (`meta-whatsapp-diagnose`) com o estado salvo em
 * `whatsapp_configs`. É a fonte única do `WhatsAppActivationGuide` e do banner do dashboard.
 *
 * Os 4 passos:
 *   1. account_connected   — Embedded Signup concluído + token Meta válido (sem erro 190).
 *   2. payment_method      — Forma de pagamento ativa no Business Manager
 *                            (ausência do issue BILLING_MISSING / health WABA não bloqueada).
 *   3. pin_defined         — PIN de 6 dígitos salvo em `register_pin` (consentimento p/ auto-reparo).
 *   4. number_verified     — Status do número CONNECTED + code_verification_status VERIFIED.
 *
 * A Meta é a fonte de verdade — se o diagnose revelar drift, o passo cai mesmo que o banco
 * marque "connected" (regra do whatsapp-meta-recovery-protocol).
 */

export type StepKey =
  | "account_connected"
  | "payment_method"
  | "pin_defined"
  | "number_verified";

export type StepStatus = "done" | "pending" | "blocked";

export interface ActivationStep {
  key: StepKey;
  status: StepStatus;
  reason?: string;
}

export interface ActivationState {
  isConfigured: boolean;
  steps: ActivationStep[];
  completedCount: number;
  totalSteps: number;
  isFullyActivated: boolean;
  diagnoseStatus?: "healthy" | "warning" | "needs_attention" | "not_configured" | "no_token" | "token_invalid";
}

const TOTAL = 4;

export function useWhatsAppActivationSteps() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const query = useQuery({
    queryKey: ["whatsapp-activation-steps", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ActivationState> => {
      // 1. Estado base do banco
      const { data: config } = await supabase
        .from("whatsapp_configs")
        .select("id, connection_status, register_pin, phone_number_id, last_health_payload")
        .eq("tenant_id", tenantId!)
        .eq("provider", "meta")
        .maybeSingle();

      if (!config?.id) {
        return {
          isConfigured: false,
          steps: [
            { key: "account_connected", status: "pending", reason: "Conecte sua conta Meta para começar." },
            { key: "payment_method", status: "pending" },
            { key: "pin_defined", status: "pending" },
            { key: "number_verified", status: "pending" },
          ],
          completedCount: 0,
          totalSteps: TOTAL,
          isFullyActivated: false,
        };
      }

      // 2. Diagnose ao vivo (silencioso — se falhar, derivamos do banco)
      let diagnoseData: any = null;
      try {
        const resp = await supabase.functions.invoke("meta-whatsapp-diagnose", {
          body: { tenant_id: tenantId },
        });
        if (!resp.error && resp.data?.success) diagnoseData = resp.data.data;
      } catch {
        // segue com fallback do banco
      }

      const issues: Array<{ code: string }> = diagnoseData?.issues ?? [];
      const hasIssue = (code: string) => issues.some((i) => i.code === code);

      const tokenOk =
        diagnoseData
          ? !["no_token", "token_invalid"].includes(diagnoseData.status) &&
            !hasIssue("TOKEN_INVALID")
          : !!config.connection_status &&
            config.connection_status !== "token_expired" &&
            config.connection_status !== "disconnected";

      const billingOk = diagnoseData
        ? !hasIssue("BILLING_MISSING") && !hasIssue("WABA_BLOCKED")
        : true; // sem diagnose, assumimos OK até prova em contrário

      const pinOk = !!config.register_pin;

      const numberVerified = diagnoseData
        ? diagnoseData.status === "healthy" ||
          (diagnoseData.phone_status === "CONNECTED" &&
            !hasIssue("NUMBER_NOT_REGISTERED") &&
            !hasIssue("NUMBER_NEEDS_PIN") &&
            !hasIssue("PENDING_NORMAL"))
        : config.connection_status === "connected";

      const steps: ActivationStep[] = [
        {
          key: "account_connected",
          status: tokenOk ? "done" : "pending",
          reason: tokenOk ? undefined : "Token Meta ausente, expirado ou revogado.",
        },
        {
          key: "payment_method",
          status: billingOk ? "done" : "blocked",
          reason: billingOk ? undefined : "Cartão ausente ou recusado no Business Manager.",
        },
        {
          key: "pin_defined",
          status: pinOk ? "done" : "pending",
          reason: pinOk ? undefined : "PIN de 6 dígitos ainda não foi salvo no sistema.",
        },
        {
          key: "number_verified",
          status: numberVerified ? "done" : "pending",
          reason: numberVerified ? undefined : "Aguardando registro/verificação do número na Cloud API.",
        },
      ];

      const completedCount = steps.filter((s) => s.status === "done").length;

      return {
        isConfigured: true,
        steps,
        completedCount,
        totalSteps: TOTAL,
        isFullyActivated: completedCount === TOTAL,
        diagnoseStatus: diagnoseData?.status,
      };
    },
  });

  return {
    state: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
