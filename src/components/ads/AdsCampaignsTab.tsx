import { useState, useMemo } from "react";
import {
  Play, Pause, RefreshCw, Loader2,
  ChevronDown, ChevronRight, ExternalLink, Wallet,
  ShoppingCart, MousePointerClick,
  Video, Target, Users, Eye, MessageCircle,
  Columns3, Check, Search, MoreHorizontal, Megaphone
} from "lucide-react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { subDays, parseISO, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdsAccountConfigs } from "@/hooks/useAdsAccountConfigs";

// ========== TYPES ==========

interface AdAccount {
  id: string;
  name: string;
}

interface AccountBalance {
  id: string;
  name: string;
  balance_cents: number;
  amount_spent_cents: number;
  currency: string;
  funding_source_type?: string;
}

interface AdSetData {
  id: string;
  meta_adset_id: string;
  meta_campaign_id: string;
  name: string;
  status: string;
  effective_status?: string;
  optimization_goal: string | null;
  daily_budget_cents: number | null;
  lifetime_budget_cents: number | null;
}

interface AdData {
  id: string;
  meta_ad_id: string;
  meta_adset_id: string;
  meta_campaign_id: string;
  name: string;
  status: string;
  effective_status?: string;
}

interface InsightData {
  meta_campaign_id?: string;
  tiktok_campaign_id?: string;
  date_start: string;
  date_stop: string;
  impressions: number;
  clicks: number;
  spend_cents: number;
  reach: number;
  conversions: number;
  conversion_value_cents: number;
  cost_per_conversion_cents?: number;
  roas: number;
  ctr: number;
  frequency: number;
  actions?: Record<string, any>[] | null;
}

interface AdsCampaignsTabProps {
  campaigns: any[];
  isLoading: boolean;
  channel: string;
  onUpdateCampaign: (id: string, status: string) => void;
  onUpdateCampaignBudget?: (id: string, dailyBudgetCents: number) => void;
  onUpdateAdset?: (id: string, updates: { status?: string; daily_budget_cents?: number }) => void;
  onUpdateAd?: (id: string, updates: { status?: string }) => void;
  selectedAccountIds?: string[];
  adAccounts?: AdAccount[];
  isConnected?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
  insights?: InsightData[];
  adsets?: AdSetData[];
  ads?: AdData[];
  accountBalances?: AccountBalance[];
}

// ========== UTILS ==========

// Meta funding_source_details.type: 1=credit card, 2=coupon, 4=bank, 12=paypal, 20=prepaid
function isCreditCardFunding(fundingType: string | number | undefined): boolean {
  return fundingType === 1 || fundingType === "1" || fundingType === "CREDIT_CARD";
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function getAccountId(campaign: any): string {
  return campaign.ad_account_id || campaign.advertiser_id || campaign.customer_id || "unknown";
}

/**
 * Returns a Tailwind color class for ROAS based on account goals.
 * 🔴 Critical: below min_roi_cold (or <1 if no config)
 * 🟡 Warning: between min_roi_cold and target_roi
 * 🟢 On target: at or above target_roi
 * 🔵 Exceeding: above target_roi * 1.5
 */
function getRoasColorClass(roas: number, targetRoi: number | null, minRoiCold: number | null): string {
  const target = targetRoi && targetRoi > 0 ? targetRoi : 2;
  const minCold = minRoiCold && minRoiCold > 0 ? minRoiCold : 1;

  if (roas >= target * 1.5) return "text-blue-600 font-medium";
  if (roas >= target) return "text-green-600 font-medium";
  if (roas >= minCold) return "text-yellow-600 font-medium";
  return "text-red-500 font-medium";
}

// ========== STATUS ==========

type StatusFilter = "all" | "active" | "paused" | "scheduled";

function isStatusActive(status: string, effectiveStatus?: string): boolean {
  const s = effectiveStatus || status;
  return s === "ACTIVE" || s === "ENABLE";
}

function isStatusPaused(status: string, effectiveStatus?: string): boolean {
  const s = effectiveStatus || status;
  return s === "PAUSED" || s === "DISABLE" || s === "ARCHIVED" || s === "CAMPAIGN_PAUSED" || s === "ADSET_PAUSED";
}

// A campaign is scheduled if status is ACTIVE but start_time is in the future
function isCampaignScheduled(campaign: any): boolean {
  if (!isStatusActive(campaign.status, campaign.effective_status)) return false;
  const startTime = campaign.start_time;
  if (!startTime) return false;
  try {
    return new Date(startTime) > new Date();
  } catch { return false; }
}

// A campaign is truly active if:
// 1. effective_status is ACTIVE
// 2. stop_time is NOT in the past (otherwise it's "Concluída")
// 3. NOT scheduled (start_time not in the future)
// 4. Has at least 1 active adset (or adsets not synced yet)
function isCampaignTrulyActive(campaign: any, adsets: AdSetData[]): boolean {
  if (!isStatusActive(campaign.status, campaign.effective_status)) return false;
  // Scheduled campaigns are not "active" yet
  if (isCampaignScheduled(campaign)) return false;
  // Check if campaign has ended (stop_time in the past)
  if (campaign.stop_time) {
    try {
      const stopDate = new Date(campaign.stop_time);
      if (stopDate < new Date()) return false; // Campaign completed
    } catch { /* ignore parse errors */ }
  }
  const campaignId = campaign.meta_campaign_id || campaign.google_campaign_id || campaign.tiktok_campaign_id;
  if (!campaignId) return true;
  const campaignAdsets = adsets.filter(a => a.meta_campaign_id === campaignId);
  if (campaignAdsets.length === 0) return true;
  return campaignAdsets.some(a => isStatusActive(a.status, a.effective_status));
}

// Check if a campaign is completed (had an end date that passed)
function isCampaignCompleted(campaign: any): boolean {
  if (!campaign.stop_time) return false;
  try {
    return new Date(campaign.stop_time) < new Date();
  } catch { return false; }
}

function matchesStatus(campaign: any, adsets: AdSetData[], filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "scheduled") return isCampaignScheduled(campaign);
  if (filter === "active") return isCampaignTrulyActive(campaign, adsets);
  // Paused = not truly active AND not scheduled
  return !isCampaignTrulyActive(campaign, adsets) && !isCampaignScheduled(campaign);
}

