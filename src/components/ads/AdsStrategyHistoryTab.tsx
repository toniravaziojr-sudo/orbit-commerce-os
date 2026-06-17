// =============================================================================
// AdsStrategyHistoryTab — Histórico de Estratégias do Gestor de Tráfego IA
// Lista os planos estratégicos gerados pela IA para um canal específico,
// destacando o plano aprovado como "Ativa".
// =============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, History, ChevronRight, Calendar, Target, DollarSign } from "lucide-react";
import { formatDayMonthTimeBR } from "@/lib/date-timezone";
import { cn } from "@/lib/utils";

interface StrategicPlanRow {
  id: string;
  channel: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  reasoning: string | null;
  action_data: any;
}

interface Props {
  channel: string;
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  approved: { label: "Aprovada", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  pending_approval: { label: "Aguardando aprovação", tone: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  superseded: { label: "Substituída", tone: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
  rejected: { label: "Recusada", tone: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
  plan_approved: { label: "Aprovada", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
};

function statusBadge(status: string) {
  const conf = STATUS_LABELS[status] || { label: status, tone: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", conf.tone)}>
      {conf.label}
    </Badge>
  );
}

function plannedActionsSummary(actions: any[]): { name: string; product?: string; budget?: string; audience?: string }[] {
  if (!Array.isArray(actions)) return [];
  return actions.map((a) => {
    const adsets = Array.isArray(a?.adsets) ? a.adsets : [];
    const totalBudget = adsets.reduce((acc: number, ad: any) => acc + (Number(ad?.budget_brl) || 0), 0);
    const audience = adsets[0]?.audience_description || adsets[0]?.audience_type || null;
    return {
      name: a?.campaign_name || a?.name || "Campanha",
      product: a?.product_name || a?.product || undefined,
      budget: totalBudget > 0 ? `R$ ${totalBudget.toFixed(2)}/dia` : undefined,
      audience: audience || undefined,
    };
  });
}

export function AdsStrategyHistoryTab({ channel }: Props) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const [openPlan, setOpenPlan] = useState<StrategicPlanRow | null>(null);

  const plansQuery = useQuery({
    queryKey: ["ads-strategy-history", tenantId, channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads_autopilot_actions")
        .select("id, channel, status, created_at, approved_at, reasoning, action_data")
        .eq("tenant_id", tenantId!)
        .eq("action_type", "strategic_plan")
        .eq("channel", channel)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as unknown as StrategicPlanRow[];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  if (plansQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const plans = plansQuery.data || [];
  const active = plans.find((p) => p.status === "approved");
  const history = plans.filter((p) => p.id !== active?.id);

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Ainda não há estratégias geradas pela IA neste canal.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Toda vez que a IA propuser um plano, ele aparece aqui — ativos e históricos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Estratégia Ativa */}
        {active && (
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Estratégia Ativa
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                    Ativa
                  </Badge>
                </CardTitle>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Aprovada em {active.approved_at ? formatDayMonthTimeBR(active.approved_at) : "—"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <PlanDetails plan={active} />
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setOpenPlan(active)} className="gap-1">
                  Ver detalhes completos <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Histórico de Estratégias
              <Badge variant="secondary" className="text-[10px]">{history.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Planos anteriores que foram substituídos, recusados ou ainda estão aguardando decisão.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sem estratégias anteriores neste canal.
              </p>
            ) : (
              history.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setOpenPlan(p)}
                  className="w-full text-left border border-border/60 hover:border-primary/40 hover:bg-muted/30 rounded-md p-3 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {statusBadge(p.status)}
                      <span className="text-xs text-muted-foreground">
                        {formatDayMonthTimeBR(p.created_at)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {(Array.isArray(p.action_data?.planned_actions) ? p.action_data.planned_actions.length : 0)} campanhas
                      </Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">
                    {p.action_data?.diagnosis || p.reasoning || "Sem diagnóstico registrado."}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de detalhes */}
      <Dialog open={!!openPlan} onOpenChange={(o) => !o && setOpenPlan(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Estratégia da IA
              {openPlan && statusBadge(openPlan.status)}
            </DialogTitle>
          </DialogHeader>
          {openPlan && (
            <ScrollArea className="max-h-[70vh] pr-3">
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Gerada em {formatDayMonthTimeBR(openPlan.created_at)}
                  </span>
                  {openPlan.approved_at && (
                    <span className="flex items-center gap-1 text-emerald-700">
                      Aprovada em {formatDayMonthTimeBR(openPlan.approved_at)}
                    </span>
                  )}
                </div>

                {openPlan.action_data?.diagnosis && (
                  <section>
                    <h4 className="text-sm font-semibold mb-1">Diagnóstico</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {openPlan.action_data.diagnosis}
                    </p>
                  </section>
                )}

                <section>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" /> Campanhas planejadas
                  </h4>
                  <PlanDetails plan={openPlan} expanded />
                </section>

                {openPlan.action_data?.budget_summary && (
                  <section>
                    <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" /> Orçamento total
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {typeof openPlan.action_data.budget_summary === "string"
                        ? openPlan.action_data.budget_summary
                        : JSON.stringify(openPlan.action_data.budget_summary)}
                    </p>
                  </section>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlanDetails({ plan, expanded = false }: { plan: StrategicPlanRow; expanded?: boolean }) {
  const summary = plannedActionsSummary(plan.action_data?.planned_actions || []);
  if (summary.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem campanhas registradas neste plano.</p>;
  }
  return (
    <div className="space-y-2">
      {summary.map((c, i) => (
        <div key={i} className="border border-border/50 rounded-md p-2.5 bg-background/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">{c.name}</p>
            {c.budget && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <DollarSign className="h-2.5 w-2.5" /> {c.budget}
              </Badge>
            )}
          </div>
          {expanded && (
            <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
              {c.product && <p>Produto: <span className="text-foreground">{c.product}</span></p>}
              {c.audience && <p>Público: <span className="text-foreground">{c.audience}</span></p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
