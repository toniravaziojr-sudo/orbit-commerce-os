import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CommandInsight {
  id: string;
  tenant_id: string;
  title: string;
  summary: string;
  category: string;
  severity: string;
  data: Record<string, any>;
  status: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

export function useCommandInsights(statusFilter?: string) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["command-insights", tenantId, statusFilter],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from("command_insights")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CommandInsight[];
    },
    enabled: !!tenantId,
  });
}

export function useMarkInsightRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (insightId: string) => {
      const { error } = await supabase
        .from("command_insights")
        .update({ status: "read" } as any)
        .eq("id", insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["command-insights"] });
    },
  });
}

export function useGenerateInsights() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não encontrado");
      
      const { data, error } = await supabase.functions.invoke("command-insights-generate", {
        body: { tenant_id: currentTenant.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["command-insights"] });
      toast.success(`${data?.insights_generated || 0} insights gerados com sucesso!`);
    },
    onError: (err) => {
      toast.error("Erro ao gerar insights: " + (err as Error).message);
    },
  });
}
