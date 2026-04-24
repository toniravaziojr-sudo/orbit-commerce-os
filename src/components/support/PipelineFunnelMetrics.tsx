import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Search,
  Sparkles,
  Eye,
  Target,
  CreditCard,
  ShieldAlert,
  Wrench,
  Activity,
  Timer,
} from "lucide-react";

// View: sales_pipeline_funnel_metrics (criada na sub-fase 1.5)
// Agrupa por dia/tenant os turnos do ai_support_turn_log com:
// - contagens por estado
// - taxas de conversão entre estados
// - latência média (ms) por estado
// - estatísticas do variant_gate
interface PipelineMetricsRow {
  day: string | null;
  tenant_id: string | null;
  total_turns: number | null;
  turns_with_tool_calls: number | null;
  turns_with_blocked_tools: number | null;
  conv_greeting: number | null;
  conv_discovery: number | null;
  conv_proposal: number | null;
  conv_cart: number | null;
  conv_checkout: number | null;
  conv_closed: number | null;
  conv_handoff: number | null;
  conv_rate_discovery_to_cart_pct: number | null;
  conv_rate_cart_to_checkout_pct: number | null;
  conv_rate_checkout_to_closed_pct: number | null;
  avg_ms_greeting: number | null;
  avg_ms_discovery: number | null;
  avg_ms_proposal: number | null;
  avg_ms_cart: number | null;
  avg_ms_checkout: number | null;
  variant_gate_asked: number | null;
  variant_gate_resolved: number | null;
  variant_gate_single: number | null;
  variant_gate_not_needed: number | null;
}

const num = (n: number | null | undefined) => Number(n ?? 0);
const fmtMs = (n: number | null | undefined) => {
  const v = num(n);
  if (!v) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
};
const fmtPct = (n: number | null | undefined) => {
  const v = num(n);
  return `${v.toFixed(1)}%`;
};

