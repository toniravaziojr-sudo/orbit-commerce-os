import { useNavigate } from "react-router-dom";
import { Megaphone, Lightbulb, Wallet, ArrowRight, AlertTriangle, CheckCircle2, Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdsInsights } from "@/hooks/useAdsInsights";
import { useAdsBalanceMonitor } from "@/hooks/useAdsBalanceMonitor";
import { useAdsPendingActions } from "@/hooks/useAdsPendingActions";
import { cn } from "@/lib/utils";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function AdsAlertsWidget() {
  const navigate = useNavigate();
  const { insights } = useAdsInsights();
  const balance = useAdsBalanceMonitor();
  const { pendingCount } = useAdsPendingActions();

  const openInsights = insights.filter(i => i.status === "open");
  const hasLowBalance = balance.lowBalanceCount > 0;
  const hasZeroBalance = balance.zeroBalanceCount > 0;

  const items: { icon: any; title: string; description: string; variant: "warning" | "info" | "destructive" | "success" }[] = [];

  if (hasZeroBalance) {
    items.push({
      icon: AlertTriangle,
      title: `${balance.zeroBalanceCount} conta${balance.zeroBalanceCount !== 1 ? "s" : ""} sem saldo`,
      description: "Campanhas podem estar pausadas por falta de crédito",
      variant: "destructive",
    });
  }

  if (hasLowBalance) {
    for (const acc of balance.lowBalanceAccounts) {
      items.push({
        icon: Wallet,
        title: `Saldo baixo: ${acc.name}`,
        description: `Restam apenas ${formatCurrency(acc.balance_cents)}`,
        variant: "warning",
      });
    }
  }

  if (pendingCount > 0) {
    items.push({
      icon: Hourglass,
      title: `${pendingCount} ${pendingCount === 1 ? "ação aguardando" : "ações aguardando"} sua aprovação`,
      description: "Propostas da IA precisam da sua decisão",
      variant: "warning",
    });
  }

  if (openInsights.length > 0) {
    items.push({
      icon: Lightbulb,
      title: `${openInsights.length} insight${openInsights.length !== 1 ? "s" : ""} não lido${openInsights.length !== 1 ? "s" : ""}`,
      description: "Recomendações da IA aguardando revisão",
      variant: "info",
    });
  }

  // Show "all good" when there's data but no alerts
  if (items.length === 0) {
    items.push({
      icon: CheckCircle2,
      title: "Tudo certo com suas campanhas",
      description: balance.hasData
        ? `${balance.totalAccounts} conta${balance.totalAccounts !== 1 ? "s" : ""} monitorada${balance.totalAccounts !== 1 ? "s" : ""} · ${balance.activeCampaigns} campanha${balance.activeCampaigns !== 1 ? "s" : ""} ativa${balance.activeCampaigns !== 1 ? "s" : ""}`
        : "Nenhum alerta de tráfego no momento",
      variant: "success",
    });
  }

  const iconColors = {
    warning: "text-warning bg-warning/10",
    info: "text-info bg-info/10",
    destructive: "text-destructive bg-destructive/10",
    success: "text-green-600 bg-green-500/10",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Gestor de Tráfego
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-primary"
          onClick={() => navigate("/ads")}
        >
          Ver tudo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate("/ads")}
              >
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", iconColors[item.variant])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                {item.variant === "destructive" && (
                  <Badge variant="destructive" className="text-[10px] h-5 flex-shrink-0">Crítico</Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
