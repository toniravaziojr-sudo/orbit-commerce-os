// =============================================
// USE ADS PENDING ACTIONS
// Hook for managing actions awaiting user approval
// =============================================

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

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
      const actions = (data || []) as unknown as PendingAction[];
      // Only filter out activate_campaign; adsets are kept for grouping under campaigns
      return actions.filter(a => a.action_type !== "activate_campaign");
    },
    enabled: !!tenantId,
    refetchInterval: 15000, // Auto-refresh every 15s
  });

  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      // Fase B: registrar aprovação humana com auditoria; NUNCA gravar executed_at aqui.
      // executed_at só é preenchido quando a execução real (chamada externa) acontecer.
      const { data: userRes } = await supabase.auth.getUser();
      const nowIso = new Date().toISOString();
      // TTL conservador default = 24h (Fase B). Refinamento por categoria fica para Fase C.
      const expiresIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Hardening de auditoria (Fase C.4): a aprovação manual precisa ficar
      // explicitamente distinta de uma autoexecução por política. Lemos o
      // policy_check_result atual e anexamos `autoexec_audit.approval_source=human_approval`.
      const { data: current } = await supabase
        .from("ads_autopilot_actions" as any)
        .select("policy_check_result")
        .eq("id", actionId)
        .maybeSingle();

      const humanAudit = {
        approval_source: "human_approval",
        human_approved: true,
        approved_by_user: true,
        auto_executed: false,
        auto_execution_phase: null,
        effective_autonomy_mode: null,
        effective_autonomy_source: null,
        executed_by: "user",
        approved_by: userRes.user?.id ?? null,
        at: nowIso,
      };

      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({
          status: "approved",
          approved_at: nowIso,
          approved_by_user_id: userRes.user?.id ?? null,
          approval_expires_at: expiresIso,
          auto_executed: false,
          policy_check_result: {
            ...((current as any)?.policy_check_result || {}),
            autoexec_audit: humanAudit,
          },
        } as any)
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
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'processar' }),
  });

  const rejectAction = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data: current } = await supabase
        .from("ads_autopilot_actions" as any)
        .select("policy_check_result")
        .eq("id", actionId)
        .maybeSingle();
      const rejectAudit = {
        approval_source: "rejected_by_user",
        human_approved: false,
        approved_by_user: false,
        auto_executed: false,
        executed_by: null,
        rejected_by: userRes.user?.id ?? null,
        rejection_reason: reason,
        at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({
          status: "rejected",
          rejection_reason: reason,
          policy_check_result: {
            ...((current as any)?.policy_check_result || {}),
            autoexec_audit: rejectAudit,
          },
        } as any)
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      toast.success("Ação rejeitada");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'processar' }),
  });

  return {
    pendingActions: pendingQuery.data || [],
    pendingCount: pendingQuery.data?.length || 0,
    isLoading: pendingQuery.isLoading,
    approveAction,
    rejectAction,
  };
}