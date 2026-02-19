// =============================================
// ADS PENDING ACTIONS TAB — v5.12.8
// Shows cards of AI actions awaiting user approval
// with global budget summary header
// =============================================

import { useAdsPendingActions } from "@/hooks/useAdsPendingActions";
import { ActionApprovalCard } from "@/components/ads/ActionApprovalCard";
import { useAdsChat } from "@/hooks/useAdsChat";
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

  // Use the chat hook to send adjustment messages
  const chat = useAdsChat({ scope, adAccountId, channel });

  const handleAdjust = async (actionId: string, suggestion: string) => {
    try {
      const action = pendingActions.find(a => a.id === actionId);
      const actionLabel = action?.action_data?.campaign_name || action?.action_type || actionId;
      
      const message = `⚙️ Ajuste solicitado para ação "${actionLabel}" (ID: ${actionId}):\n\n${suggestion}\n\nPor favor, ajuste conforme solicitado e gere uma nova proposta para aprovação.`;
      
      await rejectAction.mutateAsync({ actionId, reason: `Ajuste solicitado: ${suggestion}` });
      await chat.sendMessage(message);
      
      toast.success("Ajuste enviado para a IA processar");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar ajuste");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pendingActions.length === 0) {
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
    <ScrollArea className="flex-1">
      <div className="py-4 space-y-3">
        {/* Budget Summary Header */}
        <BudgetSummaryHeader pendingActions={pendingActions} />

        <div className="px-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">
              {pendingActions.length} {pendingActions.length === 1 ? "ação aguardando" : "ações aguardando"} aprovação
            </p>
          </div>
          <div className="space-y-3">
            {pendingActions.map((action) => (
              <ActionApprovalCard
                key={action.id}
                action={action}
                onApprove={(id) => approveAction.mutate(id)}
                onReject={(id, reason) => rejectAction.mutate({ actionId: id, reason })}
                onAdjust={handleAdjust}
                isApproving={approveAction.isPending}
                isRejecting={rejectAction.isPending}
              />
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
