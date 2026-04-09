// =============================================
// CENTRAL DE EXECUÇÕES — Unified operational queue
// Shows ONLY categories with pending items. Cards with stats grid.
// Includes: Pedidos, Fiscal, Comunicações, Integrações, Anúncios, Alertas & Insights
// =============================================

import {
  ShoppingCart,
  FileText,
  Plug,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  Package,
} from "lucide-react";
import { ExecutionCard } from "./ExecutionCard";
import { useExecutionCounts } from "@/hooks/useExecutionCounts";

export function ExecutionsQueue() {
  const {
    orders,
    fiscal,
    communications,
    integrations,
    ads,
    alerts,
    totalPending,
    isLoading,
  } = useExecutionCounts();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {totalPending === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">Tudo em dia!</p>
          <p className="text-sm">Nenhuma ação pendente no momento.</p>
        </div>
      )}

      <ExecutionCard
        title="Pedidos"
        icon={ShoppingCart}
        stats={orders.stats}
      />

      <ExecutionCard
        title="Notas Fiscais"
        icon={FileText}
        stats={fiscal.stats}
      />

      <ExecutionCard
        title="Comunicações"
        icon={MessageSquare}
        stats={communications.stats}
      />

      <ExecutionCard
        title="Integrações"
        icon={Plug}
        stats={integrations.stats}
      />

      <ExecutionCard
        title="Anúncios"
        icon={Megaphone}
        stats={ads.stats}
      />

      <ExecutionCard
        title="Alertas & Insights"
        icon={ShieldAlert}
        stats={alerts.stats}
      />
    </div>
  );
}
