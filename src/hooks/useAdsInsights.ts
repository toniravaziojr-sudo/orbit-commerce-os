import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface AdsInsight {
  id: string;
  tenant_id: string;
  channel: string;
  ad_account_id: string | null;
  title: string;
  body: string;
  evidence: Record<string, any> | null;
  recommended_action: Record<string, any> | null;
  priority: string;
  category: string;
  sentiment: string;
  status: string;
  resolved_at: string | null;
  created_at: string;
}

export function useAdsInsights() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const insightsQuery = useQuery({
    queryKey: ["ads-autopilot-insights", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads_autopilot_insights")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as AdsInsight[];
    },
    enabled: !!tenantId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("ads_autopilot_insights")
        .update({
          status,
          resolved_at: status !== "open" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-insights"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generateNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-weekly-insights", {
        body: { tenant_id: tenantId, trigger_type: "manual" },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro ao gerar insights");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-insights"] });
      toast.success("Insights gerados com sucesso!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    insights: insightsQuery.data || [],
    isLoading: insightsQuery.isLoading,
    markDone: (id: string) => updateStatus.mutate({ id, status: "done" }),
    markIgnored: (id: string) => updateStatus.mutate({ id, status: "ignored" }),
    generateNow,
  };
}
