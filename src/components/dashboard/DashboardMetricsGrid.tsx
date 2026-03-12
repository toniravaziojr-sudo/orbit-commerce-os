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

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "info";
}

function MetricCard({ label, value, icon: Icon, trend, variant = "default" }: MetricCardProps) {
  const variantColors = {
    default: "text-muted-foreground bg-muted",
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  };

  return (
    <div className="flex items-center gap-4 min-w-0">
      <div className={cn("rounded-xl p-3 shrink-0", variantColors[variant])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-card-foreground">{value}</p>
          {trend !== undefined && (
            <span className={cn("text-xs font-medium shrink-0", trend >= 0 ? "text-success" : "text-destructive")}>
              {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardMetricsGrid({ metrics, isLoading, trendLabel }: DashboardMetricsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

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
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {/* Column 1: Mini Funnel */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4" />
            Funil de Conversão
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 grid grid-cols-2 gap-x-6 gap-y-5">
          <MetricCard
            label="Visitas"
            value={metrics?.visitorsToday ?? 0}
            icon={Eye}
            trend={visitorsTrend}
            variant="info"
          />
          <MetricCard
            label="Adicionou ao carrinho"
            value={metrics?.cartsToday ?? 0}
            icon={ShoppingBag}
            trend={cartsTrend}
            variant="warning"
          />
          <MetricCard
            label="Iniciou checkout"
            value={metrics?.checkoutsStartedToday ?? 0}
            icon={LogIn}
            trend={checkoutStartedTrend}
            variant="primary"
          />
          <MetricCard
            label="Pedidos (vendas efetivadas)"
            value={metrics?.ordersToday ?? 0}
            icon={ShoppingCart}
            trend={ordersTrend}
            variant="success"
          />
        </CardContent>
      </Card>

      {/* Column 2: Financial / Orders */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pedidos & Financeiro
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 grid grid-cols-2 gap-x-6 gap-y-5">
          <MetricCard
            label="Pedidos Pagos"
            value={metrics?.paidOrdersToday ?? 0}
            icon={CreditCard}
            trend={paidOrdersTrend}
            variant="success"
          />
          <MetricCard
            label="Pedidos Não Pagos"
            value={metrics?.unpaidOrdersToday ?? 0}
            icon={XCircle}
            trend={unpaidOrdersTrend}
            variant="destructive"
          />
          <MetricCard
            label="Ticket Médio"
            value={formatCurrency(metrics?.ticketToday ?? 0)}
            icon={TrendingUp}
            trend={ticketTrend}
            variant="primary"
          />
          <MetricCard
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
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Checkouts Abandonados
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-2 grid grid-cols-2 gap-x-4 gap-y-3">
          <MetricCard
            label="Total abandonados"
            value={metrics?.abandonedCheckoutsToday ?? 0}
            icon={ShoppingCart}
            trend={abandonedTrend}
            variant="warning"
          />
          <MetricCard
            label="Recuperados"
            value={metrics?.recoveredCheckoutsToday ?? 0}
            icon={RotateCcw}
            variant="success"
          />
          <MetricCard
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
