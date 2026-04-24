import { useState } from "react";
import {
  Lightbulb,
  Sparkles,
  Loader2,
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  MessageSquare,
  Frown,
  ShieldAlert,
  TrendingUp,
  Settings,
  Megaphone,
  ShoppingCart,
  Bot,
  Layout,
  Target,
  HeadphonesIcon,
  Clock,
  Users,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDayMonthBR, formatDayMonthYearShortBR } from "@/lib/date-format";
import {
  useBrainInsights,
  useCriticalAlerts,
  useApproveInsight,
  useRevokeInsight,
  useUpdateInsightScope,
  useResolveCriticalAlert,
  useConsolidateNow,
  type BrainInsight,
  type BrainInsightType,
  type CriticalAlert,
} from "@/hooks/useBrainInsights";

// ---------- CONFIGS ----------

const typeConfig: Record<
  BrainInsightType,
  { icon: typeof Lightbulb; label: string; color: string }
> = {
  linguagem: { icon: MessageSquare, label: "Linguagem/Gíria", color: "text-blue-500" },
  dor: { icon: Frown, label: "Dor recorrente", color: "text-orange-500" },
  objecao: { icon: ShieldAlert, label: "Objeção", color: "text-red-500" },
  motivo_nao_fechamento: { icon: X, label: "Não fechamento", color: "text-rose-500" },
  oportunidade: { icon: TrendingUp, label: "Oportunidade", color: "text-emerald-500" },
  problema_operacional: { icon: Settings, label: "Problema operacional", color: "text-amber-500" },
  tendencia: { icon: Megaphone, label: "Tendência", color: "text-violet-500" },
  sistema: { icon: Info, label: "Sistema", color: "text-muted-foreground" },
};

const agentConfig = [
  { key: "scope_vendas" as const, icon: ShoppingCart, label: "Vendas" },
  { key: "scope_auxiliar" as const, icon: Bot, label: "Auxiliar" },
  { key: "scope_landing" as const, icon: Layout, label: "Landing" },
  { key: "scope_trafego" as const, icon: Target, label: "Tráfego" },
];

// ---------- MAIN ----------