function StatusDot({ status, effectiveStatus, stopTime, startTime }: { status: string; effectiveStatus?: string; stopTime?: string | null; startTime?: string | null }) {
  const displayStatus = effectiveStatus || status;
  const isActive = displayStatus === "ACTIVE" || displayStatus === "ENABLE";
  const isPaused = displayStatus === "PAUSED" || displayStatus === "DISABLE" || displayStatus === "CAMPAIGN_PAUSED" || displayStatus === "ADSET_PAUSED";
  // Check if scheduled (start_time in the future)
  const isScheduled = isActive && startTime ? (() => { try { return new Date(startTime) > new Date(); } catch { return false; } })() : false;
  // Check if completed (end date passed)
  const isCompleted = isActive && !isScheduled && stopTime ? (() => { try { return new Date(stopTime) < new Date(); } catch { return false; } })() : false;
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "h-2 w-2 rounded-full flex-shrink-0",
        isCompleted ? "bg-muted-foreground/40" : isScheduled ? "bg-blue-500" : isActive ? "bg-green-500" : isPaused ? "bg-muted-foreground/40" : "bg-destructive/50"
      )} />
      <span className="text-xs text-muted-foreground">
        {isCompleted ? "Concluída" : isScheduled ? "Agendada" : isActive ? "Ativo" : isPaused ? "Pausada" : displayStatus}
      </span>
    </div>
  );
}

// ========== COLUMNS ==========

type MetricColumnKey =
  | "results" | "reach" | "frequency" | "cost_per_result" | "ctr"
  | "impressions" | "clicks" | "spend" | "budget" | "roas"
  | "conversions" | "conversion_value" | "cpc" | "cpm"
  | "link_clicks" | "landing_page_views" | "add_to_cart" | "initiate_checkout"
  | "add_payment_info" | "view_content" | "video_views" | "post_engagement"
  | "post_reactions" | "comments" | "shares" | "page_likes"
  | "cost_per_add_to_cart" | "cost_per_initiate_checkout" | "cost_per_landing_page_view";

interface MetricColumnDef {
  key: MetricColumnKey;
  label: string;
  shortLabel: string;
  group: string;
}

const ALL_METRIC_COLUMNS: MetricColumnDef[] = [
  // Desempenho
  { key: "results", label: "Resultados", shortLabel: "Resultados", group: "Desempenho" },
  { key: "reach", label: "Alcance", shortLabel: "Alcance", group: "Desempenho" },
  { key: "impressions", label: "Impressões", shortLabel: "Impressões", group: "Desempenho" },
  { key: "frequency", label: "Frequência", shortLabel: "Frequência", group: "Desempenho" },
  { key: "link_clicks", label: "Cliques no link", shortLabel: "Cliques link", group: "Desempenho" },
  { key: "clicks", label: "Todos os cliques", shortLabel: "Cliques", group: "Desempenho" },
  { key: "ctr", label: "CTR (taxa de cliques)", shortLabel: "CTR", group: "Desempenho" },
  { key: "landing_page_views", label: "Visualiz. pág. destino", shortLabel: "LP views", group: "Desempenho" },
  // Custo
  { key: "cost_per_result", label: "Custo por resultado", shortLabel: "Custo/resultado", group: "Custo" },
  { key: "cpc", label: "CPC (custo por clique)", shortLabel: "CPC", group: "Custo" },
  { key: "cpm", label: "CPM (custo por mil)", shortLabel: "CPM", group: "Custo" },
  { key: "spend", label: "Valor usado", shortLabel: "Valor usado", group: "Custo" },
  { key: "budget", label: "Orçamento", shortLabel: "Orçamento", group: "Custo" },
  { key: "cost_per_add_to_cart", label: "Custo por carrinho", shortLabel: "Custo/carrinho", group: "Custo" },
  { key: "cost_per_initiate_checkout", label: "Custo por checkout", shortLabel: "Custo/checkout", group: "Custo" },
  { key: "cost_per_landing_page_view", label: "Custo por LP view", shortLabel: "Custo/LP", group: "Custo" },
  // Conversão
  { key: "roas", label: "ROAS (retorno)", shortLabel: "ROAS", group: "Conversão" },
  { key: "conversions", label: "Compras no site", shortLabel: "Compras", group: "Conversão" },
  { key: "conversion_value", label: "Valor de conversão", shortLabel: "Valor conv.", group: "Conversão" },
  { key: "add_to_cart", label: "Adições ao carrinho", shortLabel: "Carrinhos", group: "Conversão" },
  { key: "initiate_checkout", label: "Checkouts iniciados", shortLabel: "Checkouts", group: "Conversão" },
  { key: "add_payment_info", label: "Info. pagamento", shortLabel: "Pgto info", group: "Conversão" },
  { key: "view_content", label: "Visualiz. conteúdo", shortLabel: "View content", group: "Conversão" },
  // Engajamento
  { key: "video_views", label: "Visualiz. de vídeo", shortLabel: "Video views", group: "Engajamento" },
  { key: "post_engagement", label: "Engajamento publicação", shortLabel: "Engajamento", group: "Engajamento" },
  { key: "post_reactions", label: "Reações", shortLabel: "Reações", group: "Engajamento" },
  { key: "comments", label: "Comentários", shortLabel: "Comentários", group: "Engajamento" },
  { key: "shares", label: "Compartilhamentos", shortLabel: "Compartilh.", group: "Engajamento" },
  { key: "page_likes", label: "Curtidas na página", shortLabel: "Page likes", group: "Engajamento" },
];

const DEFAULT_COLUMNS: MetricColumnKey[] = [
  "results", "reach", "frequency", "cost_per_result", "budget", "spend", "roas",
];

const MAX_COLUMNS = 7;

function getObjectiveMetric(objective: string | null): { label: string; key: string; icon: any } {
  const o = objective?.toUpperCase() || "";
  if (o.includes("SALES") || o.includes("CONVERSIONS") || o.includes("OUTCOME_SALES")) return { label: "Compras", key: "conversions", icon: ShoppingCart };
  if (o.includes("TRAFFIC") || o.includes("LINK_CLICKS")) return { label: "Cliques link", key: "link_clicks", icon: MousePointerClick };
  if (o.includes("AWARENESS") || o.includes("REACH") || o.includes("BRAND")) return { label: "Alcance", key: "reach", icon: Eye };
  if (o.includes("ENGAGEMENT") || o.includes("POST_ENGAGEMENT")) return { label: "Engajamento", key: "post_engagement", icon: MessageCircle };
  if (o.includes("VIDEO") || o.includes("VIDEO_VIEWS")) return { label: "Views", key: "video_views", icon: Video };
  if (o.includes("LEAD") || o.includes("LEAD_GENERATION")) return { label: "Leads", key: "conversions", icon: Users };
  if (o.includes("APP")) return { label: "Instalações", key: "conversions", icon: Target };
  return { label: "Resultados", key: "conversions", icon: ShoppingCart };
}

function getChannelManagerUrl(channel: string): string {
  switch (channel) {
    case "meta": return "https://adsmanager.facebook.com";
    case "google": return "https://ads.google.com";
    case "tiktok": return "https://ads.tiktok.com";
    default: return "#";
  }
}

