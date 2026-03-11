import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye,
  ShoppingCart,
  CreditCard,
  XCircle,
  TrendingUp,
  Users,
  ShoppingBag,
  LogIn,
  ArrowDownRight,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, calculateTrend } from "@/hooks/useDashboardMetrics";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface DashboardMetricsGridProps {
  metrics: DashboardMetrics | undefined;
  isLoading: boolean;
  trendLabel: string;
}

interface FunnelStepProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  trend?: number;
  trendLabel: string;
  isLast?: boolean;
  variant?: "default" | "primary" | "success" | "warning" | "info";
}

function FunnelStep({ label, value, icon: Icon, trend, trendLabel, isLast, variant = "default" }: FunnelStepProps) {
  const variantColors = {
    default: "text-muted-foreground bg-muted",
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    info: "text-info bg-info/10",
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3 py-3">
        <div className={cn("rounded-lg p-2 shrink-0", variantColors[variant])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold text-card-foreground">{value}</p>
        </div>
        {trend !== undefined && (
          <span className={cn("text-xs font-medium shrink-0", trend >= 0 ? "text-success" : "text-destructive")}>
            {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
        )}
      </div>
      {!isLast && (
        <div className="ml-[18px] h-3 border-l-2 border-dashed border-border" />
      )}
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "info";
}

function MetricRow({ label, value, icon: Icon, trend, variant = "default" }: MetricRowProps) {
  const variantColors = {
    default: "text-muted-foreground bg-muted",
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={cn("rounded-lg p-2 shrink-0", variantColors[variant])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold text-card-foreground">{value}</p>
      </div>
      {trend !== undefined && (
        <span className={cn("text-xs font-medium shrink-0", trend >= 0 ? "text-success" : "text-destructive")}>
          {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export function DashboardMetricsGrid({ metrics, isLoading, trendLabel }: DashboardMetricsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const salesTrend = metrics ? calculateTrend(metrics.salesToday, metrics.salesYesterday) : 0;
  const ordersTrend = metrics ? calculateTrend(metrics.ordersToday, metrics.ordersYesterday) : 0;
  const paidOrdersTrend = metrics ? calculateTrend(metrics.paidOrdersToday, metrics.paidOrdersYesterday) : 0;
  const unpaidOrdersTrend = metrics ? calculateTrend(metrics.unpaidOrdersToday, metrics.unpaidOrdersYesterday) : 0;
  const ticketTrend = metrics ? calculateTrend(metrics.ticketToday, metrics.ticketYesterday) : 0;
  const customersTrend = metrics ? calculateTrend(metrics.newCustomersToday, metrics.newCustomersYesterday) : 0;
  const visitorsTrend = metrics ? calculateTrend(metrics.visitorsToday, metrics.visitorsYesterday) : 0;
  const cartsTrend = metrics ? calculateTrend(metrics.cartsToday ?? 0, metrics.cartsYesterday ?? 0) : 0;
  const checkoutStartedTrend = metrics ? calculateTrend(metrics.checkoutsStartedToday ?? 0, metrics.checkoutsStartedYesterday ?? 0) : 0;
  const abandonedTrend = metrics ? calculateTrend(metrics.abandonedCheckoutsToday ?? 0, metrics.abandonedCheckoutsYesterday ?? 0) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Column 1: Mini Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4" />
            Funil de Conversão
          </CardTitle>
          <p className="text-xs text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="pt-0">
          <FunnelStep
            label="Visitas"
            value={metrics?.visitorsToday ?? 0}
            icon={Eye}
            trend={visitorsTrend}
            trendLabel={trendLabel}
            variant="info"
          />
          <FunnelStep
            label="Adicionou ao carrinho"
            value={metrics?.cartsToday ?? 0}
            icon={ShoppingBag}
            trend={cartsTrend}
            trendLabel={trendLabel}
            variant="warning"
          />
          <FunnelStep
            label="Iniciou checkout"
            value={metrics?.checkoutsStartedToday ?? 0}
            icon={LogIn}
            trend={checkoutStartedTrend}
            trendLabel={trendLabel}
            variant="primary"
          />
          <FunnelStep
            label="Pedidos (vendas efetivadas)"
            value={metrics?.ordersToday ?? 0}
            icon={ShoppingCart}
            trend={ordersTrend}
            trendLabel={trendLabel}
            variant="success"
            isLast
          />
        </CardContent>
      </Card>

      {/* Column 2: Financial / Orders */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pedidos & Financeiro
          </CardTitle>
          <p className="text-xs text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <MetricRow
            label="Pedidos Pagos"
            value={metrics?.paidOrdersToday ?? 0}
            icon={CreditCard}
            trend={paidOrdersTrend}
            variant="success"
          />
          <MetricRow
            label="Pedidos Não Pagos"
            value={metrics?.unpaidOrdersToday ?? 0}
            icon={XCircle}
            trend={unpaidOrdersTrend}
            variant="destructive"
          />
          <MetricRow
            label="Ticket Médio"
            value={formatCurrency(metrics?.ticketToday ?? 0)}
            icon={TrendingUp}
            trend={ticketTrend}
            variant="primary"
          />
          <MetricRow
            label="Novos Clientes (1ª compra)"
            value={metrics?.newCustomersToday ?? 0}
            icon={Users}
            trend={customersTrend}
            variant="info"
          />
        </CardContent>
      </Card>

      {/* Column 3: Abandoned Checkouts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Checkouts Abandonados
          </CardTitle>
          <p className="text-xs text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <MetricRow
            label="Total abandonados"
            value={metrics?.abandonedCheckoutsToday ?? 0}
            icon={ShoppingCart}
            trend={abandonedTrend}
            variant="warning"
          />
          <MetricRow
            label="Recuperados"
            value={metrics?.recoveredCheckoutsToday ?? 0}
            icon={RotateCcw}
            variant="success"
          />
          <MetricRow
            label="Com erros de contato"
            value={metrics?.errorCheckoutsToday ?? 0}
            icon={AlertTriangle}
            variant="destructive"
          />
        </CardContent>
      </Card>
    </div>
  );
}
