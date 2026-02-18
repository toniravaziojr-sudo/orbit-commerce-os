// =============================================
// ADS PENDING ACTIONS TAB
// Shows cards of AI actions awaiting user approval
// =============================================

import { useAdsPendingActions } from "@/hooks/useAdsPendingActions";
import { ActionApprovalCard } from "@/components/ads/ActionApprovalCard";
import { useAdsChat } from "@/hooks/useAdsChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface AdsPendingActionsTabProps {
  scope: "global" | "account";
  adAccountId?: string;
  channel?: string;
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
      
      // Send a message to the AI chat requesting adjustment
      const message = `⚙️ Ajuste solicitado para ação "${actionLabel}" (ID: ${actionId}):\n\n${suggestion}\n\nPor favor, ajuste conforme solicitado e gere uma nova proposta para aprovação.`;
      
      // Reject original with reason and send chat message
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
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-medium text-muted-foreground">
            {pendingActions.length} {pendingActions.length === 1 ? "ação aguardando" : "ações aguardando"} aprovação
          </p>
        </div>
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
    </ScrollArea>
  );
}
