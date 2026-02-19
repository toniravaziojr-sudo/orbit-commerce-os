import { useState, useCallback, useEffect, useRef } from "react";
import { Bot, BarChart3, Settings2, Lightbulb, MessageCircle, Hourglass } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AdsChatTab } from "@/components/ads/AdsChatTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMetaAds } from "@/hooks/useMetaAds";
import { useTikTokAds } from "@/hooks/useTikTokAds";
import { useAdsAutopilot } from "@/hooks/useAdsAutopilot";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { useTikTokAdsConnection } from "@/hooks/useTikTokAdsConnection";
import { useAdsInsights } from "@/hooks/useAdsInsights";
import { useAdsAccountConfigs } from "@/hooks/useAdsAccountConfigs";
import { AdsAccountConfig } from "@/components/ads/AdsAccountConfig";
import { AdsChannelIntegrationAlert } from "@/components/ads/AdsChannelIntegrationAlert";
import { AdsCampaignsTab } from "@/components/ads/AdsCampaignsTab";
import { AdsActionsTab } from "@/components/ads/AdsActionsTab";
import { AdsReportsTab } from "@/components/ads/AdsReportsTab";
import { AdsRoiReportsTab } from "@/components/ads/AdsRoiReportsTab";
import { AdsOverviewTab } from "@/components/ads/AdsOverviewTab";
import { AdsInsightsTab } from "@/components/ads/AdsInsightsTab";
import { AdsGlobalSettingsTab } from "@/components/ads/AdsGlobalSettingsTab";
import { AdsPendingApprovalTab } from "@/components/ads/AdsPendingApprovalTab";

