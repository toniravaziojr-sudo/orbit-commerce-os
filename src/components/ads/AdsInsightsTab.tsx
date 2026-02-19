import { useState } from "react";
import { Lightbulb, CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, Filter, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/** Remove technical IDs, account references, and clean up insight text for display */
function sanitizeInsightText(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/\bact_\d{10,}\b/g, "")
    .replace(/\(act_[^)]+\)/g, "")
    .replace(/\b(asset ready|asset pending)\s+[0-9a-f-]{20,}/gi, "")
    .replace(/\[NOVO\]\s*/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface Insight {
  id: string;
  channel: string;
  title: string;
  body: string;
  priority: string;
  category: string;
  sentiment: string;
  status: string;
  created_at: string;
}

interface AdsInsightsTabProps {
  insights: Insight[];
  isLoading: boolean;
  onMarkDone: (id: string) => void;
  onMarkIgnored: (id: string) => void;
  onGenerateNow: () => void;
  isGenerating: boolean;
}

const SENTIMENT_CONFIG: Record<string, { icon: any; color: string }> = {
  positive: { icon: TrendingUp, color: "text-green-600" },
  negative: { icon: TrendingDown, color: "text-destructive" },
  neutral: { icon: Minus, color: "text-yellow-600" },
};

const CATEGORY_LABELS: Record<string, string> = {
  budget: "Orçamento",
  funnel: "Funil",
  creative: "Criativos",
  audience: "Públicos",
  product: "Produtos",
  tracking: "Tracking",
  positive: "Positivo",
  general: "Geral",
};

const PRIORITY_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

export function AdsInsightsTab({ insights, isLoading, onMarkDone, onMarkIgnored, onGenerateNow, isGenerating }: AdsInsightsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [showResolved, setShowResolved] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const openInsights = insights.filter(i => i.status === "open");
  const resolvedInsights = insights.filter(i => i.status !== "open");

  let filtered = openInsights;
  if (categoryFilter !== "all") filtered = filtered.filter(i => i.category === categoryFilter);
  if (channelFilter !== "all") filtered = filtered.filter(i => i.channel === channelFilter);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="meta">Meta</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={onGenerateNow} disabled={isGenerating} className="gap-2 text-xs">
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Gerar Insights Agora
          </Button>
        </div>
      </div>

      {/* Open insights */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Nenhum insight disponível"
          description="Clique em 'Gerar Insights Agora' ou aguarde o relatório semanal"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(insight => {
            const sentimentCfg = SENTIMENT_CONFIG[insight.sentiment] || SENTIMENT_CONFIG.neutral;
            const SentimentIcon = sentimentCfg.icon;

            return (
              <Card key={insight.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg bg-muted", sentimentCfg.color)}>
                      <SentimentIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm">{sanitizeInsightText(insight.title)}</span>
                        <Badge variant="outline" className="text-xs capitalize">{insight.channel}</Badge>
                        <Badge variant={PRIORITY_VARIANTS[insight.priority] || "outline"} className="text-xs capitalize">
                          {insight.priority === "critical" ? "Crítico" : insight.priority === "high" ? "Alto" : insight.priority === "medium" ? "Médio" : "Baixo"}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {CATEGORY_LABELS[insight.category] || insight.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{sanitizeInsightText(insight.body)}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => onMarkDone(insight.id)}>
                          <CheckCircle2 className="h-3 w-3" />
                          Vou fazer
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onMarkIgnored(insight.id)}>
                          <XCircle className="h-3 w-3" />
                          Ignorar
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(insight.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resolved insights (collapsible) */}
      {resolvedInsights.length > 0 && (
        <Collapsible open={showResolved} onOpenChange={setShowResolved}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 w-full">
              {showResolved ? "Ocultar" : "Mostrar"} {resolvedInsights.length} insight{resolvedInsights.length > 1 ? "s" : ""} resolvido{resolvedInsights.length > 1 ? "s" : ""}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {resolvedInsights.map(insight => (
              <Card key={insight.id} className="opacity-60">
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={insight.status === "done" ? "default" : "outline"} className="text-xs">
                      {insight.status === "done" ? "Feito" : "Ignorado"}
                    </Badge>
                    <span className="text-sm">{insight.title}</span>
                    <Badge variant="outline" className="text-xs capitalize ml-auto">{insight.channel}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
