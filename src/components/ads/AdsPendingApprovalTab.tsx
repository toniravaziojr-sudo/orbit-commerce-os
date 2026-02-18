import { useState, useEffect } from "react";
import { Hourglass, ThumbsUp, ThumbsDown, MessageCircle, Bot, Image, TrendingUp, DollarSign, Pause, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AutopilotAction } from "@/hooks/useAdsAutopilot";
import { ActionDetailDialog } from "./ActionDetailDialog";

interface AdsPendingApprovalTabProps {
  /** Filter by channel (for per-account view) */
  channelFilter?: string;
  /** Polling interval in ms */
  pollInterval?: number;
}

const ACTION_ICONS: Record<string, any> = {
  pause_campaign: Pause,
  adjust_budget: DollarSign,
  create_campaign: TrendingUp,
  create_adset: TrendingUp,
  generate_creative: Image,
  allocate_budget: TrendingUp,
  report_insight: Bot,
};

const ACTION_LABELS: Record<string, string> = {
  pause_campaign: "Pausar Campanha",
  adjust_budget: "Ajustar Orçamento",
  create_campaign: "Criar Campanha",
  create_adset: "Criar Conjunto de Anúncios",
  generate_creative: "Gerar Criativo",
  allocate_budget: "Alocar Orçamento",
  report_insight: "Insight Estratégico",
};

export function AdsPendingApprovalTab({ channelFilter, pollInterval = 15000 }: AdsPendingApprovalTabProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;
  const [feedbackActionId, setFeedbackActionId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [detailAction, setDetailAction] = useState<AutopilotAction | null>(null);

  // Fetch pending_approval actions with polling
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
      return (data || []) as unknown as AutopilotAction[];
    },
    enabled: !!tenantId,
    refetchInterval: pollInterval,
  });

  // Approve action — calls edge function to execute on Meta
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
      toast.success("Ação aprovada e executada com sucesso");
    },
    onError: (err: Error) => toast.error("Erro ao aprovar: " + err.message),
  });

  // Reject action with reason
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
      toast.success("Ação rejeitada");
      setFeedbackActionId(null);
      setFeedbackText("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Adjust action — reject + send feedback to chat for AI revision
  const adjustAction = useMutation({
    mutationFn: async ({ actionId, feedback }: { actionId: string; feedback: string }) => {
      // Reject the action
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ status: "rejected", rejection_reason: `Ajuste solicitado: ${feedback}` } as any)
        .eq("id", actionId);
      if (error) throw error;
      // TODO: inject feedback into ads chat for AI revision
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      toast.success("Feedback enviado. A IA irá revisar a proposta.");
      setFeedbackActionId(null);
      setFeedbackText("");
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
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Hourglass className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {pendingActions.length} {pendingActions.length === 1 ? "proposta aguardando" : "propostas aguardando"} sua decisão
        </span>
      </div>

      {pendingActions.map(action => {
        const Icon = ACTION_ICONS[action.action_type] || Bot;
        const data = action.action_data || {};
        const isShowingFeedback = feedbackActionId === action.id;

        return (
          <Card key={action.id} className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Icon className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {ACTION_LABELS[action.action_type] || action.action_type}
                    <Badge variant="outline" className="text-xs capitalize">{action.channel}</Badge>
                    {action.confidence && (
                      <Badge variant="secondary" className="text-xs">
                        Confiança: {action.confidence}
                      </Badge>
                    )}
                  </CardTitle>
                  {data.campaign_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Campanha: <span className="font-medium">{data.campaign_name}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Strategic reasoning */}
              {action.reasoning && (
                <div className="text-sm text-foreground/80 bg-background rounded-lg p-3 border">
                  <p className="font-medium text-xs text-muted-foreground mb-1">Justificativa estratégica:</p>
                  <p>{action.reasoning}</p>
                </div>
              )}

              {/* Expected impact */}
              {action.expected_impact && (
                <div className="text-sm text-foreground/80 bg-background rounded-lg p-3 border">
                  <p className="font-medium text-xs text-muted-foreground mb-1">Impacto esperado:</p>
                  <p>{action.expected_impact}</p>
                </div>
              )}

              {/* Copy preview if available */}
              {data.copy_text && (
                <div className="bg-background rounded-lg p-3 border">
                  <p className="font-medium text-xs text-muted-foreground mb-1">Copy do anúncio:</p>
                  <p className="text-sm whitespace-pre-wrap">{data.copy_text}</p>
                </div>
              )}

              {/* Budget info */}
              {data.daily_budget_cents && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Orçamento diário: </span>
                  <span className="font-medium">
                    {(data.daily_budget_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              )}

              {/* Feedback form */}
              {isShowingFeedback && (
                <div className="space-y-2 p-3 bg-background border rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground">O que deve ser ajustado?</p>
                  <Textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Ex: Altere o copy para focar mais em promoção..."
                    rows={3}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => adjustAction.mutate({ actionId: action.id, feedback: feedbackText })}
                      disabled={!feedbackText.trim() || adjustAction.isPending}
                    >
                      Enviar ajuste
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setFeedbackActionId(null); setFeedbackText(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                <Button
                  size="sm"
                  onClick={() => approveAction.mutate(action.id)}
                  disabled={approveAction.isPending}
                  className="gap-1.5"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFeedbackActionId(isShowingFeedback ? null : action.id)}
                  className="gap-1.5"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Ajustar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectAction.mutate({ actionId: action.id, reason: "Rejeitado pelo usuário" })}
                  disabled={rejectAction.isPending}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Rejeitar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDetailAction(action)}
                  className="gap-1 text-muted-foreground ml-auto"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Detalhes
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {new Date(action.created_at).toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        );
      })}

      <ActionDetailDialog
        action={detailAction}
        open={!!detailAction}
        onOpenChange={(open) => { if (!open) setDetailAction(null); }}
      />
    </div>
  );
}
