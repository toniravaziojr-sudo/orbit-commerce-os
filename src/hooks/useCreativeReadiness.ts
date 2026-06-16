// =============================================================================
// useCreativeReadiness — Onda H.4.1
// Lê o veredito do motor de prontidão server-side. Front nunca decide.
// =============================================================================

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

export interface CreativeReadinessIssue {
  field: string;
  label_pt: string;
  reason_pt: string;
  where_to_fix: string;
  action_label: string;
  severity: "blocker" | "warning";
  node_type: string;
  node_id: string | null;
}

export interface CreativeReadinessCostEstimate {
  calculable: boolean;
  total_credits: number | null;
  total_jobs: number;
  jobs_by_format: Record<string, { count: number; credits_each: number | null; service_key: string | null }>;
  source: "service_pricing" | null;
  cost_table_version: string | null;
}

export interface CreativeReadinessResult {
  contract_version: string;
  status: "ready" | "blocked";
  summary: string;
  blockers: CreativeReadinessIssue[];
  warnings: CreativeReadinessIssue[];
  cost_estimate: CreativeReadinessCostEstimate;
}

export interface ReadinessResponse {
  success: boolean;
  readiness?: CreativeReadinessResult;
  error_pt?: string;
  existing_jobs_count?: number;
  product_resolved?: boolean;
}

export function useCreativeReadiness(actionId: string | null, enabled = true) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["creative-readiness", tenantId, actionId],
    enabled: enabled && !!tenantId && !!actionId,
    refetchInterval: 30000,
    queryFn: async (): Promise<ReadinessResponse> => {
      const { data, error } = await supabase.functions.invoke("ads-creative-readiness", {
        body: { tenant_id: tenantId, action_id: actionId },
      });
      if (error) throw error;
      return data as ReadinessResponse;
    },
  });

  const enqueue = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ads-enqueue-creatives", {
        body: { tenant_id: tenantId, action_id: actionId },
      });
      if (error) throw error;
      const payload = data as any;
      if (!payload?.success) throw new Error(payload?.error_pt || "Falha ao iniciar geração.");
      return payload;
    },
    onSuccess: (data) => {
      if (data?.already_enqueued) {
        toast.message("Geração já estava em andamento.");
      } else {
        toast.success("Geração de criativos iniciada!");
      }
      queryClient.invalidateQueries({ queryKey: ["creative-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["ads-approved-proposals-awaiting-publish"] });
    },
    onError: (err) => showErrorToast(err, { module: "anúncios", action: "gerar criativos" }),
  });

  return {
    readiness: query.data?.readiness,
    isReady: query.data?.readiness?.status === "ready",
    blockers: query.data?.readiness?.blockers ?? [],
    cost: query.data?.readiness?.cost_estimate,
    productResolved: query.data?.product_resolved ?? false,
    existingJobsCount: query.data?.existing_jobs_count ?? 0,
    isLoading: query.isLoading,
    refresh: () => query.refetch(),
    enqueue: enqueue.mutate,
    isEnqueuing: enqueue.isPending,
  };
}
