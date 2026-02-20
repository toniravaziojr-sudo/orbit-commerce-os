// =============================================
// ADS PENDING ACTIONS TAB — v5.12.8
// Shows cards of AI actions awaiting user approval
// with global budget summary header
// =============================================

import { useState } from "react";

import { useAdsPendingActions } from "@/hooks/useAdsPendingActions";
import { ActionApprovalCard, OrphanAdsetGroupCard } from "@/components/ads/ActionApprovalCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardCheck, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";

interface AdsPendingActionsTabProps {
  scope: "global" | "account";
  adAccountId?: string;
  channel?: string;
}

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

function BudgetSummaryHeader({ pendingActions }: { pendingActions: any[] }) {
  // Extract budget_snapshot from the first action that has it
  const snapshot = pendingActions.find(a => a.action_data?.preview?.budget_snapshot)?.action_data?.preview?.budget_snapshot;
  if (!snapshot || !snapshot.limit_cents) return null;

  const active = snapshot.active_cents || 0;
  const reserved = snapshot.pending_reserved_cents || 0;
  const remaining = Math.max(0, snapshot.limit_cents - active - reserved);

  return (
    <div className="mx-4 mb-3 p-3 rounded-lg bg-muted/30 border border-border/40">
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

export function AdsPendingActionsTab({ scope, adAccountId, channel }: AdsPendingActionsTabProps) {
  const channelFilter = scope === "account" ? channel : undefined;
  const { pendingActions, isLoading, approveAction, rejectAction } = useAdsPendingActions(channelFilter);
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  // Direct strategist invocation for scoped revision (same as AdsPendingApprovalTab)
  const handleAdjust = async (actionId: string, suggestion: string) => {
    setAdjustingId(actionId);
    try {
      const tenantId = currentTenant?.id;
      if (!tenantId) throw new Error("Tenant não selecionado");

      const targetAction = pendingActions.find(a => a.id === actionId);
      const actionData = (targetAction?.action_data || {}) as Record<string, any>;
      const actionType = targetAction?.action_type || "unknown";

      // 1. Reject the action with feedback
      await rejectAction.mutateAsync({ actionId, reason: `Ajuste solicitado: ${suggestion}` });

      // 2. Collect names of other pending campaigns so the strategist knows NOT to recreate them
      const otherPendingNames = pendingActions
        .filter(a => a.id !== actionId && a.action_type === "create_campaign" && a.status === "pending_approval")
        .map(a => (a.action_data as any)?.campaign_name || (a.action_data as any)?.preview?.campaign_name)
        .filter(Boolean);

      // 3. Re-trigger strategist with scoped revision
      const { data, error: stratErr } = await supabase.functions.invoke("ads-autopilot-strategist", {
        body: { 
          tenant_id: tenantId, 
          trigger: "revision",
          revision_feedback: suggestion,
          revision_action_id: actionId,
          revision_action_type: actionType,
          revision_action_data: {
            campaign_name: actionData.campaign_name || actionData.preview?.campaign_name,
            product_name: actionData.product_name,
            funnel_stage: actionData.funnel_stage || actionData.preview?.funnel_stage,
          },
          other_pending_campaigns: otherPendingNames,
        },
      });
      if (stratErr) console.error("Strategist re-trigger error:", stratErr);
      if (data && !data.success) console.error("Strategist revision error:", data.error);

      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-sessions"] });
      toast.success("Feedback enviado! A IA está gerando um novo plano com seus ajustes...");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar ajuste");
    } finally {
      setAdjustingId(null);
    }
  };

  // Group: campaigns as parents, adsets nested under their parent campaign
  const campaigns = pendingActions.filter(a => a.action_type !== "create_adset");
  const adsets = pendingActions.filter(a => a.action_type === "create_adset");

  const adsetsByParent = new Map<string, typeof adsets>();
  for (const adset of adsets) {
    const parentName = (adset.action_data as any)?.campaign_name || (adset.action_data as any)?.parent_campaign_name || "";
    if (!adsetsByParent.has(parentName)) adsetsByParent.set(parentName, []);
    adsetsByParent.get(parentName)!.push(adset);
  }

  const getChildActions = (action: typeof campaigns[0]) => {
    const campaignName = (action.action_data as any)?.campaign_name || (action.action_data as any)?.preview?.campaign_name || "";
    return adsetsByParent.get(campaignName) || [];
  };

  const matchedParents = new Set<string>();
  for (const c of campaigns) {
    const name = (c.action_data as any)?.campaign_name || (c.action_data as any)?.preview?.campaign_name || "";
    if (adsetsByParent.has(name)) matchedParents.add(name);
  }

  const orphanAdsetGroups = new Map<string, typeof adsets>();
  for (const a of adsets) {
    const parentName = (a.action_data as any)?.campaign_name || (a.action_data as any)?.parent_campaign_name || "";
    if (!matchedParents.has(parentName)) {
      const groupKey = parentName || "Sem campanha";
      if (!orphanAdsetGroups.has(groupKey)) orphanAdsetGroups.set(groupKey, []);
      orphanAdsetGroups.get(groupKey)!.push(a);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayCount = campaigns.length + orphanAdsetGroups.size;

  if (displayCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 mb-3">
          <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nenhuma ação pendente</p>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-[280px]">
          Quando a IA propuser novas campanhas ou criativos, eles aparecerão aqui para sua aprovação.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-hidden min-w-0">
      <div className="py-4 space-y-3">
        {/* Budget Summary Header */}
        <BudgetSummaryHeader pendingActions={pendingActions} />

        <div className="px-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">
              {displayCount} {displayCount === 1 ? "proposta aguardando" : "propostas aguardando"} aprovação
            </p>
          </div>
          <div className="space-y-3">
            {/* Campaigns with nested adsets */}
            {campaigns.map((action) => (
              <ActionApprovalCard
                key={action.id}
                action={action}
                childActions={getChildActions(action)}
                onApprove={(id) => { setApprovingId(id); approveAction.mutate(id, { onSettled: () => setApprovingId(null) }); }}
                onReject={(id, reason) => { setRejectingId(id); rejectAction.mutate({ actionId: id, reason }, { onSettled: () => setRejectingId(null) }); }}
                onAdjust={handleAdjust}
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
                onApprove={(id) => { setApprovingId(id); approveAction.mutate(id, { onSettled: () => setApprovingId(null) }); }}
                onReject={(id, reason) => { setRejectingId(id); rejectAction.mutate({ actionId: id, reason }, { onSettled: () => setRejectingId(null) }); }}
                onAdjust={handleAdjust}
                approvingId={approvingId}
                rejectingId={rejectingId}
                adjustingId={adjustingId}
              />
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
