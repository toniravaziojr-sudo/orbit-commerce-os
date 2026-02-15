import { useState } from "react";
import { RefreshCw, Bot } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMetaAds } from "@/hooks/useMetaAds";
import { useTikTokAds } from "@/hooks/useTikTokAds";
import { useAdsAutopilot } from "@/hooks/useAdsAutopilot";
import { AdsGlobalConfig } from "@/components/ads/AdsGlobalConfig";
import { AdsCampaignsTab } from "@/components/ads/AdsCampaignsTab";
import { AdsActionsTab } from "@/components/ads/AdsActionsTab";
import { AdsReportsTab } from "@/components/ads/AdsReportsTab";

// ============ Channel Icons (inline SVGs for brand colors) ============
function MetaIcon({ className }: { className?: string }) {
  return <span className={className}>M</span>;
}
function GoogleIcon({ className }: { className?: string }) {
  return <span className={className}>G</span>;
}
function TikTokIcon({ className }: { className?: string }) {
  return <span className={className}>T</span>;
}

export default function AdsManager() {
  const meta = useMetaAds();
  const tiktok = useTikTokAds();
  const autopilot = useAdsAutopilot();

  const [activeChannel, setActiveChannel] = useState("meta");
  const [activeSubTab, setActiveSubTab] = useState("campaigns");

  const isSyncing = meta.syncAll.isPending || tiktok.syncAll.isPending;

  const handleSync = () => {
    if (activeChannel === "meta") meta.syncAll.mutate();
    else if (activeChannel === "tiktok") tiktok.syncAll.mutate();
  };

  const handleUpdateCampaign = (campaignId: string, status: string) => {
    if (activeChannel === "meta") {
      meta.updateCampaign.mutate({ meta_campaign_id: campaignId, status });
    } else if (activeChannel === "tiktok") {
      tiktok.updateCampaign.mutate({ tiktok_campaign_id: campaignId, status });
    }
  };

  // Get channel-specific data
  const getChannelData = () => {
    switch (activeChannel) {
      case "meta":
        return {
          campaigns: meta.campaigns,
          campaignsLoading: meta.campaignsLoading,
          insights: meta.insights,
          insightsLoading: meta.insightsLoading,
        };
      case "tiktok":
        return {
          campaigns: tiktok.campaigns,
          campaignsLoading: tiktok.campaignsLoading,
          insights: tiktok.insights,
          insightsLoading: tiktok.insightsLoading,
        };
      case "google":
        return {
          campaigns: [],
          campaignsLoading: false,
          insights: [],
          insightsLoading: false,
        };
      default:
        return { campaigns: [], campaignsLoading: false, insights: [], insightsLoading: false };
    }
  };

  const channelData = getChannelData();
  const channelConfig = autopilot.channelConfigs.find(c => c.channel === activeChannel) || null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gestor de Tráfego IA"
        description="Gerencie campanhas com IA autônoma em todos os canais"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        }
      />

      {/* Global Autopilot Config */}
      <AdsGlobalConfig
        globalConfig={autopilot.globalConfig}
        onSave={(config) => autopilot.saveConfig.mutate(config)}
        onToggle={(channel, enabled) => autopilot.toggleChannel.mutate({ channel, enabled })}
        onTriggerAnalysis={() => autopilot.triggerAnalysis.mutate()}
        isAnalyzing={autopilot.triggerAnalysis.isPending}
        isSaving={autopilot.saveConfig.isPending}
      />

      {/* Channel Tabs */}
      <Tabs value={activeChannel} onValueChange={setActiveChannel}>
        <TabsList>
          <TabsTrigger value="meta" className="gap-2">
            <MetaIcon className="text-xs font-bold" />
            Meta Ads
            {meta.campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {meta.campaigns.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <GoogleIcon className="text-xs font-bold" />
            Google Ads
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2">
            <TikTokIcon className="text-xs font-bold" />
            TikTok Ads
            {tiktok.campaigns.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {tiktok.campaigns.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Same sub-tabs for each channel */}
        {["meta", "google", "tiktok"].map(channel => (
          <TabsContent key={channel} value={channel} className="space-y-4">
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
                  channelConfig={channelConfig}
                  onToggleChannel={(ch, enabled) => autopilot.toggleChannel.mutate({ channel: ch, enabled })}
                  onUpdateCampaign={handleUpdateCampaign}
                  onSaveChannelConfig={(config) => autopilot.saveConfig.mutate(config)}
                  isSavingConfig={autopilot.saveConfig.isPending}
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
        ))}
      </Tabs>
    </div>
  );
}