export function InsightsTab() {
  const [tab, setTab] = useState("pendentes");
  const consolidate = useConsolidateNow();

  const { data: pending = [] } = useBrainInsights("pendente");
  const { data: active = [] } = useBrainInsights("aprovado");
  const { data: alerts = [] } = useCriticalAlerts("aberto");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-5 w-5 text-primary shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">Insights da IA</h2>
            <p className="text-sm text-muted-foreground">
              Padrões aprendidos das suas conversas que alimentam o cérebro dos agentes
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => consolidate.mutate()}
          disabled={consolidate.isPending}
        >
          {consolidate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Consolidar agora
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="pendentes" className="gap-1.5">
            Pendentes
            {pending.length > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ativos" className="gap-1.5">
            Ativos
            {active.length > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                {active.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="criticos" className="gap-1.5">
            Críticos
            {alerts.length > 0 && (
              <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <PendingList />
        </TabsContent>
        <TabsContent value="ativos" className="mt-4">
          <ActiveList />
        </TabsContent>
        <TabsContent value="criticos" className="mt-4">
          <CriticalList />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <HistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- PENDING ----------

function PendingList() {
  const { data: insights = [], isLoading } = useBrainInsights("pendente");

  if (isLoading) return <Skeleton />;
  if (insights.length === 0) {
    return (
      <Empty
        icon={Lightbulb}
        title="Nenhum insight pendente"
        description="Quando a IA detectar padrões relevantes nas conversas, eles aparecerão aqui para sua aprovação."
      />
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((i) => (
        <PendingCard key={i.id} insight={i} />
      ))}
    </div>
  );
}

function PendingCard({ insight }: { insight: BrainInsight }) {
  const approve = useApproveInsight();
  const revoke = useRevokeInsight();
  const cfg = typeConfig[insight.insight_type] || typeConfig.sistema;
  const Icon = cfg.icon;

  return (
    <Card className={insight.is_urgent ? "border-orange-500/40 bg-orange-500/[0.02]" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight">
                {insight.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                {insight.is_urgent && (
                  <Badge variant="destructive" className="text-[10px] gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Urgente
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {insight.unique_customer_count} clientes • {insight.evidence_count} ocorrências
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{insight.summary}</p>

        {insight.recommendation && (
          <div className="rounded-md bg-muted/50 p-3 text-xs">
            <span className="font-medium text-foreground">Recomendação: </span>
            <span className="text-muted-foreground">{insight.recommendation}</span>
          </div>
        )}

        {insight.variations.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className="h-3 w-3" />
              Ver {insight.variations.length} exemplos reais
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {insight.variations.slice(0, 8).map((v, idx) => (
                <div key={idx} className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
                  "{v}"
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-[10px] text-muted-foreground">
            {insight.period_start && insight.period_end
              ? `${formatDayMonthBR(insight.period_start)} — ${formatDayMonthYearShortBR(insight.period_end)}`
              : formatDayMonthYearShortBR(insight.created_at)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => revoke.mutate({ insightId: insight.id, reason: "Descartado na revisão" })}
              disabled={revoke.isPending || approve.isPending}
            >
              <X className="h-3 w-3 mr-1" />
              Descartar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => approve.mutate(insight.id)}
              disabled={approve.isPending || revoke.isPending}
            >
              <Check className="h-3 w-3 mr-1" />
              Aprovar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- ACTIVE ----------

function ActiveList() {
  const { data: insights = [], isLoading } = useBrainInsights("aprovado");

  if (isLoading) return <Skeleton />;
  if (insights.length === 0) {
    return (
      <Empty
        icon={Check}
        title="Nenhum insight ativo"
        description="Aprove insights pendentes para alimentar o cérebro dos seus agentes."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Insights ativos são camada complementar — nunca sobrepõem o contexto da conversa atual,
          o produto discutido ou as regras estruturais do catálogo.
        </span>
      </div>
      {insights.map((i) => (
        <ActiveCard key={i.id} insight={i} />
      ))}
    </div>
  );
}

function ActiveCard({ insight }: { insight: BrainInsight }) {
  const updateScope = useUpdateInsightScope();
  const revoke = useRevokeInsight();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const cfg = typeConfig[insight.insight_type] || typeConfig.sistema;
  const Icon = cfg.icon;

  const handleToggle = (key: typeof agentConfig[number]["key"], value: boolean) => {
    updateScope.mutate({ insightId: insight.id, scopes: { [key]: value } });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight">
                {insight.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                <Badge variant="secondary" className="text-[10px] gap-0.5">
                  <Check className="h-2.5 w-2.5" />
                  Ativo
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{insight.summary}</p>

        {/* Toggles por agente */}
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2">
            <HeadphonesIcon className="h-3.5 w-3.5" />
            Aplicar em quais agentes?
          </div>
          <div className="grid grid-cols-2 gap-2">
            {agentConfig.map((a) => {
              const AIcon = a.icon;
              const checked = insight[a.key];
              return (
                <label
                  key={a.key}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs">
                    <AIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {a.label}
                  </span>
                  <Switch
                    checked={checked}
                    onCheckedChange={(v) => handleToggle(a.key, v)}
                    disabled={updateScope.isPending}
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Aprovado em {insight.approved_at ? formatDayMonthYearShortBR(insight.approved_at) : "-"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={() => setRevokeOpen(true)}
          >
            Revogar
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar este insight?</AlertDialogTitle>
            <AlertDialogDescription>
              Os agentes deixarão de considerar esse padrão imediatamente. Você ainda poderá vê-lo no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                revoke.mutate({ insightId: insight.id, reason: "Revogado pelo usuário" });
                setRevokeOpen(false);
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------- CRITICAL ----------

function CriticalList() {
  const { data: alerts = [], isLoading } = useCriticalAlerts("aberto");

  if (isLoading) return <Skeleton />;
  if (alerts.length === 0) {
    return (
      <Empty
        icon={ShieldAlert}
        title="Nenhum alerta crítico aberto"
        description="Problemas operacionais imediatos (checkout quebrado, site fora do ar, erros de pagamento) aparecerão aqui em tempo real."
      />
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <CriticalCard key={a.id} alert={a} />
      ))}
    </div>
  );
}

function CriticalCard({ alert }: { alert: CriticalAlert }) {
  const resolve = useResolveCriticalAlert();

  return (
    <Card className="border-destructive/40 bg-destructive/[0.03]">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-tight">
                {alert.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant="destructive" className="text-[10px]">{alert.category}</Badge>
                {alert.occurrences_2h > 1 && (
                  <Badge variant="outline" className="text-[10px]">
                    {alert.occurrences_2h}× nas últimas 2h
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {formatDayMonthYearShortBR(alert.detected_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {alert.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{alert.description}</p>
        )}
        {alert.trigger_text && (
          <div className="rounded-md bg-muted/50 p-2 text-xs italic text-muted-foreground border-l-2 border-destructive">
            "{alert.trigger_text}"
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => resolve.mutate({ alertId: alert.id, ignore: true })}
            disabled={resolve.isPending}
          >
            Ignorar
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => resolve.mutate({ alertId: alert.id })}
            disabled={resolve.isPending}
          >
            <Check className="h-3 w-3 mr-1" />
            Resolver
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- HISTORY ----------

function HistoryList() {
  const { data: revoked = [], isLoading: l1 } = useBrainInsights("revogado");
  const { data: expired = [], isLoading: l2 } = useBrainInsights("expirado");

  if (l1 || l2) return <Skeleton />;

  const all = [...revoked, ...expired].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  if (all.length === 0) {
    return (
      <Empty
        icon={Clock}
        title="Histórico vazio"
        description="Insights revogados ou expirados aparecerão aqui para referência."
      />
    );
  }

  return (
    <div className="space-y-2">
      {all.map((i) => {
        const cfg = typeConfig[i.insight_type] || typeConfig.sistema;
        const Icon = cfg.icon;
        return (
          <Card key={i.id} className="opacity-70">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{i.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{i.summary}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {i.status === "revogado" ? "Revogado" : "Expirado"}
                      </Badge>
                      {i.revoke_reason && (
                        <span className="text-[10px] text-muted-foreground italic">
                          {i.revoke_reason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDayMonthYearShortBR(i.updated_at)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- SHARED ----------

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse bg-muted rounded-lg" />
      ))}
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Lightbulb;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="text-sm mt-1 max-w-md mx-auto">{description}</p>
    </div>
  );
}
