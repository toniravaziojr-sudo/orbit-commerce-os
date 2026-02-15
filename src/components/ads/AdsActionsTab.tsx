import { Clock, CheckCircle2, XCircle, AlertTriangle, Bot, Pause, DollarSign, TrendingUp, Image } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { AutopilotAction } from "@/hooks/useAdsAutopilot";

interface AdsActionsTabProps {
  actions: AutopilotAction[];
  isLoading: boolean;
  channelFilter?: string;
}

const ACTION_ICONS: Record<string, any> = {
  pause_campaign: Pause,
  adjust_budget: DollarSign,
  create_campaign: TrendingUp,
  generate_creative: Image,
  allocate_budget: TrendingUp,
  report_insight: Bot,
};

const ACTION_LABELS: Record<string, string> = {
  pause_campaign: "Pausou Campanha",
  adjust_budget: "Ajustou Orçamento",
  create_campaign: "Criou Campanha",
  generate_creative: "Gerou Criativo",
  allocate_budget: "Alocou Orçamento",
  report_insight: "Insight",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  executed: { label: "Executada", variant: "default", icon: CheckCircle2 },
  validated: { label: "Validada", variant: "secondary", icon: Clock },
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  failed: { label: "Falha", variant: "destructive", icon: XCircle },
  rejected: { label: "Rejeitada", variant: "destructive", icon: AlertTriangle },
};

export function AdsActionsTab({ actions, isLoading, channelFilter }: AdsActionsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const filtered = channelFilter ? actions.filter(a => a.channel === channelFilter) : actions;

  if (filtered.length === 0) {
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
      {filtered.map(action => {
        const Icon = ACTION_ICONS[action.action_type] || Bot;
        const statusConfig = STATUS_CONFIG[action.status] || STATUS_CONFIG.pending;
        const StatusIcon = statusConfig.icon;

        return (
          <Card key={action.id} className="hover:bg-muted/30 transition-colors">
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {ACTION_LABELS[action.action_type] || action.action_type}
                    </span>
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
                  </div>
                  {action.reasoning && (
                    <p className="text-sm text-muted-foreground mt-1">{action.reasoning}</p>
                  )}
                  {action.rejection_reason && (
                    <p className="text-sm text-destructive mt-1">Motivo: {action.rejection_reason}</p>
                  )}
                  {action.metric_trigger && (
                    <p className="text-xs text-muted-foreground mt-1">Métrica: {action.metric_trigger}</p>
                  )}
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
