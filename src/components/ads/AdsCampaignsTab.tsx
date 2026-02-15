import { useState, useMemo } from "react";
import {
  Play, Pause, RefreshCw, Loader2,
  ChevronDown, ChevronRight, ExternalLink, Wallet,
  CalendarDays, ShoppingCart, MousePointerClick,
  Video, Target, Users, Eye, MessageCircle,
  Columns3, Check, Search, MoreHorizontal, Megaphone
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

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

// ========== STATUS ==========

type StatusFilter = "all" | "active" | "paused";

function isStatusActive(status: string, effectiveStatus?: string): boolean {
  const s = effectiveStatus || status;
  return s === "ACTIVE" || s === "ENABLE";
}

function isStatusPaused(status: string, effectiveStatus?: string): boolean {
  const s = effectiveStatus || status;
  return s === "PAUSED" || s === "DISABLE" || s === "ARCHIVED" || s === "CAMPAIGN_PAUSED" || s === "ADSET_PAUSED";
}

// A campaign is truly active if effective_status is ACTIVE.
// If adsets are synced, also require at least 1 active adset.
// If adsets are NOT synced for this campaign, trust the campaign effective_status alone.
function isCampaignTrulyActive(campaign: any, adsets: AdSetData[]): boolean {
  if (!isStatusActive(campaign.status, campaign.effective_status)) return false;
  const campaignId = campaign.meta_campaign_id || campaign.google_campaign_id || campaign.tiktok_campaign_id;
  if (!campaignId) return true; // no ID means we can't check adsets, trust campaign status
  const campaignAdsets = adsets.filter(a => a.meta_campaign_id === campaignId);
  // If no adsets synced yet for this campaign, trust campaign effective_status
  if (campaignAdsets.length === 0) return true;
  return campaignAdsets.some(a => isStatusActive(a.status, a.effective_status));
}

function matchesStatus(campaign: any, adsets: AdSetData[], filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return isCampaignTrulyActive(campaign, adsets);
  // Paused = not truly active (campaign paused OR no active adsets)
  return !isCampaignTrulyActive(campaign, adsets);
}

function StatusDot({ status, effectiveStatus }: { status: string; effectiveStatus?: string }) {
  const displayStatus = effectiveStatus || status;
  const isActive = displayStatus === "ACTIVE" || displayStatus === "ENABLE";
  const isPaused = displayStatus === "PAUSED" || displayStatus === "DISABLE" || displayStatus === "CAMPAIGN_PAUSED" || displayStatus === "ADSET_PAUSED";
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "h-2 w-2 rounded-full flex-shrink-0",
        isActive ? "bg-green-500" : isPaused ? "bg-muted-foreground/40" : "bg-destructive/50"
      )} />
      <span className="text-xs text-muted-foreground">
        {isActive ? "Ativo" : isPaused ? "Pausada" : displayStatus}
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

const DATE_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

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
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [visibleColumns, setVisibleColumns] = useState<MetricColumnKey[]>(DEFAULT_COLUMNS);

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

  // Count by status: truly active = campaign ACTIVE + has active adset
  const activeCount = accountFiltered.filter(c => isCampaignTrulyActive(c, adsets)).length;
  const pausedCount = accountFiltered.filter(c => !isCampaignTrulyActive(c, adsets)).length;

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
      if (dateRange?.from && dateRange?.to) {
        try {
          const dStart = parseISO(i.date_start);
          const dStop = parseISO(i.date_stop);
          const rangeFrom = startOfDay(dateRange.from);
          const rangeTo = endOfDay(dateRange.to);
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
  }, [insights, dateRange, selectedAccountIds, campaignAccountMap, selectedAccountSet]);

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

  const totalBalance = filteredBalances.reduce((sum, a) => sum + a.balance_cents, 0);

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
      case "roas":
        if (isSalesCampaign && metrics?.roas > 0) {
          return <span className={metrics.roas >= 1 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>{metrics.roas.toFixed(2)}x</span>;
        }
        return <span className="text-muted-foreground">—</span>;
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

              {/* Date picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 font-normal border-dashed">
                    <CalendarDays className="h-3 w-3" />
                    {dateRange?.from ? (
                      dateRange.to
                        ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`
                        : format(dateRange.from, "dd/MM/yyyy")
                    ) : "Período"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-1 p-2 border-b">
                    {DATE_PRESETS.map(preset => (
                      <Button key={preset.days} variant="ghost" size="sm" className="text-xs h-6 px-2"
                        onClick={() => { setDateRange({ from: preset.days === 0 ? new Date() : subDays(new Date(), preset.days), to: new Date() }); }}
                      >{preset.label}</Button>
                    ))}
                  </div>
                  <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
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
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 font-normal"
                  onClick={() => window.open(getChannelBalanceUrl(channel), "_blank")}
                >
                  <Wallet className="h-3 w-3" />
                  {filteredBalances.some(b => b.funding_source_type === "CREDIT_CARD")
                    ? "Cartão de crédito"
                    : `Saldo: ${formatCurrency(totalBalance)}`}
                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60" />
                </Button>
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
              Nenhuma campanha {statusFilter === "active" ? "ativa" : statusFilter === "paused" ? "pausada" : ""} encontrada
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
                            <StatusDot status={status} effectiveStatus={effectiveStatus} />
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
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
