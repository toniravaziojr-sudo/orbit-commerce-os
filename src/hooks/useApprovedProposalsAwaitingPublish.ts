// =============================================================================
// useApprovedProposalsAwaitingPublish — Onda H.4.2
// Lista propostas aprovadas (status='approved', action_type='campaign_proposal')
// cujo ciclo de vida está entre "geração de criativos" e "publicação".
// =============================================================================

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

export const AWAITING_PUBLISH_LIFECYCLE = [
  "campaign_creatives_generating",
  "campaign_creatives_ready",
  "campaign_creatives_failed",
  "campaign_implementation_failed",
] as const;

export interface ApprovedProposalRow {
  id: string;
  tenant_id: string;
  channel: string;
  action_type: string;
  action_data: any;
  status: string;
  created_at: string;
  approved_at: string | null;
}

export function useApprovedProposalsAwaitingPublish(channelFilter?: string) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const query = useQuery({
    queryKey: ["ads-approved-proposals-awaiting-publish", tenantId, channelFilter],
    queryFn: async () => {
      let q = supabase
        .from("ads_autopilot_actions" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("action_type", "campaign_proposal")
        .eq("status", "approved")
        .order("approved_at", { ascending: false })
        .limit(40);
      if (channelFilter) q = q.eq("channel", channelFilter);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as unknown as ApprovedProposalRow[];
      return rows.filter(r => {
        const lc = r.action_data?.lifecycle?.status;
        return AWAITING_PUBLISH_LIFECYCLE.includes(lc as any);
      });
    },
    enabled: !!tenantId,
    refetchInterval: 12000,
  });

  const publish = useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-publish-proposal", {
        body: { tenant_id: tenantId, action_id: actionId },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error_pt || "Falha ao publicar campanha.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-approved-proposals-awaiting-publish"] });
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      toast.success("Campanha enviada para publicação!");
    },
    onError: (err) => showErrorToast(err, { module: "anúncios", action: "publicar campanha" }),
  });

  return {
    proposals: query.data || [],
    isLoading: query.isLoading,
    publishProposal: publish.mutate,
    isPublishing: publish.isPending,
  };
}
