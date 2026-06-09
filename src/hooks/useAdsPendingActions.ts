// =============================================
// USE ADS PENDING ACTIONS
// Hook for managing actions awaiting user approval
// =============================================
//
// Frente 4 — Fluxo de duas etapas:
//  - pending_approval        → Etapa 1 (estratégia + brief)
//  - creative_pending        → Etapa 2 em andamento (gerando criativos)
//  - final_pending_approval  → Etapa 2 aguardando aprovação final
//  - approved/rejected/...   → fluxo legado
//
// O hook agora carrega TODOS os 3 estados ativos da fila para que os
// contadores, badges e modais reconheçam corretamente o pipeline.

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

export const TWO_STEP_FLOW_VERSION = "two_step_v1";
export const ACTIVE_PENDING_STATUSES = [
  "pending_approval",
  "creative_pending",
  "final_pending_approval",
] as const;

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

export function isTwoStepAction(action: { action_data?: any } | null | undefined): boolean {
  return (action as any)?.action_data?.flow_version === TWO_STEP_FLOW_VERSION;
}

export function getTwoStepStage(action: PendingAction): "strategy" | "generating" | "final" | "legacy" {
  if (!isTwoStepAction(action)) return "legacy";
  if (action.status === "creative_pending") return "generating";
  if (action.status === "final_pending_approval") return "final";
  return "strategy";
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
        .in("status", ACTIVE_PENDING_STATUSES as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(80);

      if (channelFilter) {
        query = query.eq("channel", channelFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      const actions = (data || []) as unknown as PendingAction[];
      return actions.filter(a => a.action_type !== "activate_campaign");
    },
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  // ===== Aprovação final / legada =====
  // Para propostas two-step em final_pending_approval, marca approved e
  // dispara o executor (publicação real). Para propostas legadas, mesmo fluxo.
  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const nowIso = new Date().toISOString();
      const expiresIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { data: current } = await supabase
        .from("ads_autopilot_actions" as any)
        .select("policy_check_result, status, action_data")
        .eq("id", actionId)
        .maybeSingle();

      // Guard duplo: não permitir aprovar Etapa 1 two-step pelo botão final
      if (isTwoStepAction(current) && (current as any)?.status === "pending_approval") {
        throw new Error("Esta proposta precisa passar pela Etapa 1 (Aprovar e gerar criativos).");
      }

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

      const { error: execErr } = await supabase.functions.invoke("ads-autopilot-execute-approved", {
        body: { tenant_id: tenantId, action_id: actionId },
      });
      if (execErr) console.warn("Execute approved error (non-blocking):", execErr);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      toast.success("Campanha aprovada e enviada para publicação");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'processar' }),
  });

  // ===== Frente 4 — Etapa 1: aprovar estratégia e disparar geração de criativos =====
  const approveStrategy = useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-approve-strategy", {
        body: { tenant_id: tenantId, action_id: actionId },
      });
      if (error) throw error;
      if (!(data as any)?.success) {
        throw new Error((data as any)?.error || "Falha ao aprovar estratégia");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      toast.success("Estratégia aprovada — gerando criativos…");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'aprovar estratégia' }),
  });

  // ===== Frente 4 — Finalização: criativo pronto → aguardando aprovação final =====
  const finalizeCreative = useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-finalize-creative", {
        body: { tenant_id: tenantId, action_id: actionId },
      });
      if (error) throw error;
      if (!(data as any)?.success) {
        throw new Error((data as any)?.error || "Criativo ainda não está pronto");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
    },
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
    approveStrategy,
    finalizeCreative,
    rejectAction,
  };
}
