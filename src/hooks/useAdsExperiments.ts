// =============================================
// USE ADS EXPERIMENTS
// Hook for managing AI-driven ad experiments
// =============================================

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface AdsExperiment {
  id: string;
  tenant_id: string;
  channel: string;
  ad_account_id: string | null;
  hypothesis: string;
  variable_type: string;
  plan: Record<string, any> | null;
  budget_cents: number | null;
  duration_days: number | null;
  min_spend_cents: number | null;
  min_conversions: number | null;
  start_at: string | null;
  end_at: string | null;
  success_criteria: Record<string, any> | null;
  status: string;
  results: Record<string, any> | null;
  winner_variant_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useAdsExperiments() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const experimentsQuery = useQuery({
    queryKey: ["ads-autopilot-experiments", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads_autopilot_experiments")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AdsExperiment[];
    },
    enabled: !!tenantId,
  });

  const createExperiment = useMutation({
    mutationFn: async (experiment: Partial<AdsExperiment> & { channel: string; hypothesis: string; variable_type: string }) => {
      const { error } = await supabase
        .from("ads_autopilot_experiments")
        .insert({ tenant_id: tenantId, ...experiment } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-experiments"] });
      toast.success("Experimento criado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateExperiment = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AdsExperiment> & { id: string }) => {
      const { error } = await supabase
        .from("ads_autopilot_experiments")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-experiments"] });
      toast.success("Experimento atualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelExperiment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ads_autopilot_experiments")
        .update({ status: "cancelled", end_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-experiments"] });
      toast.success("Experimento cancelado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runExperiments = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-experiments-run", {
        body: { tenant_id: tenantId, trigger_type: "manual" },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro ao avaliar experimentos");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-experiments"] });
      toast.success("Experimentos avaliados com sucesso!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getActiveExperiments = (channel?: string, accountId?: string) => {
    return (experimentsQuery.data || []).filter(e => {
      if (e.status !== "running" && e.status !== "planned") return false;
      if (channel && e.channel !== channel) return false;
      if (accountId && e.ad_account_id !== accountId) return false;
      return true;
    });
  };

  return {
    experiments: experimentsQuery.data || [],
    isLoading: experimentsQuery.isLoading,
    createExperiment,
    updateExperiment,
    cancelExperiment,
    runExperiments,
    getActiveExperiments,
  };
}
