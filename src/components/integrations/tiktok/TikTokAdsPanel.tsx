// =============================================
// TIKTOK ADS PANEL
// Tabbed panel for TikTok Ads operations
// Shown inside TikTokUnifiedSettings when Ads is connected
// =============================================

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Megaphone, BarChart3 } from 'lucide-react';
import { TikTokAdsCampaignsTab } from './TikTokAdsCampaignsTab';
import { TikTokAdsInsightsTab } from './TikTokAdsInsightsTab';

export function TikTokAdsPanel() {
  return (
    <div className="pt-2">
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
            <Megaphone className="h-3.5 w-3.5" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <TikTokAdsCampaignsTab />
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <TikTokAdsInsightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
