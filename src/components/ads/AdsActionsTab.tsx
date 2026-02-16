import { Clock, CheckCircle2, XCircle, AlertTriangle, Bot, Pause, DollarSign, TrendingUp, Image, ThumbsUp, ThumbsDown, Hourglass, Undo2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { AutopilotAction } from "@/hooks/useAdsAutopilot";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdsActionsTabProps {
  actions: AutopilotAction[];
  isLoading: boolean;
  channelFilter?: string;
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
  pause_campaign: "Pausou Campanha",
  adjust_budget: "Ajustou Orçamento",
  create_campaign: "Criar Campanha",
  create_adset: "Criar Conjunto",
  generate_creative: "Gerou Criativo",
  allocate_budget: "Alocou Orçamento",
  report_insight: "Insight",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  executed: { label: "Executada", variant: "default", icon: CheckCircle2 },
  validated: { label: "Validada", variant: "secondary", icon: Clock },
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  pending_approval: { label: "Aguardando Aprovação", variant: "secondary", icon: Hourglass },
  approved: { label: "Aprovada", variant: "default", icon: ThumbsUp },
  failed: { label: "Falha", variant: "destructive", icon: XCircle },
  rejected: { label: "Rejeitada", variant: "destructive", icon: AlertTriangle },
  expired: { label: "Expirada", variant: "outline", icon: Clock },
  rolled_back: { label: "Revertida", variant: "outline", icon: Undo2 },
};

/** Get a readable entity name from action data */
function getEntityName(action: AutopilotAction): string | null {
  const data = action.action_data;
  if (!data) return null;
  
  if (data.campaign_name) return data.campaign_name;
  if (data.adset_name) return data.adset_name;
  
  const id = data.campaign_id || data.adset_id;
  if (id) return `ID: ${id}`;
  return null;
}

/** Get budget impact display from action data */
function getBudgetImpact(action: AutopilotAction): string | null {
  const data = action.action_data;
  if (!data) return null;

  // For pause actions, show spend reduction
  const impact = data.expected_impact;
  if (impact?.spend_reduction_cents_day) {
    const value = (impact.spend_reduction_cents_day / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return `${value}/dia economizado`;
  }

  // For budget adjustments
  if (data.new_budget_cents) {
    const value = (data.new_budget_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return `Novo: ${value}/dia`;
  }

  return null;
}

export function AdsActionsTab({ actions, isLoading, channelFilter }: AdsActionsTabProps) {
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const approveAction = useMutation({
    mutationFn: async (actionId: string) => {
      setProcessingId(actionId);
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ status: "executed", executed_at: new Date().toISOString() } as any)
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      toast.success("Ação aprovada e executada");
      setProcessingId(null);
    },
    onError: (err: Error) => { toast.error(err.message); setProcessingId(null); },
  });

  const rejectAction = useMutation({
    mutationFn: async ({ actionId, reason }: { actionId: string; reason: string }) => {
      setProcessingId(actionId);
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ status: "rejected", rejection_reason: reason } as any)
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      toast.success("Ação rejeitada");
      setProcessingId(null);
    },
    onError: (err: Error) => { toast.error(err.message); setProcessingId(null); },
  });

  const rollbackAction = useMutation({
    mutationFn: async (action: AutopilotAction) => {
      setProcessingId(action.id);
      const data = action.action_data;
      const rollback = action.rollback_data;
      
      if (!data || !rollback) throw new Error("Dados de reversão não disponíveis");
      
      const channel = action.channel;
      const tenantId = currentTenant?.id;
      if (!tenantId) throw new Error("Tenant não encontrado");

      // Execute rollback based on action type
      if (action.action_type === "pause_campaign") {
        const edgeFn = channel === "meta" ? "meta-ads-campaigns" : channel === "google" ? "google-ads-campaigns" : "tiktok-ads-campaigns";
        const idField = channel === "meta" ? "meta_campaign_id" : channel === "google" ? "google_campaign_id" : "tiktok_campaign_id";
        
        const { error } = await supabase.functions.invoke(edgeFn, {
          body: { tenant_id: tenantId, action: "update", [idField]: data.campaign_id, status: rollback.previous_status || "ACTIVE" },
        });
        if (error) throw error;
      } else {
        throw new Error("Reversão não suportada para este tipo de ação");
      }

      // Mark as rolled back
      const { error: updateError } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ status: "rolled_back" } as any)
        .eq("id", action.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      toast.success("Ação revertida com sucesso! A campanha foi reativada.");
      setProcessingId(null);
    },
    onError: (err: Error) => { toast.error("Erro ao reverter: " + err.message); setProcessingId(null); },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const filtered = channelFilter ? actions.filter(a => a.channel === channelFilter) : actions;

  // Sort: pending_approval first, then by date
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "pending_approval" && b.status !== "pending_approval") return -1;
    if (b.status === "pending_approval" && a.status !== "pending_approval") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount = sorted.filter(a => a.status === "pending_approval").length;

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="Nenhuma ação da IA"
        description="Execute uma análise para a IA começar a tomar decisões"
      />
    );
  }

  return (
    <div className="space-y-3">
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Hourglass className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
            {pendingCount} {pendingCount === 1 ? "ação aguardando" : "ações aguardando"} sua aprovação
          </span>
        </div>
      )}
      {sorted.map(action => {
        const Icon = ACTION_ICONS[action.action_type] || Bot;
        const statusConfig = STATUS_CONFIG[action.status] || STATUS_CONFIG.pending;
        const StatusIcon = statusConfig.icon;
        const isPending = action.status === "pending_approval";
        const isProcessing = processingId === action.id;
        const entityName = getEntityName(action);
        const budgetImpact = getBudgetImpact(action);
        const canRollback = action.status === "executed" && action.rollback_data && action.action_type === "pause_campaign";

        return (
          <Card key={action.id} className={`transition-colors ${isPending ? "border-amber-500/30 bg-amber-500/5" : ""}`}>
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${isPending ? "bg-amber-500/10" : "bg-muted"}`}>
                  <Icon className={`h-4 w-4 ${isPending ? "text-amber-600" : ""}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {ACTION_LABELS[action.action_type] || action.action_type}
                    </span>
                    {entityName && (
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]" title={entityName}>
                        {entityName}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">{action.channel}</Badge>
                    <Badge variant={statusConfig.variant} className="text-xs gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                    {action.confidence && (
                      <Badge variant="outline" className="text-xs">
                        Confiança: {action.confidence}
                      </Badge>
                    )}
                    {budgetImpact && (
                      <Badge variant="outline" className="text-xs gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600">
                        <DollarSign className="h-3 w-3" />
                        {budgetImpact}
                      </Badge>
                    )}
                  </div>
                  {action.reasoning && (
                    <p className="text-sm text-muted-foreground mt-1">{action.reasoning}</p>
                  )}
                  {action.expected_impact && isPending && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>Impacto esperado:</strong> {action.expected_impact}
                    </p>
                  )}
                  {action.rejection_reason && (
                    <p className="text-sm text-destructive mt-1">Motivo: {action.rejection_reason}</p>
                  )}
                  {action.metric_trigger && (
                    <p className="text-xs text-muted-foreground mt-1">Métrica: {action.metric_trigger}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => approveAction.mutate(action.id)}
                          disabled={isProcessing}
                          className="gap-1"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectAction.mutate({ actionId: action.id, reason: "Rejeitado manualmente pelo usuário" })}
                          disabled={isProcessing}
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          <ThumbsDown className="h-3 w-3" />
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {canRollback && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isProcessing}
                            className="gap-1 text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400"
                          >
                            <Undo2 className="h-3 w-3" />
                            Desfazer
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reverter ação da IA?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso irá reativar a campanha que foi pausada pela IA. 
                              {action.rollback_data?.rollback_plan && (
                                <span className="block mt-2 text-sm">
                                  <strong>Plano original:</strong> {action.rollback_data.rollback_plan}
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => rollbackAction.mutate(action)}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              Sim, reverter
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(action.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
