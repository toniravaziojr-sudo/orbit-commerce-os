import { PageHeader } from "@/components/ui/page-header";
import { MarketingIntegrationsSettings } from "@/components/integrations/MarketingIntegrationsSettings";
import { ProductFeedsSettings } from "@/components/integrations/ProductFeedsSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, BarChart3, Rss } from "lucide-react";

export default function Marketing() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Marketing"
        description="Configure integrações de marketing e rastreamento de conversões"
      />

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integrations" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="feeds" className="gap-2">
            <Rss className="h-4 w-4" />
            Catálogos
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2" disabled>
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <MarketingIntegrationsSettings />
        </TabsContent>

        <TabsContent value="feeds">
          <ProductFeedsSettings />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Relatórios de Marketing</h3>
            <p>Em breve você poderá ver métricas de conversão e performance.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
