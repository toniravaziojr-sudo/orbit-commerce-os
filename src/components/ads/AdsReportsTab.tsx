import { useMemo } from "react";
import { DollarSign, Eye, MousePointer, TrendingUp, Bot, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

interface AdsReportsTabProps {
  insights: any[];
  actions: any[];
  channel: string;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function AdsReportsTab({ insights, actions, channel }: AdsReportsTabProps) {
  const summary = useMemo(() => {
    return insights.reduce(
      (acc, row) => ({
        impressions: acc.impressions + (row.impressions || 0),
        clicks: acc.clicks + (row.clicks || 0),
        spend_cents: acc.spend_cents + (row.spend_cents || row.cost_micros ? Math.round((row.cost_micros || 0) / 10000) : 0),
        conversions: acc.conversions + (row.conversions || 0),
        reach: acc.reach + (row.reach || 0),
      }),
      { impressions: 0, clicks: 0, spend_cents: 0, conversions: 0, reach: 0 }
    );
  }, [insights]);

  const ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
  const cpa = summary.conversions > 0 ? summary.spend_cents / summary.conversions : 0;
  const roas = summary.spend_cents > 0 ? (summary.conversions * 5000) / summary.spend_cents : 0; // Estimate

  const channelActions = actions.filter(a => a.channel === channel || a.channel === "global");
  const executedActions = channelActions.filter(a => a.status === "executed").length;

  if (insights.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados de relatório"
        description="Sincronize os dados das campanhas para ver relatórios"
      />
    );
  }

  const cards = [
    { title: "Investimento", value: formatCurrency(summary.spend_cents), icon: DollarSign, desc: "Últimos 7 dias" },
    { title: "Impressões", value: formatNumber(summary.impressions), icon: Eye, desc: `Alcance: ${formatNumber(summary.reach)}` },
    { title: "Cliques", value: formatNumber(summary.clicks), icon: MousePointer, desc: `CTR: ${ctr.toFixed(2)}%` },
    { title: "Conversões", value: formatNumber(summary.conversions), icon: TrendingUp, desc: `CPA: ${formatCurrency(cpa)}` },
    { title: "Ações da IA", value: String(executedActions), icon: Bot, desc: `${channelActions.length} total` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(card => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
