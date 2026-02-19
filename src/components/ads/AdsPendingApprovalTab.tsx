import { useState } from "react";
import { Hourglass, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AutopilotAction } from "@/hooks/useAdsAutopilot";
import { ActionApprovalCard } from "./ActionApprovalCard";
import type { PendingAction } from "@/hooks/useAdsPendingActions";

interface AdsPendingApprovalTabProps {
  channelFilter?: string;
  pollInterval?: number;
}

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

function BudgetSummaryHeader({ pendingActions }: { pendingActions: any[] }) {
  const snapshot = pendingActions.find(a => a.action_data?.preview?.budget_snapshot)?.action_data?.preview?.budget_snapshot;
  if (!snapshot || !snapshot.limit_cents) return null;

  const active = snapshot.active_cents || 0;
  const reserved = snapshot.pending_reserved_cents || 0;
  const remaining = Math.max(0, snapshot.limit_cents - active - reserved);

  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Orçamento da Conta</span>
        <span className="text-xs font-semibold ml-auto">{formatCents(snapshot.limit_cents)}/dia</span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
        {active > 0 && (
          <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${Math.min((active / snapshot.limit_cents) * 100, 100)}%` }} />
        )}
        {reserved > 0 && (
          <div className="h-full bg-amber-400" style={{ width: `${Math.min((reserved / snapshot.limit_cents) * 100, 100 - (active / snapshot.limit_cents) * 100)}%` }} />
        )}
      </div>
      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
          Ativo {formatCents(active)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
          Reservado {formatCents(reserved)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted inline-block" />
          Restante {formatCents(remaining)}
        </span>
      </div>
    </div>
  );
}

export function AdsPendingApprovalTab({ channelFilter, pollInterval = 15000 }: AdsPendingApprovalTabProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: pendingActions = [], isLoading } = useQuery({
    queryKey: ["ads-pending-approval", tenantId, channelFilter],
    queryFn: async () => {
      let query = supabase
        .from("ads_autopilot_actions" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });

      if (channelFilter) {
        query = query.eq("channel", channelFilter);
      }

      const { data } = await query;
      return (data || []) as unknown as PendingAction[];
    },
    enabled: !!tenantId,
    refetchInterval: pollInterval,
  });

  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-execute-approved", {
        body: { tenant_id: tenantId, action_id: actionId },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro ao executar ação");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      toast.success("Ação aprovada e executada com sucesso");
    },
    onError: (err: Error) => toast.error("Erro ao aprovar: " + err.message),
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
      queryClient.invalidateQueries({ queryKey: ["ads-pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      toast.success("Ação rejeitada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const adjustAction = useMutation({
    mutationFn: async ({ actionId, feedback }: { actionId: string; feedback: string }) => {
      // 1. Reject the action with feedback
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ status: "rejected", rejection_reason: `Ajuste solicitado: ${feedback}` } as any)
        .eq("id", actionId);
      if (error) throw error;

      // 2. Re-trigger strategist with revision feedback
      const { data, error: stratErr } = await supabase.functions.invoke("ads-autopilot-strategist", {
        body: { 
          tenant_id: tenantId, 
          trigger: "revision",
          revision_feedback: feedback,
        },
      });
      if (stratErr) console.error("Strategist re-trigger error:", stratErr);
      if (data && !data.success) console.error("Strategist revision error:", data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-sessions"] });
      toast.success("Feedback enviado! A IA está gerando um novo plano com seus ajustes...");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  if (pendingActions.length === 0) {
    return (
      <EmptyState
        icon={Hourglass}
        title="Nenhuma ação aguardando aprovação"
        description="Quando a IA propor ações de alto impacto, elas aparecerão aqui para sua revisão"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Budget Summary */}
      <BudgetSummaryHeader pendingActions={pendingActions} />

      {/* Pending count banner */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Hourglass className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {pendingActions.length} {pendingActions.length === 1 ? "proposta aguardando" : "propostas aguardando"} sua decisão
        </span>
      </div>

      {/* Action cards */}
      {pendingActions.map(action => (
        <ActionApprovalCard
          key={action.id}
          action={action}
          onApprove={(id) => approveAction.mutate(id)}
          onReject={(id, reason) => rejectAction.mutate({ actionId: id, reason })}
          onAdjust={(id, suggestion) => adjustAction.mutate({ actionId: id, feedback: suggestion })}
          isApproving={approveAction.isPending}
          isRejecting={rejectAction.isPending}
        />
      ))}
    </div>
  );
}