function getChannelBalanceUrl(channel: string): string {
  switch (channel) {
    case "meta": return "https://business.facebook.com/billing_hub/payment_activity";
    case "google": return "https://ads.google.com/aw/billing/summary";
    case "tiktok": return "https://ads.tiktok.com/i18n/account/payment";
    default: return "#";
  }
}

function getChannelLabel(channel: string): string {
  switch (channel) {
    case "meta": return "Meta";
    case "google": return "Google";
    case "tiktok": return "TikTok";
    default: return channel;
  }
}

// DATE_PRESETS removed — using DateRangeFilter component

// ========== COLUMN SELECTOR ==========

function ColumnSelector({ selected, onChange }: { selected: MetricColumnKey[]; onChange: (cols: MetricColumnKey[]) => void }) {
  const groups = useMemo(() => {
    const g = new Map<string, MetricColumnDef[]>();
    for (const col of ALL_METRIC_COLUMNS) {
      const list = g.get(col.group) || [];
      list.push(col);
      g.set(col.group, list);
    }
    return g;
  }, []);

  const toggle = (key: MetricColumnKey) => {
    if (selected.includes(key)) onChange(selected.filter(k => k !== key));
    else if (selected.length < MAX_COLUMNS) onChange([...selected, key]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 font-normal">
          <Columns3 className="h-3.5 w-3.5" />
          Colunas: Personalizado
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="end">
        <div className="p-2.5 border-b">
          <p className="text-xs font-medium text-muted-foreground">Até {MAX_COLUMNS} métricas</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {Array.from(groups.entries()).map(([groupName, cols]) => (
            <div key={groupName}>
              <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{groupName}</div>
              {cols.map(col => {
                const isSelected = selected.includes(col.key);
                const isDisabled = !isSelected && selected.length >= MAX_COLUMNS;
                return (
                  <button
                    key={col.key}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-sm transition-colors",
                      isSelected ? "bg-primary/10 text-primary font-medium" : isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"
                    )}
                    onClick={() => !isDisabled && toggle(col.key)}
                    disabled={isDisabled}
                  >
                    <div className={cn(
                      "h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0",
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </div>
                    {col.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ========== MAIN COMPONENT ==========

export function AdsCampaignsTab({
  campaigns, isLoading, channel, onUpdateCampaign, onUpdateCampaignBudget,
  onUpdateAdset, onUpdateAd, selectedAccountIds, adAccounts, isConnected, onSync, isSyncing,
  insights = [], adsets = [], ads = [], accountBalances = [],
}: AdsCampaignsTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [visibleColumns, setVisibleColumns] = useState<MetricColumnKey[]>(DEFAULT_COLUMNS);
  const { configs: accountConfigs } = useAdsAccountConfigs();

  // Helper to get ROAS goals for a campaign's account
  const getAccountGoals = (campaign: any) => {
    const accountId = getAccountId(campaign);
    const config = accountConfigs.find(c => c.channel === channel && c.ad_account_id === accountId);
    return { targetRoi: config?.target_roi ?? null, minRoiCold: config?.min_roi_cold ?? null };
  };

  // Aggregate goals for totals row (use first selected account or average)
  const aggregateGoals = useMemo(() => {
    const relevantConfigs = accountConfigs.filter(c => c.channel === channel && 
      (!selectedAccountIds?.length || selectedAccountIds.includes(c.ad_account_id)));
    if (relevantConfigs.length === 0) return { targetRoi: null as number | null, minRoiCold: null as number | null };
    const avgTarget = relevantConfigs.reduce((s, c) => s + (c.target_roi || 0), 0) / relevantConfigs.length;
    const avgMinCold = relevantConfigs.reduce((s, c) => s + (c.min_roi_cold || 0), 0) / relevantConfigs.length;
    return { targetRoi: avgTarget || null, minRoiCold: avgMinCold || null };
  }, [accountConfigs, channel, selectedAccountIds]);

  // ===== CRITICAL FIX: Build set of campaign IDs belonging to selected accounts =====
  const selectedAccountSet = useMemo(
    () => new Set(selectedAccountIds || []),
    [selectedAccountIds]
  );

  // Filter campaigns by selected accounts
  const accountFiltered = useMemo(() => {
    if (!selectedAccountIds || selectedAccountIds.length === 0) return campaigns;
    return campaigns.filter(c => selectedAccountSet.has(getAccountId(c)));
  }, [campaigns, selectedAccountIds, selectedAccountSet]);

  // Build campaign-to-account mapping for insight filtering
  const campaignAccountMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaigns) {
      const cid = c.meta_campaign_id || c.google_campaign_id || c.tiktok_campaign_id;
      if (cid) map.set(cid, getAccountId(c));
    }
    return map;
  }, [campaigns]);

   // Filter campaigns by search + status
  const filteredCampaigns = useMemo(() => {
    return accountFiltered.filter(c => {
      if (!matchesStatus(c, adsets, statusFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!c.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [accountFiltered, statusFilter, searchQuery, adsets]);

  // Count by status
  const scheduledCount = accountFiltered.filter(c => isCampaignScheduled(c)).length;
  const activeCount = accountFiltered.filter(c => isCampaignTrulyActive(c, adsets)).length;
  const pausedCount = accountFiltered.filter(c => !isCampaignTrulyActive(c, adsets) && !isCampaignScheduled(c)).length;

  // ===== Filter insights by selected accounts + date range =====
  const campaignInsights = useMemo(() => {
    const map = new Map<string, {
      impressions: number; clicks: number; spend_cents: number; reach: number;
      conversions: number; conversion_value_cents: number; roas: number; ctr: number;
      frequency: number; cost_per_result_cents: number; cpc_cents: number; cpm_cents: number;
      // Action-based metrics
      link_clicks: number; landing_page_views: number; add_to_cart: number;
      initiate_checkout: number; add_payment_info: number; view_content: number;
      video_views: number; post_engagement: number; post_reactions: number;
      comments: number; shares: number; page_likes: number;
      // Cost per action
      cost_per_add_to_cart_cents: number; cost_per_initiate_checkout_cents: number;
      cost_per_landing_page_view_cents: number;
    }>();

    const extractAction = (actions: any[] | null | undefined, ...types: string[]): number => {
      if (!actions || !Array.isArray(actions)) return 0;
      for (const t of types) {
        const found = actions.find((a: any) => a.action_type === t);
        if (found) return parseInt(found.value) || 0;
      }
      return 0;
    };

    for (const i of insights) {
      const campaignId = i.meta_campaign_id || i.tiktok_campaign_id || "";

      // Filter by selected accounts
      if (selectedAccountIds && selectedAccountIds.length > 0) {
        const accountId = campaignAccountMap.get(campaignId);
        if (!accountId || !selectedAccountSet.has(accountId)) continue;
      }

      // Filter by date range
      if (dateFrom && dateTo) {
        try {
          const dStart = parseISO(i.date_start);
          const dStop = parseISO(i.date_stop);
          const rangeFrom = startOfDay(dateFrom);
          const rangeTo = endOfDay(dateTo);
          if (dStop < rangeFrom || dStart > rangeTo) continue;
        } catch { continue; }
      }

      const acts = (i as any).actions;

      const existing = map.get(campaignId) || {
        impressions: 0, clicks: 0, spend_cents: 0, reach: 0,
        conversions: 0, conversion_value_cents: 0, roas: 0, ctr: 0,
        frequency: 0, cost_per_result_cents: 0, cpc_cents: 0, cpm_cents: 0,
        link_clicks: 0, landing_page_views: 0, add_to_cart: 0,
        initiate_checkout: 0, add_payment_info: 0, view_content: 0,
        video_views: 0, post_engagement: 0, post_reactions: 0,
        comments: 0, shares: 0, page_likes: 0,
        cost_per_add_to_cart_cents: 0, cost_per_initiate_checkout_cents: 0,
        cost_per_landing_page_view_cents: 0,
      };
      existing.impressions += i.impressions || 0;
      existing.clicks += i.clicks || 0;
      existing.spend_cents += i.spend_cents || 0;
      existing.reach += i.reach || 0;
      existing.conversions += i.conversions || 0;
      existing.conversion_value_cents += i.conversion_value_cents || 0;
      // Extract from actions JSONB
      existing.link_clicks += extractAction(acts, "link_click");
      existing.landing_page_views += extractAction(acts, "landing_page_view", "omni_landing_page_view");
      existing.add_to_cart += extractAction(acts, "add_to_cart", "omni_add_to_cart");
      existing.initiate_checkout += extractAction(acts, "initiate_checkout", "omni_initiated_checkout");
      existing.add_payment_info += extractAction(acts, "add_payment_info");
      existing.view_content += extractAction(acts, "view_content", "omni_view_content");
      existing.video_views += extractAction(acts, "video_view");
      existing.post_engagement += extractAction(acts, "post_engagement", "page_engagement");
      existing.post_reactions += extractAction(acts, "post_reaction");
      existing.comments += extractAction(acts, "comment");
      existing.shares += extractAction(acts, "post");
      existing.page_likes += extractAction(acts, "like");
      map.set(campaignId, existing);
    }

    // Calculate derived metrics
    for (const [, val] of map.entries()) {
      val.ctr = val.impressions > 0 ? (val.clicks / val.impressions) * 100 : 0;
      val.roas = val.spend_cents > 0 ? val.conversion_value_cents / val.spend_cents : 0;
      val.frequency = val.reach > 0 ? val.impressions / val.reach : 0;
      val.cost_per_result_cents = val.conversions > 0 ? Math.round(val.spend_cents / val.conversions) : 0;
      val.cpc_cents = val.clicks > 0 ? Math.round(val.spend_cents / val.clicks) : 0;
      val.cpm_cents = val.impressions > 0 ? Math.round((val.spend_cents / val.impressions) * 1000) : 0;
      val.cost_per_add_to_cart_cents = val.add_to_cart > 0 ? Math.round(val.spend_cents / val.add_to_cart) : 0;
      val.cost_per_initiate_checkout_cents = val.initiate_checkout > 0 ? Math.round(val.spend_cents / val.initiate_checkout) : 0;
      val.cost_per_landing_page_view_cents = val.landing_page_views > 0 ? Math.round(val.spend_cents / val.landing_page_views) : 0;
    }

    return map;
  }, [insights, dateFrom, dateTo, selectedAccountIds, campaignAccountMap, selectedAccountSet]);

  // Ad sets grouped by campaign
  const campaignAdsets = useMemo(() => {
    const map = new Map<string, AdSetData[]>();
    for (const as of adsets) {
      const list = map.get(as.meta_campaign_id) || [];
      list.push(as);
      map.set(as.meta_campaign_id, list);
    }
    return map;
  }, [adsets]);

  // Ads grouped by adset
  const adsetAds = useMemo(() => {
    const map = new Map<string, AdData[]>();
    for (const ad of ads) {
      const list = map.get(ad.meta_adset_id) || [];
      list.push(ad);
      map.set(ad.meta_adset_id, list);
    }
    return map;
  }, [ads]);

  // ===== CRITICAL FIX: Balance filtered by selected accounts =====
  const filteredBalances = useMemo(() => {
    if (!selectedAccountIds || selectedAccountIds.length === 0) return accountBalances;
    return accountBalances.filter(b => selectedAccountSet.has(b.id));
  }, [accountBalances, selectedAccountIds, selectedAccountSet]);

   // Only sum prepaid accounts for total balance (exclude credit card)
  const totalBalance = filteredBalances
    .filter(a => !isCreditCardFunding(a.funding_source_type))
    .reduce((sum, a) => sum + a.balance_cents, 0);
  const totalSpent = filteredBalances.reduce((sum, a) => sum + a.amount_spent_cents, 0);
  const allCreditCard = filteredBalances.length > 0 && filteredBalances.every(b => isCreditCardFunding(b.funding_source_type));
  const hasLowBalance = !allCreditCard && totalBalance > 0 && totalBalance < 5000; // < R$50

  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());

  const toggleExpand = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  const toggleAdsetExpand = (adsetId: string) => {
    setExpandedAdsets(prev => {
      const next = new Set(prev);
      if (next.has(adsetId)) next.delete(adsetId);
      else next.add(adsetId);
      return next;
    });
  };

  const handleToggleStatus = (campaignId: string, currentStatus: string) => {
    setUpdatingId(campaignId);
    const newStatus = (currentStatus === "ACTIVE" || currentStatus === "ENABLE") ? "PAUSED" : "ACTIVE";
    onUpdateCampaign(campaignId, newStatus);
    setTimeout(() => setUpdatingId(null), 3000);
  };

  const handleSaveBudget = (campaignId: string) => {
    const cents = Math.round(parseFloat(budgetValue) * 100);
    if (!isNaN(cents) && cents > 0 && onUpdateCampaignBudget) {
      onUpdateCampaignBudget(campaignId, cents);
    }
    setEditingBudget(null);
    setBudgetValue("");
  };

  const handleAdsetToggleStatus = (adsetId: string, currentStatus: string) => {
    if (!onUpdateAdset) return;
    const newStatus = (currentStatus === "ACTIVE" || currentStatus === "ENABLE") ? "PAUSED" : "ACTIVE";
    onUpdateAdset(adsetId, { status: newStatus });
  };

  const handleAdToggleStatus = (adId: string, currentStatus: string) => {
    if (!onUpdateAd) return;
    const newStatus = (currentStatus === "ACTIVE" || currentStatus === "ENABLE") ? "PAUSED" : "ACTIVE";
    onUpdateAd(adId, { status: newStatus });
  };

  // ========== METRIC CELL RENDERER ==========
  const renderMetricCell = (colKey: MetricColumnKey, campaign: any, metrics: any | undefined) => {
    const objective = campaign.objective || campaign.advertising_channel_type || campaign.objective_type || null;
    const metricInfo = getObjectiveMetric(objective);
    const isSalesCampaign = objective?.toUpperCase()?.includes("SALES") || objective?.toUpperCase()?.includes("CONVERSIONS") || objective?.toUpperCase()?.includes("OUTCOME_SALES");
    const campaignId = campaign.meta_campaign_id || campaign.google_campaign_id || campaign.tiktok_campaign_id;
    const budget = campaign.daily_budget_cents || campaign.budget_cents || 0;

    switch (colKey) {
      case "results": {
        if (!metrics) return <span className="text-muted-foreground">—</span>;
        const value = (metrics as any)[metricInfo.key];
        return typeof value === "number" && value > 0 ? formatNumber(value) : <span className="text-muted-foreground">—</span>;
      }
      case "reach":
        return metrics?.reach > 0 ? formatNumber(metrics.reach) : <span className="text-muted-foreground">—</span>;
      case "frequency":
        return metrics?.frequency > 0 ? metrics.frequency.toFixed(2) : <span className="text-muted-foreground">—</span>;
      case "impressions":
        return metrics?.impressions > 0 ? formatNumber(metrics.impressions) : <span className="text-muted-foreground">—</span>;
      case "clicks":
        return metrics?.clicks > 0 ? formatNumber(metrics.clicks) : <span className="text-muted-foreground">—</span>;
      case "ctr":
        return metrics?.ctr > 0 ? `${metrics.ctr.toFixed(2)}%` : <span className="text-muted-foreground">—</span>;
      case "cost_per_result": {
        if (!metrics) return <span className="text-muted-foreground">—</span>;
        if (isSalesCampaign) return metrics.conversions > 0 ? formatCurrency(metrics.cost_per_result_cents) : <span className="text-muted-foreground">—</span>;
        const resultValue = (metrics as any)[metricInfo.key] as number;
        if (resultValue > 0 && metrics.spend_cents > 0) return formatCurrency(Math.round(metrics.spend_cents / resultValue));
        return <span className="text-muted-foreground">—</span>;
      }
      case "cpc":
        return metrics?.cpc_cents > 0 ? formatCurrency(metrics.cpc_cents) : <span className="text-muted-foreground">—</span>;
      case "cpm":
        return metrics?.cpm_cents > 0 ? formatCurrency(metrics.cpm_cents) : <span className="text-muted-foreground">—</span>;
      case "spend":
        return metrics?.spend_cents > 0 ? formatCurrency(metrics.spend_cents) : <span className="text-muted-foreground">—</span>;
      case "budget":
        return editingBudget === campaignId ? (
          <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <Input type="number" value={budgetValue} onChange={e => setBudgetValue(e.target.value)}
              className="w-20 h-6 text-xs" placeholder="R$" autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleSaveBudget(campaignId); if (e.key === "Escape") setEditingBudget(null); }}
            />
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => handleSaveBudget(campaignId)}>OK</Button>
          </div>
        ) : (
          <span
            className={cn(onUpdateCampaignBudget && "cursor-pointer hover:underline")}
            onClick={onUpdateCampaignBudget ? (e) => { e.stopPropagation(); setEditingBudget(campaignId); setBudgetValue(budget ? (budget / 100).toString() : ""); } : undefined}
          >
            {budget ? formatCurrency(budget) : <span className="text-muted-foreground">—</span>}
          </span>
        );
      case "roas": {
        if (isSalesCampaign && metrics?.roas > 0) {
          const goals = getAccountGoals(campaign);
          return <span className={getRoasColorClass(metrics.roas, goals.targetRoi, goals.minRoiCold)}>{metrics.roas.toFixed(2)}x</span>;
        }
        return <span className="text-muted-foreground">—</span>;
      }
      case "conversions":
        return metrics?.conversions > 0 ? formatNumber(metrics.conversions) : <span className="text-muted-foreground">—</span>;
      case "conversion_value":
        return metrics?.conversion_value_cents > 0 ? formatCurrency(metrics.conversion_value_cents) : <span className="text-muted-foreground">—</span>;
      // Action-based metrics
      case "link_clicks":
        return metrics?.link_clicks > 0 ? formatNumber(metrics.link_clicks) : <span className="text-muted-foreground">—</span>;
      case "landing_page_views":
        return metrics?.landing_page_views > 0 ? formatNumber(metrics.landing_page_views) : <span className="text-muted-foreground">—</span>;
      case "add_to_cart":
        return metrics?.add_to_cart > 0 ? formatNumber(metrics.add_to_cart) : <span className="text-muted-foreground">—</span>;
      case "initiate_checkout":
        return metrics?.initiate_checkout > 0 ? formatNumber(metrics.initiate_checkout) : <span className="text-muted-foreground">—</span>;
      case "add_payment_info":
        return metrics?.add_payment_info > 0 ? formatNumber(metrics.add_payment_info) : <span className="text-muted-foreground">—</span>;
      case "view_content":
        return metrics?.view_content > 0 ? formatNumber(metrics.view_content) : <span className="text-muted-foreground">—</span>;
      case "video_views":
        return metrics?.video_views > 0 ? formatNumber(metrics.video_views) : <span className="text-muted-foreground">—</span>;
      case "post_engagement":
        return metrics?.post_engagement > 0 ? formatNumber(metrics.post_engagement) : <span className="text-muted-foreground">—</span>;
      case "post_reactions":
        return metrics?.post_reactions > 0 ? formatNumber(metrics.post_reactions) : <span className="text-muted-foreground">—</span>;
      case "comments":
        return metrics?.comments > 0 ? formatNumber(metrics.comments) : <span className="text-muted-foreground">—</span>;
      case "shares":
        return metrics?.shares > 0 ? formatNumber(metrics.shares) : <span className="text-muted-foreground">—</span>;
      case "page_likes":
        return metrics?.page_likes > 0 ? formatNumber(metrics.page_likes) : <span className="text-muted-foreground">—</span>;
      // Cost per action
      case "cost_per_add_to_cart":
        return metrics?.cost_per_add_to_cart_cents > 0 ? formatCurrency(metrics.cost_per_add_to_cart_cents) : <span className="text-muted-foreground">—</span>;
      case "cost_per_initiate_checkout":
        return metrics?.cost_per_initiate_checkout_cents > 0 ? formatCurrency(metrics.cost_per_initiate_checkout_cents) : <span className="text-muted-foreground">—</span>;
      case "cost_per_landing_page_view":
        return metrics?.cost_per_landing_page_view_cents > 0 ? formatCurrency(metrics.cost_per_landing_page_view_cents) : <span className="text-muted-foreground">—</span>;
      default:
        return <span className="text-muted-foreground">—</span>;
    }
  };

  const hasAnyCampaigns = accountFiltered.length > 0;

  // ===== TOTALS for footer row =====
  const columnTotals = useMemo(() => {
    const t = {
      impressions: 0, clicks: 0, spend_cents: 0, reach: 0,
      conversions: 0, conversion_value_cents: 0, roas: 0, ctr: 0,
      frequency: 0, cost_per_result_cents: 0, cpc_cents: 0, cpm_cents: 0,
      link_clicks: 0, landing_page_views: 0, add_to_cart: 0,
      initiate_checkout: 0, add_payment_info: 0, view_content: 0,
      video_views: 0, post_engagement: 0, post_reactions: 0,
      comments: 0, shares: 0, page_likes: 0,
      cost_per_add_to_cart_cents: 0, cost_per_initiate_checkout_cents: 0,
      cost_per_landing_page_view_cents: 0,
      budget_cents: 0,
    };
    for (const c of filteredCampaigns) {
      const cid = c.meta_campaign_id || c.google_campaign_id || c.tiktok_campaign_id;
      const m = campaignInsights.get(cid);
      t.budget_cents += c.daily_budget_cents || c.budget_cents || 0;
      if (m) {
        t.impressions += m.impressions;
        t.clicks += m.clicks;
        t.spend_cents += m.spend_cents;
        t.reach += m.reach;
        t.conversions += m.conversions;
        t.conversion_value_cents += m.conversion_value_cents;
        t.link_clicks += m.link_clicks;
        t.landing_page_views += m.landing_page_views;
        t.add_to_cart += m.add_to_cart;
        t.initiate_checkout += m.initiate_checkout;
        t.add_payment_info += m.add_payment_info;
        t.view_content += m.view_content;
        t.video_views += m.video_views;
        t.post_engagement += m.post_engagement;
        t.post_reactions += m.post_reactions;
        t.comments += m.comments;
        t.shares += m.shares;
        t.page_likes += m.page_likes;
      }
    }
    // Derived
    t.ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
    t.roas = t.spend_cents > 0 ? t.conversion_value_cents / t.spend_cents : 0;
    t.frequency = t.reach > 0 ? t.impressions / t.reach : 0;
    t.cost_per_result_cents = t.conversions > 0 ? Math.round(t.spend_cents / t.conversions) : 0;
    t.cpc_cents = t.clicks > 0 ? Math.round(t.spend_cents / t.clicks) : 0;
    t.cpm_cents = t.impressions > 0 ? Math.round((t.spend_cents / t.impressions) * 1000) : 0;
    t.cost_per_add_to_cart_cents = t.add_to_cart > 0 ? Math.round(t.spend_cents / t.add_to_cart) : 0;
    t.cost_per_initiate_checkout_cents = t.initiate_checkout > 0 ? Math.round(t.spend_cents / t.initiate_checkout) : 0;
    t.cost_per_landing_page_view_cents = t.landing_page_views > 0 ? Math.round(t.spend_cents / t.landing_page_views) : 0;
    return t;
  }, [filteredCampaigns, campaignInsights]);

  // Render a total cell for a given column
  const renderTotalCell = (colKey: MetricColumnKey) => {
    const t = columnTotals;
    switch (colKey) {
      case "results": return t.conversions > 0 ? formatNumber(t.conversions) : "—";
      case "reach": return t.reach > 0 ? formatNumber(t.reach) : "—";
      case "frequency": return t.frequency > 0 ? t.frequency.toFixed(2) : "—";
      case "impressions": return t.impressions > 0 ? formatNumber(t.impressions) : "—";
      case "clicks": return t.clicks > 0 ? formatNumber(t.clicks) : "—";
      case "ctr": return t.ctr > 0 ? `${t.ctr.toFixed(2)}%` : "—";
      case "cost_per_result": return t.cost_per_result_cents > 0 ? formatCurrency(t.cost_per_result_cents) : "—";
      case "cpc": return t.cpc_cents > 0 ? formatCurrency(t.cpc_cents) : "—";
      case "cpm": return t.cpm_cents > 0 ? formatCurrency(t.cpm_cents) : "—";
      case "spend": return t.spend_cents > 0 ? formatCurrency(t.spend_cents) : "—";
      case "budget": return t.budget_cents > 0 ? formatCurrency(t.budget_cents) : "—";
      case "roas": return t.roas > 0 ? <span className={getRoasColorClass(t.roas, aggregateGoals.targetRoi, aggregateGoals.minRoiCold)}>{t.roas.toFixed(2)}x</span> : "—";
      case "conversions": return t.conversions > 0 ? formatNumber(t.conversions) : "—";
      case "conversion_value": return t.conversion_value_cents > 0 ? formatCurrency(t.conversion_value_cents) : "—";
      case "link_clicks": return t.link_clicks > 0 ? formatNumber(t.link_clicks) : "—";
      case "landing_page_views": return t.landing_page_views > 0 ? formatNumber(t.landing_page_views) : "—";
      case "add_to_cart": return t.add_to_cart > 0 ? formatNumber(t.add_to_cart) : "—";
      case "initiate_checkout": return t.initiate_checkout > 0 ? formatNumber(t.initiate_checkout) : "—";
      case "add_payment_info": return t.add_payment_info > 0 ? formatNumber(t.add_payment_info) : "—";
      case "view_content": return t.view_content > 0 ? formatNumber(t.view_content) : "—";
      case "video_views": return t.video_views > 0 ? formatNumber(t.video_views) : "—";
      case "post_engagement": return t.post_engagement > 0 ? formatNumber(t.post_engagement) : "—";
      case "post_reactions": return t.post_reactions > 0 ? formatNumber(t.post_reactions) : "—";
      case "comments": return t.comments > 0 ? formatNumber(t.comments) : "—";
      case "shares": return t.shares > 0 ? formatNumber(t.shares) : "—";
      case "page_likes": return t.page_likes > 0 ? formatNumber(t.page_likes) : "—";
      case "cost_per_add_to_cart": return t.cost_per_add_to_cart_cents > 0 ? formatCurrency(t.cost_per_add_to_cart_cents) : "—";
      case "cost_per_initiate_checkout": return t.cost_per_initiate_checkout_cents > 0 ? formatCurrency(t.cost_per_initiate_checkout_cents) : "—";
      case "cost_per_landing_page_view": return t.cost_per_landing_page_view_cents > 0 ? formatCurrency(t.cost_per_landing_page_view_cents) : "—";
      default: return "—";
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const totalPages = Math.ceil(filteredCampaigns.length / pageSize);
  const paginatedCampaigns = filteredCampaigns.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filteredCampaigns.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(currentPage * pageSize, filteredCampaigns.length);

  return (
    <div className="space-y-0">
      {isLoading ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : selectedAccountIds && selectedAccountIds.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhuma conta selecionada" description="Selecione ao menos uma conta de anúncio acima para ver as campanhas" />
      ) : !hasAnyCampaigns ? (
        <EmptyState
          icon={Megaphone}
          title={isConnected ? "Nenhuma campanha sincronizada" : "Nenhuma campanha"}
          description={isConnected ? "Clique em Atualizar para importar as campanhas" : "Conecte sua conta para começar"}
          action={isConnected && onSync ? { label: isSyncing ? "Atualizando..." : "Atualizar campanhas", onClick: onSync } : undefined}
        />
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          {/* ===== FACEBOOK-STYLE TOP BAR ===== */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              {/* Status filter tabs */}
              <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
                {([
                  { value: "all" as StatusFilter, label: "Todas", count: accountFiltered.length },
                  { value: "active" as StatusFilter, label: "Ativas", count: activeCount },
                  { value: "scheduled" as StatusFilter, label: "Agendadas", count: scheduledCount },
                  { value: "paused" as StatusFilter, label: "Pausadas", count: pausedCount },
                ] as const).map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-all font-medium",
                      statusFilter === tab.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      "ml-1 text-[10px] tabular-nums",
                      statusFilter === tab.value ? "text-primary" : "text-muted-foreground/60"
                    )}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Date picker - standard DateRangeFilter */}
              <DateRangeFilter
                startDate={dateFrom}
                endDate={dateTo}
                onChange={(start, end) => { setDateFrom(start); setDateTo(end); }}
                label="Período"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Pagination info */}
              {filteredCampaigns.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{rangeStart}-{rangeEnd} de {filteredCampaigns.length}</span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                        <ChevronDown className="h-3 w-3 rotate-90" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                        <ChevronDown className="h-3 w-3 -rotate-90" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <ColumnSelector selected={visibleColumns} onChange={setVisibleColumns} />

              {isConnected && onSync && (
                <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing} className="gap-1.5 text-xs h-7 font-normal">
                  {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Atualizar
                </Button>
              )}
            </div>
          </div>

          {/* ===== SECONDARY BAR: search + balance + external link ===== */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/15">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar campanha..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="h-7 w-56 pl-7 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {filteredBalances.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn(
                      "gap-1.5 text-xs h-7 font-normal",
                      hasLowBalance && "text-destructive hover:text-destructive"
                    )}>
                      <Wallet className="h-3 w-3" />
                      {allCreditCard
                        ? "Cartão de crédito"
                        : `Saldo: ${formatCurrency(totalBalance)}`}
                      {hasLowBalance && <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-0">
                    <div className="p-3 border-b">
                      <h4 className="text-xs font-semibold text-foreground">Resumo Financeiro</h4>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Total investido</span>
                          <span className="font-medium">{formatCurrency(totalSpent)}</span>
                        </div>
                        {!allCreditCard && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Saldo restante</span>
                            <span className={cn("font-medium", hasLowBalance && "text-destructive")}>{formatCurrency(totalBalance)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                      {filteredBalances.map(acc => {
                        const isCC = isCreditCardFunding(acc.funding_source_type);
                        const lowBal = !isCC && acc.balance_cents > 0 && acc.balance_cents < 5000;
                        return (
                          <div key={acc.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground truncate max-w-[140px]" title={acc.name}>{acc.name}</span>
                            {isCC ? (
                              <Badge variant="outline" className="text-[10px] h-5">Cartão</Badge>
                            ) : (
                              <span className={cn("font-medium", lowBal && "text-destructive")}>
                                {formatCurrency(acc.balance_cents)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {hasLowBalance && (
                      <div className="p-3 border-t bg-destructive/5">
                        <p className="text-[10px] text-destructive font-medium">⚠️ Saldo baixo! Faça uma recarga para evitar pausas automáticas nas campanhas.</p>
                      </div>
                    )}
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full text-xs h-7 gap-1.5"
                        onClick={() => window.open(getChannelBalanceUrl(channel), "_blank")}
                      >
                        Ver na plataforma
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 font-normal"
                onClick={() => {
                  // Deep link: open the top-spending campaign or selected account in the native ads manager
                  if (channel === "meta") {
                    // Find campaign with highest spend
                    let topCampaign: any = null;
                    let topSpend = 0;
                    for (const c of accountFiltered) {
                      const cid = c.meta_campaign_id;
                      const m = campaignInsights.get(cid);
                      if (m && m.spend_cents > topSpend) {
                        topSpend = m.spend_cents;
                        topCampaign = c;
                      }
                    }
                    if (topCampaign) {
                      const actId = topCampaign.ad_account_id?.replace("act_", "") || "";
                      window.open(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId}&selected_campaign_ids=${topCampaign.meta_campaign_id}`, "_blank");
                    } else if (selectedAccountIds && selectedAccountIds.length === 1) {
                      // Fallback: open the single selected account
                      const actId = selectedAccountIds[0].replace("act_", "");
                      window.open(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId}`, "_blank");
                    } else if (selectedAccountIds && selectedAccountIds.length > 0) {
                      // Fallback: open first selected account
                      const actId = selectedAccountIds[0].replace("act_", "");
                      window.open(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId}`, "_blank");
                    } else {
                      window.open(getChannelManagerUrl(channel), "_blank");
                    }
                  } else {
                    window.open(getChannelManagerUrl(channel), "_blank");
                  }
                }}
              >
                Abrir {getChannelLabel(channel)} Ads
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60" />
              </Button>
            </div>
          </div>

          {/* ===== TABLE ===== */}
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhuma campanha {statusFilter === "active" ? "ativa" : statusFilter === "paused" ? "pausada" : statusFilter === "scheduled" ? "agendada" : ""} encontrada
              {searchQuery && ` para "${searchQuery}"`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="w-8 px-2"></TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground min-w-[280px]">
                      Campanha ↕
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground w-20">
                      Veiculação ↕
                    </TableHead>
                    {visibleColumns.map(colKey => {
                      const def = ALL_METRIC_COLUMNS.find(c => c.key === colKey);
                      return (
                        <TableHead key={colKey} className="text-xs font-semibold text-muted-foreground text-right whitespace-nowrap">
                          {def?.shortLabel || colKey} ↕
                        </TableHead>
                      );
                    })}
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCampaigns.map(c => {
                    const effectiveStatus = c.effective_status || c.status;
                    const status = c.status;
                    const campaignId = c.meta_campaign_id || c.google_campaign_id || c.tiktok_campaign_id;
                    const isUpdating = updatingId === campaignId;
                    const isExpanded = expandedCampaigns.has(campaignId);
                    const campaignAdsetList = campaignAdsets.get(campaignId) || [];
                    const hasAdsets = channel === "meta" && campaignAdsetList.length > 0;
                    const metrics = campaignInsights.get(campaignId);

                    return (
                      <span key={c.id} className="contents">
                        <TableRow
                          className={cn(
                            "group text-xs",
                            hasAdsets && "cursor-pointer",
                            isExpanded && "bg-muted/30"
                          )}
                          onClick={hasAdsets ? () => toggleExpand(campaignId) : undefined}
                        >
                          {/* Expand toggle */}
                          <TableCell className="px-2 w-8">
                            {hasAdsets && (
                              isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </TableCell>

                          {/* Campaign name */}
                          <TableCell className="font-medium min-w-[280px] py-3">
                            <span className="truncate block max-w-[350px] text-primary hover:underline cursor-pointer text-xs">
                              {c.name}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="w-20">
                            <StatusDot status={status} effectiveStatus={effectiveStatus} stopTime={c.stop_time} startTime={c.start_time} />
                          </TableCell>

                          {/* Metrics */}
                          {visibleColumns.map(colKey => (
                            <TableCell key={colKey} className="text-right tabular-nums text-xs py-3">
                              {renderMetricCell(colKey, c, metrics)}
                            </TableCell>
                          ))}

                          {/* Actions */}
                          <TableCell className="w-10 text-right" onClick={e => e.stopPropagation()}>
                            {isUpdating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground inline" />
                            ) : (effectiveStatus === "ACTIVE" || effectiveStatus === "ENABLE") ? (
                              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleToggleStatus(campaignId, status)} title="Pausar">
                                <Pause className="h-3 w-3" />
                              </Button>
                            ) : (effectiveStatus === "PAUSED" || effectiveStatus === "DISABLE" || effectiveStatus === "CAMPAIGN_PAUSED") ? (
                              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleToggleStatus(campaignId, status)} title="Ativar">
                                <Play className="h-3 w-3" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>

                        {/* Expanded ad sets */}
                        {isExpanded && campaignAdsetList.map(as => {
                          const adsetAdList = adsetAds.get(as.meta_adset_id) || [];
                          const hasAds = adsetAdList.length > 0;
                          const isAdsetExpanded = expandedAdsets.has(as.meta_adset_id);
                          return (
                            <span key={as.id} className="contents">
                              <TableRow className="bg-muted/20 text-xs group/adset cursor-pointer" onClick={() => hasAds && toggleAdsetExpand(as.meta_adset_id)}>
                                <TableCell className="px-2 w-8">
                                  {hasAds && (
                                    isAdsetExpanded
                                      ? <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
                                      : <ChevronRight className="h-3 w-3 text-muted-foreground ml-1" />
                                  )}
                                </TableCell>
                                <TableCell className="pl-6 py-2">
                                  <span className="text-muted-foreground mr-1.5">↳</span>
                                  <span className="text-muted-foreground">{as.name}</span>
                                </TableCell>
                                <TableCell><StatusDot status={as.status} effectiveStatus={(as as any).effective_status} /></TableCell>
                                {visibleColumns.map((colKey, idx) => (
                                  <TableCell key={colKey} className="text-right tabular-nums text-xs">
                                    {idx === 0 ? (
                                      <span className="text-muted-foreground text-[10px]">
                                        {as.optimization_goal?.replace(/_/g, " ").toLowerCase() || "—"}
                                      </span>
                                    ) : colKey === "budget" ? (
                                      as.daily_budget_cents ? formatCurrency(as.daily_budget_cents) : <span className="text-muted-foreground">—</span>
                                    ) : ""}
                                  </TableCell>
                                ))}
                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                  {onUpdateAdset && (
                                    (as.status === "ACTIVE" || as.status === "ENABLE") ? (
                                      <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover/adset:opacity-100 transition-opacity" onClick={() => handleAdsetToggleStatus(as.meta_adset_id, as.status)}>
                                        <Pause className="h-2.5 w-2.5" />
                                      </Button>
                                    ) : (as.status === "PAUSED" || as.status === "DISABLE") ? (
                                      <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover/adset:opacity-100 transition-opacity" onClick={() => handleAdsetToggleStatus(as.meta_adset_id, as.status)}>
                                        <Play className="h-2.5 w-2.5" />
                                      </Button>
                                    ) : null
                                  )}
                                </TableCell>
                              </TableRow>

                              {/* Expanded ads under ad set */}
                              {isAdsetExpanded && adsetAdList.map(ad => (
                                <TableRow key={ad.id} className="bg-muted/10 text-xs group/ad">
                                  <TableCell className="px-2"></TableCell>
                                  <TableCell className="pl-12 py-1.5">
                                    <span className="text-muted-foreground/60 mr-1.5">↳</span>
                                    <span className="text-muted-foreground/80 text-[11px]">{ad.name}</span>
                                  </TableCell>
                                  <TableCell><StatusDot status={ad.status} effectiveStatus={(ad as any).effective_status} /></TableCell>
                                  {visibleColumns.map(colKey => (
                                    <TableCell key={colKey} className="text-right tabular-nums text-xs">
                                      {""}
                                    </TableCell>
                                  ))}
                                  <TableCell className="text-right">
                                    {onUpdateAd && (
                                      (ad.status === "ACTIVE" || ad.status === "ENABLE") ? (
                                        <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover/ad:opacity-100 transition-opacity" onClick={() => handleAdToggleStatus(ad.meta_ad_id, ad.status)}>
                                          <Pause className="h-2.5 w-2.5" />
                                        </Button>
                                      ) : (ad.status === "PAUSED" || ad.status === "DISABLE") ? (
                                        <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover/ad:opacity-100 transition-opacity" onClick={() => handleAdToggleStatus(ad.meta_ad_id, ad.status)}>
                                          <Play className="h-2.5 w-2.5" />
                                        </Button>
                                      ) : null
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </span>
                          );
                        })}
                      </span>
                    );
                  })}
                </TableBody>
                {filteredCampaigns.length > 0 && (
                  <TableFooter>
                    <TableRow className="bg-muted/40 font-medium text-xs">
                      <TableCell className="px-2"></TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-muted-foreground">
                          Resultados de {filteredCampaigns.length} campanha{filteredCampaigns.length !== 1 ? "s" : ""}
                        </span>
                      </TableCell>
                      <TableCell></TableCell>
                      {visibleColumns.map(colKey => (
                        <TableCell key={colKey} className="text-right tabular-nums text-xs font-semibold py-2.5">
                          {renderTotalCell(colKey)}
                          <div className="text-[9px] font-normal text-muted-foreground mt-0.5">
                            {colKey === "spend" ? "Total usado" : colKey === "budget" ? "Total" : colKey === "impressions" ? "Total" : colKey === "cpm" ? "Por 1.000 impressões" : colKey === "results" || colKey === "reach" || colKey === "clicks" || colKey === "conversions" || colKey === "link_clicks" || colKey === "landing_page_views" || colKey === "add_to_cart" || colKey === "initiate_checkout" ? "Total" : ""}
                          </div>
                        </TableCell>
                      ))}
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
