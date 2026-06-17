import { useState } from "react";
import { Hourglass, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AutopilotAction } from "@/hooks/useAdsAutopilot";
import { ActionApprovalCard, OrphanAdsetGroupCard, type RejectMode } from "./ActionApprovalCard";
import { ApprovedProposalsSection } from "./ApprovedProposalsSection";
import type { PendingAction } from "@/hooks/useAdsPendingActions";
import { showErrorToast } from '@/lib/error-toast';
import { useAdsAutopilotFeedbackGate } from "@/hooks/useAdsAutopilotFeedbackGate";
import { useAdsPendingActions } from "@/hooks/useAdsPendingActions";

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
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const feedbackGate = useAdsAutopilotFeedbackGate(tenantId);

  const runApprove = (id: string) => {
    setApprovingId(id);
    approveAction.mutate(id, { onSettled: () => setApprovingId(null) });
  };
  const runReject = (id: string, reason: string, mode: RejectMode) => {
    setRejectingId(id);
    rejectAction.mutate({ actionId: id, reason }, {
      onSettled: () => setRejectingId(null),
      onSuccess: () => {
        if (mode === "regenerate") {
          adjustAction.mutate({ actionId: id, feedback: "Usuário rejeitou e solicitou nova proposta" });
        }
      },
    });
  };
  const gateApprove = (id: string) => {
    const action = pendingActions.find(a => a.id === id);
    if (!action) return runApprove(id);
    feedbackGate.requestApproval(action, () => runApprove(id));
  };
  const gateReject = (id: string, reason: string, mode: RejectMode) => {
    const action = pendingActions.find(a => a.id === id);
    if (!action) return runReject(id, reason, mode);
    feedbackGate.requestRejection(action, () => runReject(id, reason, mode));
  };

  const { pendingActions = [], isLoading } = useAdsPendingActions(channelFilter);

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
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'aprovar' }),
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
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'processar' }),
  });

  // Caminho oficial de "Ajustar proposta" — NÃO rejeita o plano.
  // Toda a lógica vive em ads-autopilot-request-adjustment.
  const adjustAction = useMutation({
    mutationFn: async ({ actionId, feedback }: { actionId: string; feedback: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "ads-autopilot-request-adjustment",
        { body: { tenant_id: tenantId, action_id: actionId, feedback } },
      );
      if (error) throw error;
      if (data && (data as any).success === false) {
        const code = (data as any).error;
        const map: Record<string, string> = {
          feedback_too_short: "Descreva o ajuste com um pouco mais de detalhe.",
          proposal_not_adjustable: "Esta proposta não pode mais ser ajustada.",
          proposal_already_superseded: "Esta proposta já foi substituída por uma nova versão.",
          proposal_not_found: "Proposta não encontrada.",
          tenant_mismatch: "Proposta de outro tenant.",
          strategist_revision_failed:
            "Não foi possível gerar a nova versão. Verifique o saldo de IA e tente novamente.",
        };
        throw new Error(map[code] || (data as any).message || "Falha ao solicitar ajuste.");
      }
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-ai-learnings"] });
      setAdjustingId(null);
      if (data?.already_in_progress) {
        toast.success("Já existe um ajuste em processamento para esta proposta.");
      } else if (data?.new_action_id) {
        toast.success("Nova versão gerada e disponível em Aguardando Ação.");
      } else {
        toast.success("Pedido de ajuste registrado.");
      }
    },
    onError: (err) => {
      setAdjustingId(null);
      showErrorToast(err, { module: 'anúncios', action: 'ajustar proposta' });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  // Group: campaigns as parents, adsets nested
  const campaigns = pendingActions.filter(a => a.action_type !== "create_adset");
  const adsets = pendingActions.filter(a => a.action_type === "create_adset");

  // Build a map: adset campaign_name → adsets
  const adsetsByParent = new Map<string, typeof adsets>();
  for (const adset of adsets) {
    const parentName = (adset.action_data as any)?.campaign_name || (adset.action_data as any)?.parent_campaign_name || "";
    if (!adsetsByParent.has(parentName)) adsetsByParent.set(parentName, []);
    adsetsByParent.get(parentName)!.push(adset);
  }

  // Two-pass matching: 1) exact name match, 2) session_id fallback
  const campaignChildMap = new Map<string, typeof adsets>();
  const matchedAdsetIds = new Set<string>();

  // Pass 1: exact name match
  for (const c of campaigns) {
    const campaignName = (c.action_data as any)?.campaign_name || (c.action_data as any)?.preview?.campaign_name || "";
    const matched = adsetsByParent.get(campaignName) || [];
    if (matched.length > 0) {
      campaignChildMap.set(c.id, [...(campaignChildMap.get(c.id) || []), ...matched]);
      matched.forEach(a => matchedAdsetIds.add(a.id));
    }
  }

  // Pass 2: session_id fallback for unmatched adsets
  const unmatchedAdsets = adsets.filter(a => !matchedAdsetIds.has(a.id));
  if (unmatchedAdsets.length > 0) {
    const sessionCampaigns = new Map<string, typeof campaigns>();
    for (const c of campaigns) {
      const sid = c.session_id;
      if (!sessionCampaigns.has(sid)) sessionCampaigns.set(sid, []);
      sessionCampaigns.get(sid)!.push(c);
    }

    for (const adset of unmatchedAdsets) {
      const sid = adset.session_id;
      const sessionCamps = sessionCampaigns.get(sid);
      if (sessionCamps && sessionCamps.length > 0) {
        const adsetCampName = ((adset.action_data as any)?.campaign_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        let bestCampaign = sessionCamps[0];
        let bestScore = 0;
        for (const c of sessionCamps) {
          const cName = ((c.action_data as any)?.campaign_name || (c.action_data as any)?.preview?.campaign_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          let score = 0;
          const shorter = adsetCampName.length < cName.length ? adsetCampName : cName;
          const longer = adsetCampName.length < cName.length ? cName : adsetCampName;
          for (let i = 0; i < shorter.length; i++) {
            if (longer.includes(shorter.substring(i, i + 3))) score++;
          }
          if (score > bestScore) { bestScore = score; bestCampaign = c; }
        }
        if (!campaignChildMap.has(bestCampaign.id)) campaignChildMap.set(bestCampaign.id, []);
        campaignChildMap.get(bestCampaign.id)!.push(adset);
        matchedAdsetIds.add(adset.id);
      }
    }
  }

  const getChildActions = (action: typeof campaigns[0]) => campaignChildMap.get(action.id) || [];

  // Orphan adsets: still unmatched after both passes
  const orphanAdsetGroups = new Map<string, typeof adsets>();
  for (const a of adsets) {
    if (!matchedAdsetIds.has(a.id)) {
      const parentName = (a.action_data as any)?.campaign_name || (a.action_data as any)?.parent_campaign_name || "";
      const groupKey = parentName || "Sem campanha";
      if (!orphanAdsetGroups.has(groupKey)) orphanAdsetGroups.set(groupKey, []);
      orphanAdsetGroups.get(groupKey)!.push(a);
    }
  }

  const displayCount = campaigns.length + orphanAdsetGroups.size;

  if (displayCount === 0) {
    return (
      <div className="space-y-4">
        <ApprovedProposalsSection channelFilter={channelFilter} />
        <EmptyState
          icon={Hourglass}
          title="Nenhuma ação aguardando aprovação"
          description="Quando a IA propor ações de alto impacto, elas aparecerão aqui para sua revisão"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Propostas aprovadas em andamento (H.4.2) */}
      <ApprovedProposalsSection channelFilter={channelFilter} />

      {/* Budget Summary */}
      <BudgetSummaryHeader pendingActions={pendingActions} />

      {/* Pending count banner */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Hourglass className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {displayCount} {displayCount === 1 ? "proposta aguardando" : "propostas aguardando"} sua decisão
        </span>
      </div>


      {/* Campaign cards with nested adsets */}
      {campaigns.map(action => (
        <ActionApprovalCard
          key={action.id}
          action={action}
          childActions={getChildActions(action)}
          onApprove={gateApprove}
          onReject={gateReject}
          onAdjust={(id, suggestion) => { setAdjustingId(id); adjustAction.mutate({ actionId: id, feedback: suggestion }); }}
          approvingId={approvingId}
          rejectingId={rejectingId}
          adjustingId={adjustingId}
        />
      ))}
      {/* Orphan adsets grouped by parent campaign */}
      {Array.from(orphanAdsetGroups.entries()).map(([parentName, groupAdsets]) => (
        <OrphanAdsetGroupCard
          key={`orphan-${parentName}`}
          parentCampaignName={parentName}
          adsets={groupAdsets}
          onApprove={gateApprove}
          onReject={gateReject}
          onAdjust={(id, suggestion) => { setAdjustingId(id); adjustAction.mutate({ actionId: id, feedback: suggestion }); }}
          approvingId={approvingId}
          rejectingId={rejectingId}
          adjustingId={adjustingId}
        />
      ))}
      {feedbackGate.FeedbackDialog}
    </div>
  );
}