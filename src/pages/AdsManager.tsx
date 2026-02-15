import { useState } from "react";
import { Bot } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useMetaAds } from "@/hooks/useMetaAds";
import { useTikTokAds } from "@/hooks/useTikTokAds";
import { useAdsAutopilot } from "@/hooks/useAdsAutopilot";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { useTikTokAdsConnection } from "@/hooks/useTikTokAdsConnection";
import { AdsGlobalConfig } from "@/components/ads/AdsGlobalConfig";
import { AdsChannelRoasConfig } from "@/components/ads/AdsChannelRoasConfig";
import { AdsChannelIntegrationAlert } from "@/components/ads/AdsChannelIntegrationAlert";
import { AdsCampaignsTab } from "@/components/ads/AdsCampaignsTab";
import { AdsActionsTab } from "@/components/ads/AdsActionsTab";
import { AdsReportsTab } from "@/components/ads/AdsReportsTab";

export default function AdsManager() {
  const meta = useMetaAds();
  const tiktok = useTikTokAds();
  const autopilot = useAdsAutopilot();
  const metaConn = useMetaConnection();
  const googleConn = useGoogleConnection();
  const tiktokConn = useTikTokAdsConnection();

  const [activeChannel, setActiveChannel] = useState("meta");
  const [activeSubTab, setActiveSubTab] = useState("campaigns");

  const handleUpdateCampaign = (campaignId: string, status: string) => {
    if (activeChannel === "meta") {
      meta.updateCampaign.mutate({ meta_campaign_id: campaignId, status });
    } else if (activeChannel === "tiktok") {
      tiktok.updateCampaign.mutate({ tiktok_campaign_id: campaignId, status });
    }
  };

  const getChannelData = () => {
    switch (activeChannel) {
      case "meta":
        return { campaigns: meta.campaigns, campaignsLoading: meta.campaignsLoading, insights: meta.insights, insightsLoading: meta.insightsLoading };
      case "tiktok":
        return { campaigns: tiktok.campaigns, campaignsLoading: tiktok.campaignsLoading, insights: tiktok.insights, insightsLoading: tiktok.insightsLoading };
      default:
        return { campaigns: [], campaignsLoading: false, insights: [], insightsLoading: false };
    }
  };

  const getChannelIntegration = (channel: string) => {
    switch (channel) {
      case "meta": {
        const status = metaConn.status;
        const adAccounts = status?.connection?.assets?.ad_accounts || [];
        return {
          isConnected: status?.isConnected || false,
          isLoading: metaConn.isLoading,
          adAccounts: adAccounts.map((a: any) => ({ id: a.id, name: a.name })),
        };
      }
      case "google": {
        const status = googleConn.status;
        const adAccounts = status?.connection?.assets?.ad_accounts || [];
        return {
          isConnected: status?.isConnected || false,
          isLoading: googleConn.isLoading,
          adAccounts: adAccounts.map((a: any) => ({ id: a.id, name: a.name })),
        };
      }
      case "tiktok": {
        const status = tiktokConn.connectionStatus;
        const advertiserIds = status?.assets?.advertiser_ids || [];
        return {
          isConnected: status?.isConnected || false,
          isLoading: tiktokConn.isLoading,
          adAccounts: advertiserIds.map((id: string) => ({ id, name: status?.advertiserName || id })),
        };
      }
      default:
        return { isConnected: false, isLoading: false, adAccounts: [] };
    }
  };

  const channelData = getChannelData();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gestor de Tráfego IA"
        description="Gerencie campanhas com IA autônoma em todos os canais"
      />

      {/* Global Config (budget + ROI ideal + instructions) */}
      <AdsGlobalConfig
        globalConfig={autopilot.globalConfig}
        onSave={(config) => autopilot.saveConfig.mutate(config)}
        isSaving={autopilot.saveConfig.isPending}
      />

      {/* Channel Tabs */}
      <Tabs value={activeChannel} onValueChange={setActiveChannel}>
        <TabsList>
          <TabsTrigger value="meta" className="gap-2">
            <span className="text-xs font-bold">M</span>
            Meta Ads
            {meta.campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {meta.campaigns.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <span className="text-xs font-bold">G</span>
            Google Ads
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2">
            <span className="text-xs font-bold">T</span>
            TikTok Ads
            {tiktok.campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {tiktok.campaigns.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {["meta", "google", "tiktok"].map(channel => {
          const channelConfig = autopilot.channelConfigs.find(c => c.channel === channel) || null;
          const integration = getChannelIntegration(channel);

          return (
            <TabsContent key={channel} value={channel} className="space-y-4">
              {/* Integration Status Alert */}
              <AdsChannelIntegrationAlert
                channel={channel}
                isConnected={integration.isConnected}
                isLoading={integration.isLoading}
                adAccounts={integration.adAccounts}
              />

              {/* Per-channel AI activation + ROI config */}
              <AdsChannelRoasConfig
                channel={channel}
                channelConfig={channelConfig}
                onSave={(config) => autopilot.saveConfig.mutate(config)}
                onToggleChannel={(ch, enabled) => autopilot.toggleChannel.mutate({ channel: ch, enabled })}
                isSaving={autopilot.saveConfig.isPending}
              />

              {/* Sub-tabs */}
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <TabsList>
                  <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
                  <TabsTrigger value="actions" className="gap-2">
                    <Bot className="h-3.5 w-3.5" />
                    Ações da IA
                    {autopilot.actions.filter(a => a.channel === channel).length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                        {autopilot.actions.filter(a => a.channel === channel).length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="reports">Relatórios</TabsTrigger>
                </TabsList>

                <TabsContent value="campaigns">
                  <AdsCampaignsTab
                    campaigns={channelData.campaigns}
                    isLoading={channelData.campaignsLoading}
                    channel={channel}
                    onUpdateCampaign={handleUpdateCampaign}
                  />
                </TabsContent>

                <TabsContent value="actions">
                  <AdsActionsTab
                    actions={autopilot.actions}
                    isLoading={autopilot.actionsLoading}
                    channelFilter={channel}
                  />
                </TabsContent>

                <TabsContent value="reports">
                  <AdsReportsTab
                    insights={channelData.insights}
                    actions={autopilot.actions}
                    channel={channel}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
