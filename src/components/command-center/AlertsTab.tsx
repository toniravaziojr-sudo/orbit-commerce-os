// =============================================
// ALERTS TAB — Consolidated informative alerts from all modules
// =============================================

import { StorefrontHealthCard } from "@/components/health/StorefrontHealthCard";
import { IntegrationAlerts } from "@/components/dashboard/IntegrationAlerts";
import { IntegrationErrorsCard } from "@/components/dashboard/IntegrationErrorsCard";
import { FiscalAlertsWidget } from "@/components/dashboard/FiscalAlertsWidget";
import { AdsAlertsWidget } from "@/components/dashboard/AdsAlertsWidget";

export function AlertsTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <StorefrontHealthCard />
      <IntegrationAlerts />
      <IntegrationErrorsCard />
      <FiscalAlertsWidget />
      <AdsAlertsWidget />
    </div>
  );
}
