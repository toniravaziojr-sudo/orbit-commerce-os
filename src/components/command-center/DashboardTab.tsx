// =============================================
// DASHBOARD TAB — Visão analítica + Preview de Vendas
// =============================================
import { useState, useMemo } from "react";
import { subDays } from "date-fns";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DashboardMetricsGrid } from "@/components/dashboard/DashboardMetricsGrid";
import { OrderLimitWarning } from "@/components/billing/OrderLimitWarning";
import { PaymentMethodBanner } from "@/components/billing/PaymentMethodBanner";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { getComparisonLabel } from "@/lib/date-presets";
import { SalesPreviewBlock } from "./SalesPreviewBlock";

export function DashboardTab() {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics(startDate, endDate);

  const handleDateChange = (start?: Date, end?: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const trendLabel = getComparisonLabel(startDate, endDate);

  // Filters para o Preview de Vendas (default últimos 30 dias quando não há seleção)
  const previewFilters = useMemo(() => ({
    startDate: startDate || subDays(new Date(), 29),
    endDate: endDate || new Date(),
  }), [startDate, endDate]);

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

      <SalesPreviewBlock filters={previewFilters} />
    </div>
  );
}
