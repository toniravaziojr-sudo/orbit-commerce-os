import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Bot, CalendarClock } from "lucide-react";
import { AgendaContent } from "@/components/command-center/agenda";
import { EmbeddedCommandAssistant } from "@/components/command-assistant/EmbeddedCommandAssistant";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDashboardMetrics,
  useRecentOrders,
  calculateTrend,
  formatCurrency,
  formatRelativeTime,
} from "@/hooks/useDashboardMetrics";

// Dashboard content (from Dashboard.tsx)
import {
  ShoppingCart,
  DollarSign,
  Users,
  TrendingUp,
  Package,
  AlertCircle,
  Clock,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StorefrontHealthCard } from "@/components/health/StorefrontHealthCard";
import { IntegrationAlerts } from "@/components/dashboard/IntegrationAlerts";
import { CommunicationsWidget } from "@/components/dashboard/CommunicationsWidget";
import { FiscalAlertsWidget } from "@/components/dashboard/FiscalAlertsWidget";
import { OrderLimitWarning } from "@/components/billing/OrderLimitWarning";

const DEMO_ATTENTION_ITEMS = [
  {
    icon: AlertCircle,
    title: "3 pedidos aguardando envio",
    description: "Pedidos pagos há mais de 24h",
    variant: "warning" as const,
  },
  {
    icon: Clock,
    title: "5 carrinhos abandonados",
    description: "Nas últimas 2 horas",
    variant: "info" as const,
  },
  {
    icon: Package,
    title: "2 produtos com estoque baixo",
    description: "Menos de 5 unidades",
    variant: "destructive" as const,
  },
];

// Dashboard Tab Content
function DashboardContent() {
  const navigate = useNavigate();
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: recentOrders, isLoading: ordersLoading } = useRecentOrders(4);

  const statusVariantMap = {
    pending: "warning",
    processing: "info",
    shipped: "info",
    delivered: "success",
    cancelled: "destructive",
    returned: "destructive",
  } as const;

  const paymentStatusLabels: Record<string, string> = {
    pending: "Aguardando pagamento",
    paid: "Pago",
    failed: "Falhou",
    refunded: "Reembolsado",
  };

  const orderStatusLabels: Record<string, string> = {
    pending: "Pendente",
    processing: "Processando",
    shipped: "Enviado",
    delivered: "Entregue",
    cancelled: "Cancelado",
    returned: "Devolvido",
  };

  // Calculate trends
  const salesTrend = metrics ? calculateTrend(metrics.salesToday, metrics.salesYesterday) : 0;
  const ordersTrend = metrics ? calculateTrend(metrics.ordersToday, metrics.ordersYesterday) : 0;
  const ticketTrend = metrics ? calculateTrend(metrics.ticketToday, metrics.ticketYesterday) : 0;
  const customersTrend = metrics ? calculateTrend(metrics.newCustomersToday, metrics.newCustomersYesterday) : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Order Limit Warning */}
      <OrderLimitWarning />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <StatCard
              title="Vendas Hoje"
              value={formatCurrency(metrics?.salesToday || 0)}
              icon={DollarSign}
              variant="success"
              trend={{ value: parseFloat(salesTrend.toFixed(1)), label: "vs. ontem" }}
            />
            <StatCard
              title="Pedidos Hoje"
              value={String(metrics?.ordersToday || 0)}
              icon={ShoppingCart}
              variant="primary"
              trend={{ value: parseFloat(ordersTrend.toFixed(1)), label: "vs. ontem" }}
            />
            <StatCard
              title="Ticket Médio"
              value={formatCurrency(metrics?.ticketToday || 0)}
              icon={TrendingUp}
              variant="default"
              trend={{ value: parseFloat(ticketTrend.toFixed(1)), label: "vs. ontem" }}
            />
            <StatCard
              title="Novos Clientes"
              value={String(metrics?.newCustomersToday || 0)}
              icon={Users}
              variant="info"
              trend={{ value: parseFloat(customersTrend.toFixed(1)), label: "vs. ontem" }}
            />
          </>
        )}
      </div>

      {/* Communications Widget */}
      <CommunicationsWidget />

      {/* Fiscal Alerts Widget */}
      <FiscalAlertsWidget />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              Pedidos Recentes
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1.5 text-primary"
              onClick={() => navigate('/orders')}
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/orders?orderId=${order.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {order.order_number} - {order.customer_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatRelativeTime(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge
                        variant={statusVariantMap[order.status as keyof typeof statusVariantMap] || "default"}
                        dot
                      >
                        {order.payment_status === 'approved' 
                          ? orderStatusLabels[order.status] || order.status
                          : paymentStatusLabels[order.payment_status] || order.payment_status}
                      </StatusBadge>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum pedido recente
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attention Required */}
        <div className="space-y-6">
          <IntegrationAlerts />
          <StorefrontHealthCard />
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Atenção Agora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {DEMO_ATTENTION_ITEMS.map((item, index) => {
                  const Icon = item.icon;
                  const iconColors = {
                    warning: "text-warning bg-warning/10",
                    info: "text-info bg-info/10",
                    destructive: "text-destructive bg-destructive/10",
                  };
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColors[item.variant]}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col gap-2 py-4">
              <Package className="h-5 w-5 text-primary" />
              <span>Novo Produto</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span>Novo Pedido</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4">
              <Users className="h-5 w-5 text-primary" />
              <span>Novo Cliente</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>Processar Pedidos</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Agenda Tab Content - Uses dedicated component
// (AgendaContent is imported from command-center/agenda)

export default function CommandCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Central de Execuções"
        description="Visão geral da sua operação, assistente de comando e tarefas pendentes"
      />

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão geral</span>
          </TabsTrigger>
          <TabsTrigger value="assistant" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Assistente</span>
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            <span className="hidden sm:inline">Agenda</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <DashboardContent />
        </TabsContent>

        <TabsContent value="assistant" className="mt-6">
          <EmbeddedCommandAssistant />
        </TabsContent>

        <TabsContent value="agenda" className="mt-6">
          <AgendaContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
