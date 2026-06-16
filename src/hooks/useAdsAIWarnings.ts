import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type AdsAIWarning = {
  id: string;
  tenant_id: string;
  channel: string;
  ad_account_id: string | null;
  campaign_ref: string | null;
  creative_ref: string | null;
  title: string;
  description: string;
  severity: "informativo" | "atencao" | "urgente";
  trend: string | null;
  status: "open" | "seen" | "dismissed" | "converted";
  converted_to_action_id: string | null;
  first_signal_at: string;
  last_signal_at: string;
  signal_count: number;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function useAdsAIWarnings() {
  const { currentTenant } = useAuth();
  const qc = useQueryClient();
  const tenantId = currentTenant?.id;

  const warningsQuery = useQuery({
    queryKey: ["ads-ai-warnings", tenantId],
    queryFn: async (): Promise<AdsAIWarning[]> => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("ads_ai_warnings")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("last_signal_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AdsAIWarning[];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AdsAIWarning["status"] }) => {
      const { error } = await supabase
        .from("ads_ai_warnings")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-ai-warnings", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível atualizar o aviso"),
  });

  const warnings = warningsQuery.data || [];
  const unseenCount = warnings.filter((w) => w.status === "open").length;

  return {
    warnings,
    isLoading: warningsQuery.isLoading,
    unseenCount,
    markSeen: (id: string) => setStatus.mutate({ id, status: "seen" }),
    dismiss: (id: string) => setStatus.mutate({ id, status: "dismissed" }),
    isUpdating: setStatus.isPending,
  };
}
