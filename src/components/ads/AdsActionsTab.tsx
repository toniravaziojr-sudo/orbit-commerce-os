import { Clock, CheckCircle2, XCircle, AlertTriangle, Bot, Pause, DollarSign, TrendingUp, Image, Hourglass, Undo2, Eye } from "lucide-react";
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
import { ActionDetailDialog } from "./ActionDetailDialog";
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
  strategic_plan: Bot,
};

const ACTION_LABELS: Record<string, string> = {
  pause_campaign: "Pausou Campanha",
  adjust_budget: "Ajustou Orçamento",
  create_campaign: "Criar Campanha",
  create_adset: "Criar Conjunto",
  generate_creative: "Gerou Criativo",
  allocate_budget: "Alocou Orçamento",
  report_insight: "Insight",
  strategic_plan: "Plano Estratégico",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  executed: { label: "Executada", variant: "default", icon: CheckCircle2 },
  validated: { label: "Validada", variant: "secondary", icon: Clock },
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  pending_approval: { label: "Aguardando Aprovação", variant: "secondary", icon: Hourglass },
  approved: { label: "Aprovada", variant: "default", icon: CheckCircle2 },
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
  const [detailAction, setDetailAction] = useState<AutopilotAction | null>(null);

  // No approve/reject here — approval happens in "Aguardando Ação" tab

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
      const edgeFn = channel === "meta" ? "meta-ads-campaigns" : channel === "google" ? "google-ads-campaigns" : "tiktok-ads-campaigns";
      const idField = channel === "meta" ? "meta_campaign_id" : channel === "google" ? "google_campaign_id" : "tiktok_campaign_id";

      if (action.action_type === "pause_campaign" || action.action_type === "activate_campaign") {
        const { error } = await supabase.functions.invoke(edgeFn, {
          body: { tenant_id: tenantId, action: "update", [idField]: data.campaign_id, status: rollback.previous_status || "ACTIVE" },
        });
        if (error) throw error;
      } else if (action.action_type === "adjust_budget" || action.action_type === "allocate_budget") {
        const entityId = data.campaign_id || data.adset_id;
        const entityField = data.campaign_id ? idField : channel === "meta" ? "meta_adset_id" : "adset_id";
        const { error } = await supabase.functions.invoke(edgeFn, {
          body: { tenant_id: tenantId, action: "update", [entityField]: entityId, daily_budget: rollback.previous_budget_cents },
        });
        if (error) throw error;
      } else {
        // For other action types, just mark as rolled back without API call
        console.warn("Rollback sem chamada API para:", action.action_type);
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

  // Filter out internal/system actions not relevant to users
  const HIDDEN_ACTION_TYPES = ["activate_campaign"];
  const HIDDEN_STATUSES = ["scheduled"];
  const filtered = (channelFilter ? actions.filter(a => a.channel === channelFilter) : actions)
    .filter(a => !HIDDEN_ACTION_TYPES.includes(a.action_type) && !HIDDEN_STATUSES.includes(a.status));

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
        title="Nenhuma ação registrada"
        description="Quando a IA executar o plano estratégico, as ações aparecerão aqui"
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
        const canRollback = action.status === "executed" && action.rollback_data;

        return (
          <Card key={action.id} className={`transition-colors cursor-pointer hover:bg-accent/50 ${isPending ? "border-amber-500/30 bg-amber-500/5" : ""}`}>
            <CardContent className="py-4" onClick={() => setDetailAction(action)}>
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${isPending ? "bg-amber-500/10" : "bg-muted"}`}>
                  <Icon className={`h-4 w-4 ${isPending ? "text-amber-600" : ""}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {ACTION_LABELS[action.action_type] || action.action_type}
                    </span>
                    {entityName && !entityName.startsWith("ID:") && (
                      <span className="text-xs text-muted-foreground truncate max-w-[300px]" title={entityName}>
                        {entityName}
                      </span>
                    )}
                    <Badge variant={statusConfig.variant} className="text-xs gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                    {budgetImpact && (
                      <Badge variant="outline" className="text-xs gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600">
                        <DollarSign className="h-3 w-3" />
                        {budgetImpact}
                      </Badge>
                    )}
                  </div>
                  {action.reasoning && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{action.reasoning}</p>
                  )}
                  {action.action_type === "strategic_plan" && action.action_data?.diagnosis && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {action.action_data.diagnosis.length > 150 
                        ? action.action_data.diagnosis.slice(0, 150).trimEnd() + "…" 
                        : action.action_data.diagnosis}
                    </p>
                  )}
                  {action.rejection_reason && (
                    <p className="text-sm text-destructive mt-1">Motivo: {action.rejection_reason}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {isPending && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 bg-amber-500/5">
                        <Hourglass className="h-3 w-3 mr-1" />
                        Veja na aba "Aguardando Ação"
                      </Badge>
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
                               Isso irá reverter a ação executada pela IA para o estado anterior. 
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
                    {/* View details button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDetailAction(action)}
                      className="gap-1 text-muted-foreground"
                    >
                      <Eye className="h-3 w-3" />
                      Detalhes
                    </Button>
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

      <ActionDetailDialog
        action={detailAction}
        open={!!detailAction}
        onOpenChange={(open) => { if (!open) setDetailAction(null); }}
      />
    </div>
  );
}
