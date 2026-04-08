// =============================================
// TIKTOK ADS PANEL
// Tabbed panel for TikTok Ads operations
// Shown inside TikTokUnifiedSettings when Ads is connected
// =============================================

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Megaphone, BarChart3, Layers, Film, Users, ImageIcon } from 'lucide-react';
import { TikTokAdsCampaignsTab } from './TikTokAdsCampaignsTab';
import { TikTokAdsInsightsTab } from './TikTokAdsInsightsTab';
import { TikTokAdsAdGroupsTab } from './TikTokAdsAdGroupsTab';
import { TikTokAdsAdsTab } from './TikTokAdsAdsTab';
import { TikTokAdsAudiencesTab } from './TikTokAdsAudiencesTab';
import { TikTokAdsAssetsTab } from './TikTokAdsAssetsTab';

export function TikTokAdsPanel() {
  return (
    <div className="pt-2">
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="campaigns" className="gap-1 text-[10px]">
            <Megaphone className="h-3 w-3" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="adgroups" className="gap-1 text-[10px]">
            <Layers className="h-3 w-3" />
            Ad Groups
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-1 text-[10px]">
            <Film className="h-3 w-3" />
            Anúncios
          </TabsTrigger>
          <TabsTrigger value="audiences" className="gap-1 text-[10px]">
            <Users className="h-3 w-3" />
            Públicos
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1 text-[10px]">
            <ImageIcon className="h-3 w-3" />
            Criativos
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1 text-[10px]">
            <BarChart3 className="h-3 w-3" />
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
        <TabsContent value="audiences" className="mt-4">
          <TikTokAdsAudiencesTab />
        </TabsContent>
        <TabsContent value="assets" className="mt-4">
          <TikTokAdsAssetsTab />
        </TabsContent>
        <TabsContent value="insights" className="mt-4">
          <TikTokAdsInsightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
