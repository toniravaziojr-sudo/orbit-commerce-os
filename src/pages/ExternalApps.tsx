import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Calendar, Truck } from "lucide-react";
import { GoogleTagManagerTab } from "@/components/external-apps/GoogleTagManagerTab";
import { GoogleCalendarTab } from "@/components/external-apps/GoogleCalendarTab";
import { WmsPratikaTab } from "@/components/external-apps/WmsPratikaTab";

export default function ExternalApps() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Aplicativos Externos"
        description="Gerencie integrações de utilidade e produtividade"
      />

      <Tabs defaultValue="gtm" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gtm" className="gap-2">
            <Tag className="h-4 w-4" />
            Tag Manager
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gtm">
          <GoogleTagManagerTab />
        </TabsContent>

        <TabsContent value="calendar">
          <GoogleCalendarTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
