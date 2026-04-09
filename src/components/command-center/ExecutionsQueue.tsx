// =============================================
// EXECUTIONS QUEUE — Unified operational queue
// Groups pending human actions from all modules
// =============================================

import {
  ShoppingCart,
  FileText,
  Plug,
  Megaphone,
  AlertCircle,
  Clock,
  Package,
  TrendingDown,
} from "lucide-react";
import { ExecutionSection, type ExecutionItem } from "./ExecutionSection";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useFiscalAlerts } from "@/hooks/useFiscal";
import { useAdsPendingActions } from "@/hooks/useAdsPendingActions";

export function ExecutionsQueue() {
  const { data: metrics } = useDashboardMetrics();
  const { alerts: fiscalAlerts } = useFiscalAlerts();
  const { pendingActions: adsPending } = useAdsPendingActions();

  // --- Orders Section ---
  const orderItems: ExecutionItem[] = [];

  // Use unpaid orders as "awaiting shipment" proxy (paid but not shipped)
  const pendingShipment = (metrics?.paidOrdersToday ?? 0);
  const pendingPayment = (metrics?.unpaidOrdersToday ?? 0);

  if (pendingPayment > 0) {
    orderItems.push({
      id: "orders-pending-payment",
      title: `${pendingPayment} pedido(s) com pagamento pendente`,
      description: "Aguardando confirmação de pagamento",
      icon: Clock,
      variant: "info",
      navigateTo: "/orders?status=pending",
      actionLabel: "Ver pedidos",
    });
  }

  if (pendingShipment > 0) {
    orderItems.push({
      id: "orders-awaiting-shipment",
      title: `${pendingShipment} pedido(s) pago(s) hoje`,
      description: "Pedidos pagos que podem precisar de processamento",
      icon: Package,
      variant: "warning",
      navigateTo: "/orders?status=processing",
      actionLabel: "Processar",
    });
  }

  // --- Fiscal Section ---
  const fiscalItems: ExecutionItem[] = [];

  if (fiscalAlerts && fiscalAlerts.length > 0) {
    fiscalItems.push({
      id: "fiscal-alerts",
      title: `${fiscalAlerts.length} alerta(s) fiscal(is)`,
      description: "Pedidos cancelados com NF-e autorizada",
      icon: AlertCircle,
      variant: "destructive",
      navigateTo: "/fiscal?tab=invoices",
      actionLabel: "Resolver",
    });
  }

  // --- Integrations Section ---
  const integrationItems: ExecutionItem[] = [];

  // --- Ads Section ---
  const adsItems: ExecutionItem[] = [];

  if (adsPending && adsPending.length > 0) {
    adsItems.push({
      id: "ads-pending-approval",
      title: `${adsPending.length} ação(ões) pendente(s) de aprovação`,
      description: "Ações do autopilot aguardando sua decisão",
      icon: Megaphone,
      variant: "warning",
      navigateTo: "/ads?tab=autopilot",
      actionLabel: "Revisar",
    });
  }

  // --- Insights Section ---
  const insightItems: ExecutionItem[] = [];

  const abandonedCarts = metrics?.abandonedCheckoutsToday ?? 0;
  if (abandonedCarts > 0) {
    insightItems.push({
      id: "insight-abandoned-carts",
      title: `${abandonedCarts} carrinho(s) abandonado(s) hoje`,
      description: "Checkouts não finalizados",
      icon: ShoppingCart,
      variant: "info",
      navigateTo: "/orders?status=abandoned",
      actionLabel: "Ver detalhes",
    });
  }

  const totalPending =
    orderItems.length +
    fiscalItems.length +
    integrationItems.length +
    adsItems.length +
    insightItems.length;

  return (
    <div className="space-y-4 animate-fade-in">
      {totalPending === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">Tudo em dia!</p>
          <p className="text-sm">Nenhuma ação pendente no momento.</p>
        </div>
      )}

      <ExecutionSection
        title="Pedidos"
        icon={ShoppingCart}
        items={orderItems}
        emptyMessage="Nenhum pedido pendente de ação"
      />

      <ExecutionSection
        title="Notas Fiscais"
        icon={FileText}
        items={fiscalItems}
        emptyMessage="Nenhuma pendência fiscal"
      />

      <ExecutionSection
        title="Integrações"
        icon={Plug}
        items={integrationItems}
        emptyMessage="Todas as integrações funcionando"
      />

      <ExecutionSection
        title="Anúncios"
        icon={Megaphone}
        items={adsItems}
        emptyMessage="Nenhuma ação de anúncio pendente"
      />

      <ExecutionSection
        title="Insights"
        icon={AlertCircle}
        items={insightItems}
        emptyMessage="Nenhum insight acionável"
      />
    </div>
  );
}
