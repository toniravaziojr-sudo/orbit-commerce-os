import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Image, Video, Mic, FileText, Search, Sparkles, Brain, Zap } from "lucide-react";
import { useCreditWallet, useCreditLedger, formatCredits } from "@/hooks/useCredits";

const FEATURE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  chat: { label: "Chat / Assistente IA", icon: Bot, color: "text-blue-500" },
  vision: { label: "Análise de Imagens", icon: Image, color: "text-violet-500" },
  image: { label: "Geração de Imagens", icon: Image, color: "text-pink-500" },
  video: { label: "Geração de Vídeos", icon: Video, color: "text-red-500" },
  avatar: { label: "Avatares IA", icon: Video, color: "text-orange-500" },
  audio: { label: "Transcrição de Áudio", icon: Mic, color: "text-amber-500" },
  seo: { label: "SEO / Textos IA", icon: FileText, color: "text-green-500" },
  embedding: { label: "Embeddings", icon: Search, color: "text-cyan-500" },
  landing_page: { label: "Landing Pages IA", icon: Sparkles, color: "text-purple-500" },
  creative: { label: "Criativos / Mídia", icon: Brain, color: "text-indigo-500" },
  ads: { label: "Gestão de Tráfego IA", icon: Zap, color: "text-emerald-500" },
  support: { label: "IA Atendimento", icon: Bot, color: "text-teal-500" },
};

function getFeatureConfig(feature: string) {
  return FEATURE_CONFIG[feature] || { label: feature, icon: Sparkles, color: "text-muted-foreground" };
}

export function AIUsageBreakdown() {
  const { data: wallet, isLoading: walletLoading } = useCreditWallet();
  const { data: ledger = [], isLoading: ledgerLoading } = useCreditLedger(500);

  const isLoading = walletLoading || ledgerLoading;

  // Aggregate consumption by feature
  const breakdown = useMemo(() => {
    const consumptions = ledger.filter((e) => e.transaction_type === "consume");
    const byFeature: Record<string, { credits: number; count: number }> = {};

    for (const entry of consumptions) {
      const key = entry.feature || "other";
      if (!byFeature[key]) byFeature[key] = { credits: 0, count: 0 };
      byFeature[key].credits += Math.abs(entry.credits_delta);
      byFeature[key].count += 1;
    }

    return Object.entries(byFeature)
      .map(([feature, data]) => ({ feature, ...data }))
      .sort((a, b) => b.credits - a.credits);
  }, [ledger]);

  const totalConsumed = breakdown.reduce((sum, b) => sum + b.credits, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Uso de Créditos de IA
        </CardTitle>
        <CardDescription>
          Consumo detalhado por funcionalidade
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-primary">
              {formatCredits(wallet?.balance_credits ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Saldo Atual</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">
              {formatCredits(wallet?.lifetime_consumed ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total Consumido</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">
              {formatCredits(wallet?.lifetime_purchased ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total Comprado</p>
          </div>
        </div>

        {/* Breakdown by feature */}
        {breakdown.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum consumo registrado</p>
            <p className="text-sm">Os créditos consumidos por cada funcionalidade aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {breakdown.map(({ feature, credits, count }) => {
              const config = getFeatureConfig(feature);
              const Icon = config.icon;
              const pct = totalConsumed > 0 ? (credits / totalConsumed) * 100 : 0;

              return (
                <div key={feature} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <span className="text-sm font-medium">{config.label}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {count} {count === 1 ? "uso" : "usos"}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCredits(credits)} créditos
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