export function PipelineFunnelMetrics() {
  const { currentTenant } = useAuth();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["sales-pipeline-funnel", currentTenant?.id],
    enabled: !!currentTenant?.id,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("sales_pipeline_funnel_metrics")
        .select("*")
        .eq("tenant_id", currentTenant!.id)
        .gte("day", since.toISOString().slice(0, 10))
        .order("day", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PipelineMetricsRow[];
    },
  });

  // Totais agregados (30 dias)
  const totals = (rows ?? []).reduce(
    (acc, r) => {
      acc.total_turns += num(r.total_turns);
      acc.turns_with_tool_calls += num(r.turns_with_tool_calls);
      acc.turns_with_blocked_tools += num(r.turns_with_blocked_tools);
      acc.greeting += num(r.conv_greeting);
      acc.discovery += num(r.conv_discovery);
      acc.proposal += num(r.conv_proposal);
      acc.cart += num(r.conv_cart);
      acc.checkout += num(r.conv_checkout);
      acc.closed += num(r.conv_closed);
      acc.handoff += num(r.conv_handoff);
      acc.gate_asked += num(r.variant_gate_asked);
      acc.gate_resolved += num(r.variant_gate_resolved);
      acc.gate_single += num(r.variant_gate_single);
      acc.gate_not_needed += num(r.variant_gate_not_needed);
      return acc;
    },
    {
      total_turns: 0,
      turns_with_tool_calls: 0,
      turns_with_blocked_tools: 0,
      greeting: 0,
      discovery: 0,
      proposal: 0,
      cart: 0,
      checkout: 0,
      closed: 0,
      handoff: 0,
      gate_asked: 0,
      gate_resolved: 0,
      gate_single: 0,
      gate_not_needed: 0,
    }
  );

  // Latências médias ponderadas pelo total_turns
  const weightedAvg = (key: keyof PipelineMetricsRow) => {
    let sum = 0;
    let weight = 0;
    (rows ?? []).forEach((r) => {
      const v = num(r[key] as number | null);
      const w = num(r.total_turns);
      if (v && w) {
        sum += v * w;
        weight += w;
      }
    });
    return weight > 0 ? sum / weight : 0;
  };

  const avgMs = {
    greeting: weightedAvg("avg_ms_greeting"),
    discovery: weightedAvg("avg_ms_discovery"),
    proposal: weightedAvg("avg_ms_proposal"),
    cart: weightedAvg("avg_ms_cart"),
    checkout: weightedAvg("avg_ms_checkout"),
  };

  // Taxas globais (recalculadas dos totais para evitar média de %)
  const rateDiscoveryToCart = totals.discovery > 0 ? (totals.cart / totals.discovery) * 100 : 0;
  const rateCartToCheckout = totals.cart > 0 ? (totals.checkout / totals.cart) * 100 : 0;
  const rateCheckoutToClosed = totals.checkout > 0 ? (totals.closed / totals.checkout) * 100 : 0;

  const stages = [
    { key: "greeting", label: "Saudação", icon: MessageCircle, value: totals.greeting, ms: avgMs.greeting },
    { key: "discovery", label: "Descoberta", icon: Search, value: totals.discovery, ms: avgMs.discovery },
    { key: "proposal", label: "Recomendação", icon: Sparkles, value: totals.proposal, ms: avgMs.proposal },
    { key: "detail", label: "Detalhe / Decisão", icon: Eye, value: 0, ms: 0, skip: true },
    { key: "cart", label: "Carrinho", icon: Target, value: totals.cart, ms: avgMs.cart },
    { key: "checkout", label: "Checkout", icon: CreditCard, value: totals.checkout, ms: avgMs.checkout },
    { key: "handoff", label: "Handoff humano", icon: ShieldAlert, value: totals.handoff, ms: 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Pipeline IA — Funil & Saúde</h2>
        <p className="text-sm text-muted-foreground">
          Últimos 30 dias — turnos por estado, conversão entre etapas, latência por estado e variant gate.
        </p>
      </div>

      {/* KPIs gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Turnos analisados</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{totals.total_turns.toLocaleString("pt-BR")}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Turnos com tools</CardTitle>
            <Wrench className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{totals.turns_with_tool_calls.toLocaleString("pt-BR")}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tools bloqueadas (filtro)</CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{totals.turns_with_blocked_tools.toLocaleString("pt-BR")}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversão Carrinho→Fechado</CardTitle>
            <Target className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{fmtPct(rateCheckoutToClosed)}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Funil por estado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil por estado da pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-3">
              {stages.filter((s) => !s.skip).map((s) => {
                const max = Math.max(...stages.filter((x) => !x.skip).map((x) => x.value), 1);
                const widthPct = (s.value / max) * 100;
                return (
                  <div key={s.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <s.icon className="h-4 w-4 text-primary" />
                        <span className="font-medium">{s.label}</span>
                      </span>
                      <span className="flex items-center gap-3 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" /> {fmtMs(s.ms)}
                        </span>
                        <Badge variant="secondary">{s.value.toLocaleString("pt-BR")}</Badge>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversões por etapa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Descoberta → Carrinho</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{fmtPct(rateDiscoveryToCart)}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Carrinho → Checkout</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{fmtPct(rateCartToCheckout)}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Checkout → Fechado</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{fmtPct(rateCheckoutToClosed)}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Variant gate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variant gate (perguntar ou não a variante)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Perguntou</div>
              <div className="text-xl font-semibold">{totals.gate_asked.toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Resolveu (foco)</div>
              <div className="text-xl font-semibold">{totals.gate_resolved.toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Variante única (auto)</div>
              <div className="text-xl font-semibold">{totals.gate_single.toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Não precisava</div>
              <div className="text-xl font-semibold">{totals.gate_not_needed.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela diária */}
      <Card>
        <CardHeader><CardTitle className="text-base">Por dia (últimos 30)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !rows?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de pipeline no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4">Dia</th>
                    <th className="py-2 pr-4">Turnos</th>
                    <th className="py-2 pr-4">Saud.</th>
                    <th className="py-2 pr-4">Desc.</th>
                    <th className="py-2 pr-4">Reco.</th>
                    <th className="py-2 pr-4">Carr.</th>
                    <th className="py-2 pr-4">Checkout</th>
                    <th className="py-2 pr-4">Handoff</th>
                    <th className="py-2 pr-4">Latência média</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 pr-4">{r.day ? new Date(r.day).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="py-2 pr-4">{num(r.total_turns).toLocaleString("pt-BR")}</td>
                      <td className="py-2 pr-4">{num(r.conv_greeting)}</td>
                      <td className="py-2 pr-4">{num(r.conv_discovery)}</td>
                      <td className="py-2 pr-4">{num(r.conv_proposal)}</td>
                      <td className="py-2 pr-4">{num(r.conv_cart)}</td>
                      <td className="py-2 pr-4">{num(r.conv_checkout)}</td>
                      <td className="py-2 pr-4">{num(r.conv_handoff)}</td>
                      <td className="py-2 pr-4">{fmtMs(r.avg_ms_discovery)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
