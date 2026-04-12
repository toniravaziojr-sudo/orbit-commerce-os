import { formatDayMonthBR, formatDayMonthYearShortBR } from "@/lib/date-format";
import { useState } from "react";
import { formatDayMonthBR, formatDayMonthYearShortBR } from "@/lib/date-format";
import {
  Lightbulb,
  TrendingUp,
  Package,
  Megaphone,
  Settings,
  DollarSign,
  Sparkles,
  Loader2,
  Eye,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCommandInsights, useMarkInsightRead, useGenerateInsights, type CommandInsight } from "@/hooks/useCommandInsights";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const categoryConfig: Record<string, { icon: typeof TrendingUp; label: string }> = {
  vendas: { icon: TrendingUp, label: "Vendas" },
  estoque: { icon: Package, label: "Estoque" },
  marketing: { icon: Megaphone, label: "Marketing" },
  operacoes: { icon: Settings, label: "Operações" },
  financeiro: { icon: DollarSign, label: "Financeiro" },
};

const severityConfig: Record<string, { icon: typeof Info; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  info: { icon: Info, label: "Oportunidade", variant: "secondary" },
  warning: { icon: AlertTriangle, label: "Atenção", variant: "outline" },
  critical: { icon: AlertCircle, label: "Urgente", variant: "destructive" },
};

export function InsightsTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: insights = [], isLoading } = useCommandInsights(statusFilter);
  const markRead = useMarkInsightRead();
  const generateInsights = useGenerateInsights();

  const newCount = insights.filter(i => i.status === "new").length;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Insights Semanais</h2>
            <p className="text-sm text-muted-foreground">
              Análises de performance geradas pelo assistente
            </p>
          </div>
          {newCount > 0 && (
            <Badge variant="default" className="ml-2">
              {newCount} novo{newCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateInsights.mutate()}
          disabled={generateInsights.isPending}
        >
          {generateInsights.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Gerar agora
        </Button>
      </div>

      {/* Filters */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="new">
            Novos
            {newCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                {newCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">Lidos</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Empty state */}
      {insights.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">Nenhum insight ainda</p>
          <p className="text-sm mb-4">
            Clique em "Gerar agora" para criar a primeira análise do seu negócio.
          </p>
          <Button
            variant="outline"
            onClick={() => generateInsights.mutate()}
            disabled={generateInsights.isPending}
          >
            {generateInsights.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar insights
          </Button>
        </div>
      )}

      {/* Insights list grouped by period */}
      {insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onMarkRead={() => markRead.mutate(insight.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight, onMarkRead }: { insight: CommandInsight; onMarkRead: () => void }) {
  const catConfig = categoryConfig[insight.category] || { icon: Lightbulb, label: insight.category };
  const sevConfig = severityConfig[insight.severity] || severityConfig.info;
  const CatIcon = catConfig.icon;
  const SevIcon = sevConfig.icon;
  const isNew = insight.status === "new";

  return (
    <Card className={`transition-all ${isNew ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CatIcon className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-sm font-semibold truncate">
              {insight.title}
            </CardTitle>
            {isNew && <Badge variant="default" className="shrink-0 text-[10px] px-1.5 py-0">Novo</Badge>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={sevConfig.variant} className="gap-1 text-[10px]">
              <SevIcon className="h-3 w-3" />
              {sevConfig.label}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {catConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.summary}
        </p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-muted-foreground">
            {formatDayMonthBR(insight.period_start)} — {formatDayMonthYearShortBR(insight.period_end)}
          </span>
          {isNew && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onMarkRead}>
              <Eye className="h-3 w-3 mr-1" />
              Marcar como lido
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
