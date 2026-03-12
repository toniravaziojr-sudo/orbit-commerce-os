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
  DollarSign,
  BarChart3,
  Percent,
  Megaphone,
  UserCheck,
  Truck,
  Wallet,
  Package,
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
  trendLabel?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "info";
  compact?: boolean;
}

function MetricCard({ label, value, icon: Icon, trend, trendLabel, variant = "default", compact = false }: MetricCardProps) {
  const iconBgColors = {
    default: "bg-muted",
    primary: "bg-primary/10",
    success: "bg-success/10",
    warning: "bg-warning/10",
    destructive: "bg-destructive/10",
    info: "bg-info/10",
  };

  const iconColors = {
    default: "text-muted-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-info",
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-sm flex-1 min-w-0", compact ? "p-3" : "p-4")}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn("font-medium text-muted-foreground", compact ? "text-xs" : "text-sm")}>{label}</p>
          <p className={cn("font-bold text-card-foreground", compact ? "text-lg" : "text-2xl")}>{value}</p>
        </div>
        <div className={cn("rounded-lg", compact ? "p-1.5" : "p-2.5", iconBgColors[variant])}>
          <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5", iconColors[variant])} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={cn("flex items-center gap-2", compact ? "mt-2 text-xs" : "mt-3 text-sm")}>
          <span className={cn("font-medium", trend >= 0 ? "text-success" : "text-destructive")}>
            {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
          {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function DashboardMetricsGrid({ metrics, isLoading, trendLabel }: DashboardMetricsGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
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
  const leadsTrend = metrics ? calculateTrend(metrics.leadsToday ?? 0, metrics.leadsYesterday ?? 0) : 0;
  const shippingTrend = metrics ? calculateTrend(metrics.shippingSelectedToday ?? 0, metrics.shippingSelectedYesterday ?? 0) : 0;
  const paymentTrend = metrics ? calculateTrend(metrics.paymentSelectedToday ?? 0, metrics.paymentSelectedYesterday ?? 0) : 0;
  const abandonedTrend = metrics ? calculateTrend(metrics.abandonedCheckoutsToday ?? 0, metrics.abandonedCheckoutsYesterday ?? 0) : 0;
  const totalRevenueTrend = metrics ? calculateTrend(metrics.totalRevenueToday, metrics.totalRevenueYesterday) : 0;
  const adSpendTrend = metrics ? calculateTrend(metrics.adSpendToday, metrics.adSpendYesterday) : 0;
  const convRateTrend = metrics ? calculateTrend(metrics.conversionRateToday, metrics.conversionRateYesterday) : 0;

  // ROAS = faturamento real (paid) / ad spend total
  const adSpend = metrics?.adSpendToday ?? 0;
  const roasToday = adSpend > 0 ? (metrics?.salesToday ?? 0) / adSpend : 0;
  const adSpendYesterday = metrics?.adSpendYesterday ?? 0;
  const roasYesterday = adSpendYesterday > 0 ? (metrics?.salesYesterday ?? 0) / adSpendYesterday : 0;
  const roasTrend = metrics ? calculateTrend(roasToday, roasYesterday) : 0;

  // Format ROAS as "Xx" (e.g., "4.5x")
  const formatRoas = (value: number) => value > 0 ? `${value.toFixed(2)}x` : "0x";

  return (
    <div className="space-y-4">
      {/* Bloco 1: Desempenho Geral (Faturamento + Marketing mesclados) */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Desempenho Geral
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-3 flex gap-3 flex-wrap">
          <MetricCard label="Faturamento Total" value={formatCurrency(metrics?.totalRevenueToday ?? 0)} icon={DollarSign} trend={totalRevenueTrend} trendLabel={trendLabel} variant="primary" />
          <MetricCard label="Faturamento Real" value={formatCurrency(metrics?.salesToday ?? 0)} icon={BarChart3} trend={metrics ? calculateTrend(metrics.salesToday, metrics.salesYesterday) : 0} trendLabel={trendLabel} variant="success" />
          <MetricCard label="Investido em Anúncios" value={adSpend > 0 ? formatCurrency(adSpend) : "R$ 0,00"} icon={Megaphone} trend={adSpendTrend} trendLabel={trendLabel} variant="primary" />
          <MetricCard label="Retorno Real (ROI)" value={adSpend > 0 ? `${formatRoas(roasToday)}` : "Sem investimento"} icon={TrendingUp} trend={roasTrend} trendLabel={trendLabel} variant={roasToday >= 1 ? "info" : "destructive"} />
          <MetricCard label="Taxa de Conversão" value={`${(metrics?.conversionRateToday ?? 0).toFixed(2)}%`} icon={Percent} trend={convRateTrend} trendLabel={trendLabel} variant="warning" />
        </CardContent>
      </Card>

      {/* Bloco 2: Pedidos & Financeiro (com Total de Pedidos no início) */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pedidos & Financeiro
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-3 flex gap-3 flex-wrap">
          <MetricCard label="Total de Pedidos" value={metrics?.ordersToday ?? 0} icon={Package} trend={ordersTrend} trendLabel={trendLabel} variant="info" />
          <MetricCard label="Pedidos Pagos" value={metrics?.paidOrdersToday ?? 0} icon={CreditCard} trend={paidOrdersTrend} trendLabel={trendLabel} variant="success" />
          <MetricCard label="Pedidos Não Pagos" value={metrics?.unpaidOrdersToday ?? 0} icon={XCircle} trend={unpaidOrdersTrend} trendLabel={trendLabel} variant="destructive" />
          <MetricCard label="Ticket Médio" value={formatCurrency(metrics?.ticketToday ?? 0)} icon={TrendingUp} trend={ticketTrend} trendLabel={trendLabel} variant="primary" />
          <MetricCard label="Novos Clientes (1ª compra)" value={metrics?.newCustomersToday ?? 0} icon={Users} trend={customersTrend} trendLabel={trendLabel} variant="info" />
        </CardContent>
      </Card>

      {/* Bloco 3: Funil de Conversão Completo */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4" />
            Funil de Conversão
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-3 flex gap-2 flex-wrap">
          <MetricCard compact label="Visitas Únicas" value={metrics?.visitorsToday ?? 0} icon={Eye} trend={visitorsTrend} trendLabel={trendLabel} variant="info" />
          <MetricCard compact label="Carrinho" value={metrics?.cartsToday ?? 0} icon={ShoppingBag} trend={cartsTrend} trendLabel={trendLabel} variant="warning" />
          <MetricCard compact label="Checkout" value={metrics?.checkoutsStartedToday ?? 0} icon={LogIn} trend={checkoutStartedTrend} trendLabel={trendLabel} variant="primary" />
          <MetricCard compact label="Lead" value={metrics?.leadsToday ?? 0} icon={UserCheck} trend={leadsTrend} trendLabel={trendLabel} variant="info" />
          <MetricCard compact label="Add Frete" value={metrics?.shippingSelectedToday ?? 0} icon={Truck} trend={shippingTrend} trendLabel={trendLabel} variant="warning" />
          <MetricCard compact label="Add Pagamento" value={metrics?.paymentSelectedToday ?? 0} icon={Wallet} trend={paymentTrend} trendLabel={trendLabel} variant="primary" />
          <MetricCard compact label="Compras" value={metrics?.ordersToday ?? 0} icon={ShoppingCart} trend={ordersTrend} trendLabel={trendLabel} variant="success" />
        </CardContent>
      </Card>

      {/* Bloco 4: Checkouts Abandonados */}
      <Card>
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Checkouts Abandonados
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">{trendLabel}</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-3 flex gap-3">
          <MetricCard label="Total abandonados" value={metrics?.abandonedCheckoutsToday ?? 0} icon={ShoppingCart} trend={abandonedTrend} trendLabel={trendLabel} variant="warning" />
          <MetricCard label="Recuperados" value={metrics?.recoveredCheckoutsToday ?? 0} icon={RotateCcw} variant="success" />
          <MetricCard label="Com erros de contato" value={metrics?.errorCheckoutsToday ?? 0} icon={AlertTriangle} variant="destructive" />
        </CardContent>
      </Card>
    </div>
  );
}
