import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  Eye,
  ShoppingCart,
  CreditCard,
  XCircle,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";
import { formatCurrency, calculateTrend } from "@/hooks/useDashboardMetrics";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface DashboardMetricsGridProps {
  metrics: DashboardMetrics | undefined;
  isLoading: boolean;
  trendLabel: string;
}

export function DashboardMetricsGrid({ metrics, isLoading, trendLabel }: DashboardMetricsGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const salesTrend = metrics ? calculateTrend(metrics.salesToday, metrics.salesYesterday) : 0;
  const visitorsTrend = metrics ? calculateTrend(metrics.visitorsToday, metrics.visitorsYesterday) : 0;
  const ticketTrend = metrics ? calculateTrend(metrics.ticketToday, metrics.ticketYesterday) : 0;
  const customersTrend = metrics ? calculateTrend(metrics.newCustomersToday, metrics.newCustomersYesterday) : 0;
  const ordersTrend = metrics ? calculateTrend(metrics.ordersToday, metrics.ordersYesterday) : 0;
  const paidOrdersTrend = metrics ? calculateTrend(metrics.paidOrdersToday, metrics.paidOrdersYesterday) : 0;
  const unpaidOrdersTrend = metrics ? calculateTrend(metrics.unpaidOrdersToday, metrics.unpaidOrdersYesterday) : 0;

  return (
    <div className="space-y-4">
      {/* Row 1: Key metrics - 4 cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Vendas"
          value={formatCurrency(metrics?.salesToday ?? 0)}
          icon={DollarSign}
          trend={{ value: salesTrend, label: trendLabel }}
          variant="success"
        />
        <StatCard
          title="Visitantes"
          value={metrics?.visitorsToday ?? 0}
          icon={Eye}
          trend={{ value: visitorsTrend, label: trendLabel }}
          variant="info"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(metrics?.ticketToday ?? 0)}
          icon={TrendingUp}
          trend={{ value: ticketTrend, label: trendLabel }}
          variant="primary"
        />
        <StatCard
          title="Novos Clientes"
          value={metrics?.newCustomersToday ?? 0}
          icon={Users}
          trend={{ value: customersTrend, label: trendLabel }}
          variant="destructive"
        />
      </div>

      {/* Row 2: Orders - 3 cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Pedidos (total)"
          value={metrics?.ordersToday ?? 0}
          icon={ShoppingCart}
          trend={{ value: ordersTrend, label: trendLabel }}
          variant="primary"
        />
        <StatCard
          title="Pedidos Pagos"
          value={metrics?.paidOrdersToday ?? 0}
          icon={CreditCard}
          trend={{ value: paidOrdersTrend, label: trendLabel }}
          variant="success"
        />
        <StatCard
          title="Pedidos Não Pagos"
          value={metrics?.unpaidOrdersToday ?? 0}
          icon={XCircle}
          trend={{ value: unpaidOrdersTrend, label: trendLabel }}
          variant="destructive"
        />
      </div>
    </div>
  );
}
