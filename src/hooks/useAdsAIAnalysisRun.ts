// =============================================================================
// useAdsAIAnalysisRun — Onda E
// Dispara e consulta execuções de análise inicial do Gestor de Tráfego IA.
// =============================================================================
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type AnalysisScope = "account" | "global";
export type AnalysisTrigger = "activation_initial" | "manual";

export interface AnalysisRun {
  id: string;
  tenant_id: string;
  platform: string;
  ad_account_id: string | null;
  scope: AnalysisScope;
  trigger: AnalysisTrigger;
  status: "queued" | "running" | "completed" | "failed";
  started_at: string | null;
  finished_at: string | null;
  diagnosis_summary: string | null;
  strategy_summary: string | null;
  limitations: unknown;
  created_action_ids: unknown;
  error_message: string | null;
  created_at: string;
}

interface RunParams {
  platform?: string;
  scope: AnalysisScope;
  ad_account_id?: string | null;
  trigger: AnalysisTrigger;
  force?: boolean;
}

export function useAdsAIAnalysisRun(opts: { platform?: string; adAccountId?: string | null; scope?: AnalysisScope } = {}) {
  const { currentTenant, user } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const platform = opts.platform || "meta";
  const scope: AnalysisScope = opts.scope || "account";

  const latest = useQuery({
    queryKey: ["ads-ai-analysis-runs", tenantId, platform, scope, opts.adAccountId || null],
    queryFn: async () => {
      let q = supabase
        .from("ads_ai_analysis_runs" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("platform", platform)
        .eq("scope", scope)
        .order("created_at", { ascending: false })
        .limit(5);
      if (scope === "account" && opts.adAccountId) q = q.eq("ad_account_id", opts.adAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as AnalysisRun[]) || [];
    },
    enabled: !!tenantId,
    refetchInterval: (query) => {
      const list = (query.state.data as AnalysisRun[] | undefined) || [];
      return list.some((r) => r.status === "running" || r.status === "queued") ? 5000 : false;
    },
  });

  const run = useMutation({
    mutationFn: async (params: RunParams) => {
      const { data, error } = await supabase.functions.invoke("ads-ai-initial-analysis", {
        body: {
          tenant_id: tenantId,
          platform: params.platform || platform,
          scope: params.scope,
          ad_account_id: params.scope === "account" ? params.ad_account_id : null,
          trigger: params.trigger,
          force: params.force === true,
          created_by: user?.id || null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (resp: any) => {
      const payload = resp?.data || resp;
      if (payload?.skipped && payload?.reason === "already_running") {
        toast.info("Já existe uma análise em andamento para este escopo.");
      } else if (payload?.skipped && payload?.reason === "recent_completed_requires_force") {
        toast.warning("Análise recente concluída. Confirme para rodar novamente.");
      } else if (payload?.status === "completed") {
        toast.success("Análise estratégica concluída.");
      } else if (payload?.status === "failed") {
        toast.error("A análise estratégica falhou. Veja o histórico.");
      } else {
        toast.success("Análise estratégica iniciada. Vamos avisar quando terminar.");
      }
      queryClient.invalidateQueries({ queryKey: ["ads-ai-analysis-runs", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      if (payload?.accepted || payload?.status === "queued") {
        [1000, 3000, 7000, 12000].forEach((delay) => {
          window.setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["ads-ai-analysis-runs", tenantId] });
            queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
          }, delay);
        });
      }
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível iniciar a análise."),
  });

  const latestRun = (latest.data || [])[0] || null;
  const hasRunning = (latest.data || []).some((r) => r.status === "running" || r.status === "queued");

  return { runs: latest.data || [], latestRun, hasRunning, isLoading: latest.isLoading, run };
}
