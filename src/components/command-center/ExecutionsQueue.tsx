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

  const pendingShipment = metrics?.funnel?.awaiting_shipment ?? 0;
  if (pendingShipment > 0) {
    orderItems.push({
      id: "orders-awaiting-shipment",
      title: `${pendingShipment} pedido(s) aguardando envio`,
      description: "Pedidos pagos que ainda não foram enviados",
      icon: Package,
      variant: "warning",
      navigateTo: "/orders?status=processing",
      actionLabel: "Processar",
    });
  }

  const pendingPayment = metrics?.funnel?.pending_payment ?? 0;
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
  // Integration errors are loaded by IntegrationErrorsCard internally;
  // for now, this section serves as a placeholder for real-time data.

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

  const lowStock = metrics?.attention?.low_stock ?? 0;
  if (lowStock > 0) {
    insightItems.push({
      id: "insight-low-stock",
      title: `${lowStock} produto(s) com estoque baixo`,
      description: "Menos de 5 unidades disponíveis",
      icon: TrendingDown,
      variant: "destructive",
      navigateTo: "/products?stock=low",
      actionLabel: "Ver produtos",
    });
  }

  const abandonedCarts = metrics?.funnel?.abandoned_checkouts ?? 0;
  if (abandonedCarts > 0) {
    insightItems.push({
      id: "insight-abandoned-carts",
      title: `${abandonedCarts} carrinho(s) abandonado(s)`,
      description: "Checkouts não finalizados recentemente",
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
