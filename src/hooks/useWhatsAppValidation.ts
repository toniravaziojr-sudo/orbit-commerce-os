import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Abre uma janela de 10 minutos para o tenant comprovar recepção real.
 * O webhook escuta e promove o estado quando o POST chegar dentro da janela.
 */
export function useOpenWhatsAppValidationWindow() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não identificado");
      const { data, error } = await supabase.functions.invoke("whatsapp-open-validation-window", {
        body: { tenant_id: currentTenant.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao abrir janela de validação");
      return data.data as {
        opened_at: string;
        expires_at: string;
        window_minutes: number;
        display_phone_number: string | null;
        previously_validated: boolean;
      };
    },
    onSuccess: (data) => {
      toast.success("Janela de validação aberta", {
        description: `Envie uma mensagem real ao seu número nos próximos ${data.window_minutes} minutos.`,
      });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-health"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (e: Error) => {
      toast.error("Não foi possível abrir a janela de validação", {
        description: e.message,
      });
    },
  });
}

/**
 * Lê o Business ID parceiro da plataforma (usado no wizard cross-business).
 * Retorna null quando admin ainda não preencheu.
 */
export function usePlatformPartnerBusinessId() {
  return useQuery({
    queryKey: ["platform-partner-business-id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_credentials")
        .select("credential_value, is_active")
        .eq("credential_key", "whatsapp_meta_partner_business_id")
        .maybeSingle();
      if (error) return null;
      if (!data?.is_active || !data.credential_value) return null;
      return data.credential_value as string;
    },
    staleTime: 5 * 60_000,
  });
}
