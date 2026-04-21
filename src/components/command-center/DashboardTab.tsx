// =============================================
// DASHBOARD TAB — Analytical overview (metrics, banners)
// =============================================

import { useState } from "react";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DashboardMetricsGrid } from "@/components/dashboard/DashboardMetricsGrid";
import { OrderLimitWarning } from "@/components/billing/OrderLimitWarning";
import { PaymentMethodBanner } from "@/components/billing/PaymentMethodBanner";
import { WhatsAppRealReceptionPendingBanner } from "@/components/dashboard/WhatsAppRealReceptionPendingBanner";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { getComparisonLabel } from "@/lib/date-presets";
import { WhatsAppHealthCard } from "@/components/command-center/WhatsAppHealthCard";

export function DashboardTab() {
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
      <WhatsAppRealReceptionPendingBanner />

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

      <WhatsAppHealthCard />
    </div>
  );
}
