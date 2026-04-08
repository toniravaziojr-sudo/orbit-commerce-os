// =============================================
// TIKTOK ADS PANEL
// Tabbed panel for TikTok Ads operations
// Shown inside TikTokUnifiedSettings when Ads is connected
// =============================================

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Megaphone, BarChart3, Layers, Film } from 'lucide-react';
import { TikTokAdsCampaignsTab } from './TikTokAdsCampaignsTab';
import { TikTokAdsInsightsTab } from './TikTokAdsInsightsTab';
import { TikTokAdsAdGroupsTab } from './TikTokAdsAdGroupsTab';
import { TikTokAdsAdsTab } from './TikTokAdsAdsTab';

export function TikTokAdsPanel() {
  return (
    <div className="pt-2">
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns" className="gap-1.5 text-xs">
            <Megaphone className="h-3.5 w-3.5" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="adgroups" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            Ad Groups
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1.5 text-xs">
            <Film className="h-3.5 w-3.5" />
            Anúncios
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <TikTokAdsCampaignsTab />
        </TabsContent>
        <TabsContent value="adgroups" className="mt-4">
          <TikTokAdsAdGroupsTab />
        </TabsContent>
        <TabsContent value="ads" className="mt-4">
          <TikTokAdsAdsTab />
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <TikTokAdsInsightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
