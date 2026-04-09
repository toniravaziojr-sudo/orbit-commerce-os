// =============================================
// COMMUNICATIONS TAB — Communications widget and content calendar alerts
// =============================================

import { CommunicationsWidget } from "@/components/dashboard/CommunicationsWidget";
import { ContentCalendarAlertsCard } from "@/components/dashboard/ContentCalendarAlertsCard";

export function CommunicationsTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <CommunicationsWidget />
      <ContentCalendarAlertsCard />
    </div>
  );
}
