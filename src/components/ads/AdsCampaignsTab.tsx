import { useState, useMemo } from "react";
import {
  Play, Pause, Megaphone, RefreshCw, Loader2, Filter,
  ChevronDown, ChevronRight, ExternalLink, Wallet, DollarSign,
  CalendarDays, TrendingUp, Eye, MousePointerClick, ShoppingCart,
  MessageCircle, Video, Target, Users, BarChart3
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

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
}

interface AdSetData {
  id: string;
  meta_adset_id: string;
  meta_campaign_id: string;
  name: string;
  status: string;
  optimization_goal: string | null;
  daily_budget_cents: number | null;
  lifetime_budget_cents: number | null;
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
  roas: number;
  ctr: number;
  frequency: number;
}

interface AdsCampaignsTabProps {
  campaigns: any[];
  isLoading: boolean;
  channel: string;
  onUpdateCampaign: (id: string, status: string) => void;
  onUpdateCampaignBudget?: (id: string, dailyBudgetCents: number) => void;
  onUpdateAdset?: (id: string, updates: { status?: string; daily_budget_cents?: number }) => void;
  selectedAccountIds?: string[];
  adAccounts?: AdAccount[];
  isConnected?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
  insights?: InsightData[];
  adsets?: AdSetData[];
  accountBalances?: AccountBalance[];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ACTIVE: { label: "Ativa", variant: "default" },
    PAUSED: { label: "Pausada", variant: "secondary" },
    ARCHIVED: { label: "Arquivada", variant: "outline" },
    DELETED: { label: "Deletada", variant: "destructive" },
    ENABLE: { label: "Ativa", variant: "default" },
    DISABLE: { label: "Inativa", variant: "secondary" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function getAccountId(campaign: any): string {
  return campaign.ad_account_id || campaign.advertiser_id || campaign.customer_id || "unknown";
}

type StatusFilter = "all" | "active" | "paused";

function matchesStatusFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return status === "ACTIVE" || status === "ENABLE";
  if (filter === "paused") return status === "PAUSED" || status === "DISABLE" || status === "ARCHIVED";
  return true;
}

// Map objective to the most relevant metric label
function getObjectiveMetric(objective: string | null): { label: string; key: string; icon: any } {
  const o = objective?.toUpperCase() || "";
  if (o.includes("SALES") || o.includes("CONVERSIONS") || o.includes("OUTCOME_SALES")) {
    return { label: "Compras", key: "conversions", icon: ShoppingCart };
  }
  if (o.includes("TRAFFIC") || o.includes("LINK_CLICKS")) {
    return { label: "Cliques", key: "clicks", icon: MousePointerClick };
  }
  if (o.includes("AWARENESS") || o.includes("REACH") || o.includes("BRAND")) {
    return { label: "Alcance", key: "reach", icon: Eye };
  }
  if (o.includes("ENGAGEMENT") || o.includes("POST_ENGAGEMENT")) {
    return { label: "Engajamento", key: "clicks", icon: MessageCircle };
  }
  if (o.includes("VIDEO") || o.includes("VIDEO_VIEWS")) {
    return { label: "Views", key: "impressions", icon: Video };
  }
  if (o.includes("LEAD") || o.includes("LEAD_GENERATION")) {
    return { label: "Leads", key: "conversions", icon: Users };
  }
  if (o.includes("APP")) {
    return { label: "Instalações", key: "conversions", icon: Target };
  }
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

export function AdsCampaignsTab({
  campaigns, isLoading, channel, onUpdateCampaign, onUpdateCampaignBudget,
  onUpdateAdset, selectedAccountIds, adAccounts, isConnected, onSync, isSyncing,
  insights = [], adsets = [], accountBalances = [],
}: AdsCampaignsTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Filter campaigns by selected accounts
  const accountFiltered = selectedAccountIds && selectedAccountIds.length > 0
    ? campaigns.filter(c => selectedAccountIds.includes(getAccountId(c)))
    : campaigns;

  // Apply status filter
  const filteredCampaigns = accountFiltered.filter(c => matchesStatusFilter(c.status, statusFilter));

  // Count by status for badges
  const activeCount = accountFiltered.filter(c => c.status === "ACTIVE" || c.status === "ENABLE").length;
  const pausedCount = accountFiltered.filter(c => c.status === "PAUSED" || c.status === "DISABLE" || c.status === "ARCHIVED").length;

  // Aggregate insights per campaign, filtered by date range
  const campaignInsights = useMemo(() => {
    const map = new Map<string, {
      impressions: number; clicks: number; spend_cents: number; reach: number;
      conversions: number; conversion_value_cents: number; roas: number; ctr: number;
      frequency: number; cost_per_result_cents: number;
    }>();
    
    for (const i of insights) {
      if (dateRange?.from && dateRange?.to) {
        try {
          const d = parseISO(i.date_start);
          if (!isWithinInterval(d, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) continue;
        } catch { continue; }
      }

      const campaignId = i.meta_campaign_id || i.tiktok_campaign_id || "";
      const existing = map.get(campaignId) || {
        impressions: 0, clicks: 0, spend_cents: 0, reach: 0,
        conversions: 0, conversion_value_cents: 0, roas: 0, ctr: 0,
        frequency: 0, cost_per_result_cents: 0,
      };
      existing.impressions += i.impressions || 0;
      existing.clicks += i.clicks || 0;
      existing.spend_cents += i.spend_cents || 0;
      existing.reach += i.reach || 0;
      existing.conversions += i.conversions || 0;
      existing.conversion_value_cents += i.conversion_value_cents || 0;
      // Frequency is averaged, not summed - we'll recalculate
      map.set(campaignId, existing);
    }

    // Calculate derived metrics
    for (const [, val] of map.entries()) {
      val.ctr = val.impressions > 0 ? (val.clicks / val.impressions) * 100 : 0;
      val.roas = val.spend_cents > 0 ? val.conversion_value_cents / val.spend_cents : 0;
      val.frequency = val.reach > 0 ? val.impressions / val.reach : 0;
      val.cost_per_result_cents = val.conversions > 0 ? Math.round(val.spend_cents / val.conversions) : 0;
    }

    return map;
  }, [insights, dateRange]);

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

  // Total balance
  const totalBalance = accountBalances.reduce((sum, a) => sum + a.balance_cents, 0);

  const toggleExpand = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
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

  const renderCampaignRow = (c: any) => {
    const name = c.name;
    const status = c.status;
    const objective = c.objective || c.advertising_channel_type || c.objective_type || null;
    const budget = c.daily_budget_cents || c.budget_cents || 0;
    const campaignId = c.meta_campaign_id || c.google_campaign_id || c.tiktok_campaign_id;
    const isUpdating = updatingId === campaignId;
    const isExpanded = expandedCampaigns.has(campaignId);
    const campaignAdsetList = campaignAdsets.get(campaignId) || [];
    const hasAdsets = channel === "meta" && campaignAdsetList.length > 0;
    const metrics = campaignInsights.get(campaignId);
    const metricInfo = getObjectiveMetric(objective);
    const isSalesCampaign = objective?.toUpperCase()?.includes("SALES") || objective?.toUpperCase()?.includes("CONVERSIONS") || objective?.toUpperCase()?.includes("OUTCOME_SALES");

    // Get result count based on objective
    const getResultCount = () => {
      if (!metrics) return "—";
      const value = (metrics as any)[metricInfo.key];
      if (typeof value === "number" && value > 0) {
        return formatNumber(value);
      }
      return "—";
    };

    // Cost per result
    const getCostPerResult = () => {
      if (!metrics) return "—";
      if (isSalesCampaign) {
        return metrics.conversions > 0 ? formatCurrency(metrics.cost_per_result_cents) : "—";
      }
      // For non-sales, calculate based on the metric key
      const resultValue = (metrics as any)[metricInfo.key] as number;
      if (resultValue > 0 && metrics.spend_cents > 0) {
        return formatCurrency(Math.round(metrics.spend_cents / resultValue));
      }
      return "—";
    };

    return (
      <>
        <TableRow key={c.id} className={hasAdsets ? "cursor-pointer hover:bg-muted/50" : ""} onClick={hasAdsets ? () => toggleExpand(campaignId) : undefined}>
          {/* Campanha */}
          <TableCell className="font-medium max-w-[240px]">
            <div className="flex items-center gap-2">
              {hasAdsets && (
                isExpanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className="truncate">{name}</span>
            </div>
          </TableCell>
          {/* Status */}
          <TableCell><StatusBadge status={status} /></TableCell>
          {/* Resultados */}
          <TableCell className="text-right tabular-nums">
            <div className="flex items-center justify-end gap-1">
              <metricInfo.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{getResultCount()}</span>
            </div>
          </TableCell>
          {/* Alcance */}
          <TableCell className="text-right tabular-nums text-sm">
            {metrics && metrics.reach > 0 ? formatNumber(metrics.reach) : "—"}
          </TableCell>
          {/* Frequência */}
          <TableCell className="text-right tabular-nums text-sm">
            {metrics && metrics.frequency > 0 ? metrics.frequency.toFixed(2) : "—"}
          </TableCell>
          {/* Custo por resultado */}
          <TableCell className="text-right tabular-nums text-sm">
            {getCostPerResult()}
          </TableCell>
          {/* Orçamento */}
          <TableCell className="text-right tabular-nums">
            {editingBudget === campaignId ? (
              <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                <Input
                  type="number"
                  value={budgetValue}
                  onChange={e => setBudgetValue(e.target.value)}
                  className="w-24 h-7 text-xs"
                  placeholder="R$"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleSaveBudget(campaignId); if (e.key === "Escape") setEditingBudget(null); }}
                />
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleSaveBudget(campaignId)}>OK</Button>
              </div>
            ) : (
              <span
                className={onUpdateCampaignBudget ? "cursor-pointer hover:underline" : ""}
                onClick={onUpdateCampaignBudget ? (e) => {
                  e.stopPropagation();
                  setEditingBudget(campaignId);
                  setBudgetValue(budget ? (budget / 100).toString() : "");
                } : undefined}
              >
                {budget ? formatCurrency(budget) : "—"}
              </span>
            )}
          </TableCell>
          {/* Valor usado (investido) */}
          <TableCell className="text-right tabular-nums">
            {metrics && metrics.spend_cents > 0 ? formatCurrency(metrics.spend_cents) : "—"}
          </TableCell>
          {/* ROAS (only for sales campaigns) */}
          <TableCell className="text-right tabular-nums font-semibold">
            {isSalesCampaign && metrics && metrics.roas > 0 ? (
              <span className={metrics.roas >= 1 ? "text-green-600" : "text-red-500"}>
                {metrics.roas.toFixed(2)}x
              </span>
            ) : "—"}
          </TableCell>
          {/* Ações */}
          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end gap-1">
              {isUpdating ? (
                <Button size="icon" variant="ghost" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>
              ) : (status === "ACTIVE" || status === "ENABLE") ? (
                <Button size="icon" variant="ghost" onClick={() => handleToggleStatus(campaignId, status)} title="Pausar campanha">
                  <Pause className="h-4 w-4" />
                </Button>
              ) : (status === "PAUSED" || status === "DISABLE") ? (
                <Button size="icon" variant="ghost" onClick={() => handleToggleStatus(campaignId, status)} title="Ativar campanha">
                  <Play className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </TableCell>
        </TableRow>

        {/* Expanded ad sets */}
        {isExpanded && campaignAdsetList.map(as => (
          <TableRow key={as.id} className="bg-muted/30">
            <TableCell className="pl-12 text-sm">
              <span className="text-muted-foreground">↳</span> {as.name}
            </TableCell>
            <TableCell><StatusBadge status={as.status} /></TableCell>
            <TableCell className="text-xs text-muted-foreground capitalize">{as.optimization_goal?.replace(/_/g, " ").toLowerCase() || "—"}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right tabular-nums text-sm">
              {as.daily_budget_cents ? formatCurrency(as.daily_budget_cents) : "—"}
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right">
              {onUpdateAdset && (
                <div className="flex justify-end gap-1">
                  {(as.status === "ACTIVE" || as.status === "ENABLE") ? (
                    <Button size="icon" variant="ghost" onClick={() => handleAdsetToggleStatus(as.meta_adset_id, as.status)} title="Pausar conjunto">
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  ) : (as.status === "PAUSED" || as.status === "DISABLE") ? (
                    <Button size="icon" variant="ghost" onClick={() => handleAdsetToggleStatus(as.meta_adset_id, as.status)} title="Ativar conjunto">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  };

  const renderTable = (campaignsList: any[]) => (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campanha</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Resultados</TableHead>
            <TableHead className="text-right">Alcance</TableHead>
            <TableHead className="text-right">Frequência</TableHead>
            <TableHead className="text-right">Custo/resultado</TableHead>
            <TableHead className="text-right">Orçamento</TableHead>
            <TableHead className="text-right">Valor usado</TableHead>
            <TableHead className="text-right">ROAS</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaignsList.map(renderCampaignRow)}
        </TableBody>
      </Table>
    </div>
  );

  const hasAnyCampaigns = accountFiltered.length > 0;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : selectedAccountIds && selectedAccountIds.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma conta selecionada"
          description="Selecione ao menos uma conta de anúncio acima para ver as campanhas"
        />
      ) : !hasAnyCampaigns ? (
        <EmptyState
          icon={Megaphone}
          title={isConnected ? "Nenhuma campanha sincronizada" : "Nenhuma campanha"}
          description={isConnected
            ? "Clique em sincronizar para importar as campanhas das contas selecionadas"
            : "Conecte sua conta e a IA sincronizará suas campanhas automaticamente"
          }
          action={isConnected && onSync ? {
            label: isSyncing ? "Sincronizando..." : "Sincronizar campanhas",
            onClick: onSync,
          } : undefined}
        />
      ) : (
        <>
          {/* Top bar: balance + external links */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {accountBalances.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => window.open(getChannelBalanceUrl(channel), "_blank")}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Saldo: {formatCurrency(totalBalance)}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
              {accountBalances.length === 0 && isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => window.open(getChannelBalanceUrl(channel), "_blank")}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Adicionar saldo
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={() => window.open(getChannelManagerUrl(channel), "_blank")}
              >
                Abrir {getChannelLabel(channel)} Ads
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Toolbar: filters + date + sync */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <ToggleGroup type="single" value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as StatusFilter)} size="sm">
                  <ToggleGroupItem value="all" className="text-xs gap-1.5">
                    Todas
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{accountFiltered.length}</Badge>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="active" className="text-xs gap-1.5">
                    Ativas
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{activeCount}</Badge>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="paused" className="text-xs gap-1.5">
                    Pausadas
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">{pausedCount}</Badge>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Date range picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${format(dateRange.to, "dd/MM", { locale: ptBR })}`
                      ) : format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    ) : "Período"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-1 p-2 border-b">
                    {DATE_PRESETS.map(preset => (
                      <Button
                        key={preset.days}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => setDateRange({
                          from: preset.days === 0 ? new Date() : subDays(new Date(), preset.days),
                          to: new Date(),
                        })}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {isConnected && onSync && (
              <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing} className="gap-2">
                {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sincronizar
              </Button>
            )}
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma campanha {statusFilter === "active" ? "ativa" : "pausada"} encontrada
            </div>
          ) : (
            renderTable(filteredCampaigns)
          )}
        </>
      )}
    </div>
  );
}
