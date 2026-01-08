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

// Demo data - clearly marked
const DEMO_RECENT_ORDERS = [
  {
    id: "#12847",
    customer: "Maria Silva",
    total: "R$ 459,90",
    status: "pending",
    statusLabel: "Aguardando pagamento",
    time: "Há 5 min",
  },
  {
    id: "#12846",
    customer: "João Santos",
    total: "R$ 1.234,00",
    status: "success",
    statusLabel: "Pago",
    time: "Há 12 min",
  },
  {
    id: "#12845",
    customer: "Ana Costa",
    total: "R$ 89,90",
    status: "warning",
    statusLabel: "Enviado",
    time: "Há 28 min",
  },
  {
    id: "#12844",
    customer: "Pedro Lima",
    total: "R$ 567,00",
    status: "success",
    statusLabel: "Entregue",
    time: "Há 1h",
  },
];

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

export default function Dashboard() {
  const statusVariantMap = {
    pending: "warning",
    success: "success",
    warning: "info",
  } as const;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Visão geral da sua operação em tempo real"
      />
      
      {/* Order Limit Warning */}
      <OrderLimitWarning />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Vendas Hoje"
          value="R$ 12.450"
          icon={DollarSign}
          variant="success"
          trend={{ value: 12.5, label: "vs. ontem" }}
        />
        <StatCard
          title="Pedidos Hoje"
          value="47"
          icon={ShoppingCart}
          variant="primary"
          trend={{ value: 8.2, label: "vs. ontem" }}
        />
        <StatCard
          title="Ticket Médio"
          value="R$ 264,89"
          icon={TrendingUp}
          variant="default"
          trend={{ value: -2.4, label: "vs. ontem" }}
        />
        <StatCard
          title="Novos Clientes"
          value="23"
          icon={Users}
          variant="info"
          trend={{ value: 18.7, label: "vs. ontem" }}
        />
      </div>

      {/* Communications Widget - Destaque para comunicações */}
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
            <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DEMO_RECENT_ORDERS.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {order.id} - {order.customer}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge
                      variant={statusVariantMap[order.status as keyof typeof statusVariantMap]}
                      dot
                    >
                      {order.statusLabel}
                    </StatusBadge>
                    <span className="font-semibold text-foreground">
                      {order.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Attention Required */}
        <div className="space-y-6">
          {/* Integration Alerts - WhatsApp/Email disconnected */}
          <IntegrationAlerts />
          
          {/* Storefront Health Card */}
          <StorefrontHealthCard />
          
          {/* Other attention items */}
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
