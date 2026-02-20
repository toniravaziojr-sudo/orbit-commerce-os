// =============================================
// USE ADS PENDING ACTIONS
// Hook for managing actions awaiting user approval
// =============================================

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface PendingAction {
  id: string;
  tenant_id: string;
  session_id: string;
  channel: string;
  action_type: string;
  action_data: Record<string, any> | null;
  reasoning: string | null;
  expected_impact: string | null;
  confidence: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

export function useAdsPendingActions(channelFilter?: string) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const pendingQuery = useQuery({
    queryKey: ["ads-pending-actions", tenantId, channelFilter],
    queryFn: async () => {
      let query = supabase
        .from("ads_autopilot_actions" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false })
        .limit(50);

      if (channelFilter) {
        query = query.eq("channel", channelFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Filter out internal/technical actions that shouldn't be shown to users
      const actions = (data || []) as unknown as PendingAction[];
      return actions.filter(a => !["activate_campaign"].includes(a.action_type));
    },
    enabled: !!tenantId,
    refetchInterval: 15000, // Auto-refresh every 15s
  });

  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ status: "approved", executed_at: new Date().toISOString() } as any)
        .eq("id", actionId);
      if (error) throw error;

      // Trigger execution via edge function
      const { error: execErr } = await supabase.functions.invoke("ads-autopilot-execute-approved", {
        body: { tenant_id: tenantId, action_id: actionId },
      });
      if (execErr) console.warn("Execute approved error (non-blocking):", execErr);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      toast.success("Ação aprovada e enviada para execução");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectAction = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ status: "rejected", rejection_reason: reason } as any)
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      toast.success("Ação rejeitada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    pendingActions: pendingQuery.data || [],
    pendingCount: pendingQuery.data?.length || 0,
    isLoading: pendingQuery.isLoading,
    approveAction,
    rejectAction,
  };
}