export default function AdsManager() {
  const meta = useMetaAds();
  const tiktok = useTikTokAds();
  const autopilot = useAdsAutopilot();
  const metaConn = useMetaConnection();
  const googleConn = useGoogleConnection();
  const tiktokConn = useTikTokAdsConnection();
  const adsInsights = useAdsInsights();
  const accountConfigs = useAdsAccountConfigs();

  const [activeMainTab, setActiveMainTab] = useState("overview");
  const [activeChannel, setActiveChannel] = useState("meta");
  const [activeSubTab, setActiveSubTab] = useState("campaigns");
  const [openAIConfigAccountId, setOpenAIConfigAccountId] = useState<string | null>(null);

  // Selected ad accounts per channel — persisted in localStorage
  const STORAGE_KEY = "ads-selected-accounts";
  
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const getAdAccountIds = useCallback((channel: string): string[] => {
    switch (channel) {
      case "meta": {
        const adAccounts = metaConn.status?.connection?.assets?.ad_accounts || [];
        return adAccounts.map((a: any) => a.id);
      }
      case "google": {
        const adAccounts = googleConn.status?.connection?.assets?.ad_accounts || [];
        return adAccounts.map((a: any) => a.id);
      }
      case "tiktok": {
        const advertiserIds = tiktokConn.connectionStatus?.assets?.advertiser_ids || [];
        return advertiserIds as string[];
      }
      default: return [];
    }
  }, [metaConn.status, googleConn.status, tiktokConn.connectionStatus]);

  const toggleAccount = useCallback((channel: string, accountId: string) => {
    setSelectedAccounts(prev => {
      const current = prev[channel] ?? getAdAccountIds(channel);
      const next = current.includes(accountId)
        ? current.filter(id => id !== accountId)
        : [...current, accountId];
      const updated = { ...prev, [channel]: next };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [getAdAccountIds]);

  // Auto-sync campaigns when a connected channel is viewed for the first time
  const syncedChannelsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (activeMainTab !== "manager") return;
    const integration = getChannelIntegration(activeChannel);
    if (!integration.isConnected || integration.isLoading) return;
    if (syncedChannelsRef.current.has(activeChannel)) return;
    
    syncedChannelsRef.current.add(activeChannel);
    
    if (activeChannel === "meta" && meta.campaigns.length === 0) {
      meta.syncCampaigns.mutate();
    } else if (activeChannel === "tiktok" && tiktok.campaigns.length === 0) {
      tiktok.syncCampaigns.mutate();
    }
  }, [activeMainTab, activeChannel, meta, tiktok]);

  const handleUpdateCampaign = (campaignId: string, status: string) => {
    if (activeChannel === "meta") {
      meta.updateCampaign.mutate({ meta_campaign_id: campaignId, status });
    } else if (activeChannel === "tiktok") {
      tiktok.updateCampaign.mutate({ tiktok_campaign_id: campaignId, status });
    }
  };

  const handleUpdateCampaignBudget = (campaignId: string, dailyBudgetCents: number) => {
    if (activeChannel === "meta") {
      meta.updateCampaign.mutate({ meta_campaign_id: campaignId, daily_budget_cents: dailyBudgetCents });
    }
  };

  const handleUpdateAdset = (adsetId: string, updates: { status?: string; daily_budget_cents?: number }) => {
    if (activeChannel === "meta") {
      meta.updateAdset.mutate({ meta_adset_id: adsetId, ...updates });
    }
  };

  const handleUpdateAd = (adId: string, updates: { status?: string }) => {
    if (activeChannel === "meta") {
      meta.updateAd.mutate({ meta_ad_id: adId, ...updates });
    }
  };

  const handleSyncCampaigns = useCallback(async () => {
    if (activeChannel === "meta") {
      try { await meta.syncCampaigns.mutateAsync(); } catch {}
      meta.syncInsights.mutate({});
      meta.syncAdsets.mutate({});
      meta.syncAds.mutate({});
      meta.refreshBalance();
    } else if (activeChannel === "tiktok") {
      try { await tiktok.syncCampaigns.mutateAsync(); } catch {}
      tiktok.syncInsights.mutate({});
    }
  }, [activeChannel, meta, tiktok]);

  const getChannelData = () => {
    switch (activeChannel) {
      case "meta":
        return {
          campaigns: meta.campaigns,
          campaignsLoading: meta.campaignsLoading || meta.syncCampaigns.isPending,
          insights: meta.insights,
          insightsLoading: meta.insightsLoading,
          adsets: meta.adsets,
          ads: meta.ads,
          accountBalances: meta.accountBalances,
        };
      case "tiktok":
        return {
          campaigns: tiktok.campaigns,
          campaignsLoading: tiktok.campaignsLoading || tiktok.syncCampaigns.isPending,
          insights: tiktok.insights,
          insightsLoading: tiktok.insightsLoading,
          adsets: [],
          ads: [],
          accountBalances: [],
        };
      default:
        return { campaigns: [], campaignsLoading: false, insights: [], insightsLoading: false, adsets: [], ads: [], accountBalances: [] };
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
  const globalConfig = autopilot.globalConfig;
  const openInsightsCount = adsInsights.insights.filter(i => i.status === "open").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gestor de Tráfego IA"
        description="Gerencie campanhas com IA autônoma em todos os canais"
      />

      {/* 3 Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-3.5 w-3.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="manager" className="gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            Gerenciador
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Lightbulb className="h-3.5 w-3.5" />
            Insights
            {openInsightsCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {openInsightsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="global-settings" className="gap-2">
            <Bot className="h-3.5 w-3.5" />
            Configurações Gerais
          </TabsTrigger>
          <TabsTrigger value="global-chat" className="gap-2">
            <MessageCircle className="h-3.5 w-3.5" />
            Chat IA
          </TabsTrigger>
        </TabsList>

        {/* === VISÃO GERAL === */}
        <TabsContent value="overview">
          <AdsOverviewTab
            metaInsights={meta.insights}
            tiktokInsights={tiktok.insights}
            metaCampaigns={meta.campaigns}
            tiktokCampaigns={tiktok.campaigns}
            globalBudgetCents={globalConfig?.total_budget_cents || globalConfig?.budget_cents || 0}
            globalBudgetMode={globalConfig?.total_budget_mode || globalConfig?.budget_mode || "monthly"}
            isLoading={meta.insightsLoading || tiktok.insightsLoading}
            trackingAlerts={[]}
          />
        </TabsContent>

        {/* === GERENCIADOR DE ANÚNCIOS === */}
        <TabsContent value="manager" className="space-y-4">
          <Tabs value={activeChannel} onValueChange={setActiveChannel}>
            <TabsList>
              <TabsTrigger value="meta" className="gap-2">
                <span className="text-xs font-bold">M</span>
                Meta Ads
                {getChannelIntegration("meta").adAccounts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {getChannelIntegration("meta").adAccounts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="google" className="gap-2">
                <span className="text-xs font-bold">G</span>
                Google Ads
                {getChannelIntegration("google").adAccounts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {getChannelIntegration("google").adAccounts.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tiktok" className="gap-2">
                <span className="text-xs font-bold">T</span>
                TikTok Ads
                {getChannelIntegration("tiktok").adAccounts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {getChannelIntegration("tiktok").adAccounts.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {["meta", "google", "tiktok"].map(channel => {
              const channelConfig = autopilot.channelConfigs.find(c => c.channel === channel) || null;
              const integration = getChannelIntegration(channel);
              const channelSelectedAccounts = selectedAccounts[channel] || integration.adAccounts.map(a => a.id);
              const aiEnabledAccounts = accountConfigs.getAIEnabledAccounts(channel);

              const handleToggleAI = (accountId: string, enabled: boolean) => {
                // useAdsAccountConfigs.toggleAI already triggers first_activation analysis
                // Do NOT fire a separate manual trigger here — it causes a race condition
                accountConfigs.toggleAI.mutate({ channel, ad_account_id: accountId, enabled });
              };

              const handleToggleKillSwitch = (accountId: string, enabled: boolean) => {
                accountConfigs.toggleKillSwitch.mutate({ channel, ad_account_id: accountId, enabled });
              };

              const handleOpenAIConfig = (accountId: string) => {
                setOpenAIConfigAccountId(prev => prev === accountId ? null : accountId);
              };

              return (
                <TabsContent key={channel} value={channel} className="space-y-4">
                  <AdsChannelIntegrationAlert
                    channel={channel}
                    isConnected={integration.isConnected}
                    isLoading={integration.isLoading}
                    adAccounts={integration.adAccounts}
                    selectedAccountIds={channelSelectedAccounts}
                    onToggleAccount={(accountId) => toggleAccount(channel, accountId)}
                    aiEnabledAccountIds={aiEnabledAccounts}
                    onOpenAIConfig={handleOpenAIConfig}
                  />

                  {openAIConfigAccountId && (
                    <AdsAccountConfig
                      channel={channel}
                      adAccounts={integration.adAccounts.filter(a => a.id === openAIConfigAccountId)}
                      getAccountConfig={accountConfigs.getAccountConfig}
                      aiEnabledAccountIds={aiEnabledAccounts}
                      onSave={(config) => accountConfigs.saveAccountConfig.mutate(config)}
                      isSaving={accountConfigs.saveAccountConfig.isPending}
                      onToggleAI={handleToggleAI}
                      onToggleKillSwitch={handleToggleKillSwitch}
                    />
                  )}

                  <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                    <TabsList>
                      <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
                      <TabsTrigger value="actions" className="gap-2">
                        <Bot className="h-3.5 w-3.5" />
                        Plano Estratégico
                        {autopilot.actions.filter(a => a.channel === channel).length > 0 && (
                          <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                            {autopilot.actions.filter(a => a.channel === channel).length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="pending-approval" className="gap-2">
                        <Hourglass className="h-3.5 w-3.5" />
                        Aguardando Ação
                        {autopilot.actions.filter(a => a.channel === channel && a.status === "pending_approval").length > 0 && (
                          <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-amber-500/20 text-amber-600">
                            {autopilot.actions.filter(a => a.channel === channel && a.status === "pending_approval").length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="reports">Relatórios</TabsTrigger>
                      <TabsTrigger value="roi">ROI Real</TabsTrigger>
                      <TabsTrigger value="account-chat" className="gap-2">
                        <MessageCircle className="h-3.5 w-3.5" />
                        Chat IA
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="campaigns">
                      <AdsCampaignsTab
                        campaigns={channelData.campaigns}
                        isLoading={channelData.campaignsLoading}
                        channel={channel}
                        onUpdateCampaign={handleUpdateCampaign}
                        onUpdateCampaignBudget={handleUpdateCampaignBudget}
                        onUpdateAdset={handleUpdateAdset}
                        onUpdateAd={handleUpdateAd}
                        selectedAccountIds={channelSelectedAccounts}
                        adAccounts={integration.adAccounts}
                        isConnected={integration.isConnected}
                        onSync={handleSyncCampaigns}
                        isSyncing={activeChannel === "meta" ? (meta.syncCampaigns.isPending || meta.syncInsights.isPending || meta.syncAdsets.isPending) : activeChannel === "tiktok" ? (tiktok.syncCampaigns.isPending || tiktok.syncInsights.isPending) : false}
                        insights={channelData.insights}
                        adsets={channelData.adsets}
                        ads={channelData.ads}
                        accountBalances={channelData.accountBalances}
                      />
                    </TabsContent>

                    <TabsContent value="actions">
                      <AdsActionsTab
                        actions={autopilot.actions}
                        isLoading={autopilot.actionsLoading}
                        channelFilter={channel}
                      />
                    </TabsContent>

                    <TabsContent value="pending-approval">
                      <AdsPendingApprovalTab channelFilter={channel} />
                    </TabsContent>

                    <TabsContent value="reports">
                      <AdsReportsTab
                        insights={channelData.insights}
                        actions={autopilot.actions}
                        channel={channel}
                        selectedAccountIds={channelSelectedAccounts}
                        adAccounts={integration.adAccounts}
                        campaigns={channelData.campaigns}
                      />
                    </TabsContent>

                    <TabsContent value="roi">
                      <AdsRoiReportsTab
                        insights={channelData.insights}
                        campaigns={channelData.campaigns}
                        selectedAccountIds={channelSelectedAccounts}
                        adAccounts={integration.adAccounts}
                      />
                    </TabsContent>

                    <TabsContent value="account-chat">
                      <AdsChatTab
                        scope="account"
                        adAccountId={channelSelectedAccounts[0] || integration.adAccounts[0]?.id}
                        channel={channel}
                      />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              );
            })}
          </Tabs>
        </TabsContent>

        {/* === INSIGHTS === */}
        <TabsContent value="insights">
          <AdsInsightsTab
            insights={adsInsights.insights}
            isLoading={adsInsights.isLoading}
            onMarkDone={adsInsights.markDone}
            onMarkIgnored={adsInsights.markIgnored}
            onGenerateNow={() => adsInsights.generateNow.mutate()}
            isGenerating={adsInsights.generateNow.isPending}
          />
        </TabsContent>

        {/* === CONFIGURAÇÕES GERAIS === */}
        <TabsContent value="global-settings" className="space-y-6">
          <AdsGlobalSettingsTab
            globalConfig={globalConfig}
            onSave={(config) => autopilot.saveConfig.mutate(config)}
            isSaving={autopilot.saveConfig.isPending}
            hasAccountOverrides={accountConfigs.configs.length > 0}
            isGlobalEnabled={globalConfig?.is_enabled || false}
            onToggleGlobal={(enabled) => autopilot.toggleChannel.mutate({ channel: "global", enabled })}
            isTogglingGlobal={autopilot.toggleChannel.isPending}
          />
          
          {/* Aguardando Aprovação (global - all channels) */}
          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-amber-500" />
                Aguardando Aprovação (Todas as contas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AdsPendingApprovalTab />
            </CardContent>
          </Card>
        </TabsContent>

        {/* === CHAT IA GLOBAL === */}
        <TabsContent value="global-chat">
          <AdsChatTab scope="global" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
