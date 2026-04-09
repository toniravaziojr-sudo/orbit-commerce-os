// =============================================
// DASHBOARD TAB — Analytical overview (metrics, quick actions, banners)
// =============================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Package,
  Users,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DashboardMetricsGrid } from "@/components/dashboard/DashboardMetricsGrid";
import { OrderLimitWarning } from "@/components/billing/OrderLimitWarning";
import { PaymentMethodBanner } from "@/components/billing/PaymentMethodBanner";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { getComparisonLabel } from "@/lib/date-presets";

export function DashboardTab() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics(startDate, endDate);

  const handleDateChange = (start?: Date, end?: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const trendLabel = getComparisonLabel(startDate, endDate);

  return (
    <div className="space-y-8 animate-fade-in">
      <PaymentMethodBanner />

      <div className="flex justify-end">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
          label="Período"
        />
      </div>

      <OrderLimitWarning />

      <DashboardMetricsGrid
        metrics={metrics}
        isLoading={metricsLoading}
        trendLabel={trendLabel}
      />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate("/products/new")}
            >
              <Package className="h-5 w-5 text-primary" />
              <span>Novo Produto</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate("/orders/new")}
            >
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span>Novo Pedido</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate("/customers/new")}
            >
              <Users className="h-5 w-5 text-primary" />
              <span>Novo Cliente</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate("/orders?status=pending")}
            >
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>Processar Pedidos</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
