import { useMemo, useState } from "react";
import { DollarSign, TrendingUp, MousePointer, ShoppingCart, BarChart3, AlertTriangle, CalendarDays, ChevronDown, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { format, subDays, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface ChannelSummary {
  channel: string;
  label: string;
  spend_cents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value_cents: number;
  campaigns_count: number;
}

interface AdAccount {
  id: string;
  name: string;
  channel?: string;
}

interface AdsOverviewTabProps {
  metaInsights: any[];
  tiktokInsights: any[];
  metaCampaigns: any[];
  tiktokCampaigns: any[];
  globalBudgetCents: number;
  globalBudgetMode: string;
  isLoading: boolean;
  trackingAlerts: string[];
  adAccounts?: AdAccount[];
  selectedAccountIds?: string[];
  onToggleAccount?: (accountId: string) => void;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function buildChannelSummary(
  channel: string,
  label: string,
  insights: any[],
  campaigns: any[]
): ChannelSummary {
  let spend_cents = 0, impressions = 0, clicks = 0, conversions = 0, conversion_value_cents = 0;
  for (const row of insights) {
    spend_cents += row.spend_cents || (row.cost_micros ? Math.round((row.cost_micros || 0) / 10000) : 0);
    impressions += row.impressions || 0;
    clicks += row.clicks || 0;
    conversions += row.conversions || 0;
    conversion_value_cents += row.conversion_value_cents || 0;
  }
  return { channel, label, spend_cents, impressions, clicks, conversions, conversion_value_cents, campaigns_count: campaigns.length };
}

const DATE_PRESETS = [
  { label: "Hoje", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "15 dias", days: 15 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

function filterInsightsByDate(insights: any[], dateRange: DateRange | undefined) {
  if (!dateRange?.from || !dateRange?.to) return insights;
  const rangeFrom = startOfDay(dateRange.from);
  const rangeTo = endOfDay(dateRange.to);
  return insights.filter(i => {
    try {
      const dStart = parseISO(i.date_start);
      const dStop = parseISO(i.date_stop);
      return !(dStop < rangeFrom || dStart > rangeTo);
    } catch { return false; }
  });
}

function filterInsightsByAccounts(insights: any[], selectedIds: string[] | undefined) {
  if (!selectedIds || selectedIds.length === 0) return insights;
  const idSet = new Set(selectedIds);
  return insights.filter(i => {
    const accountId = i.ad_account_id;
    return !accountId || idSet.has(accountId);
  });
}

export function AdsOverviewTab({
  metaInsights,
  tiktokInsights,
  metaCampaigns,
  tiktokCampaigns,
  globalBudgetCents,
  globalBudgetMode,
  isLoading,
  trackingAlerts,
  adAccounts = [],
  selectedAccountIds,
  onToggleAccount,
}: AdsOverviewTabProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const channels = useMemo(() => {
    const list: ChannelSummary[] = [];
    const filteredMeta = filterInsightsByAccounts(filterInsightsByDate(metaInsights, dateRange), selectedAccountIds);
    const filteredTiktok = filterInsightsByAccounts(filterInsightsByDate(tiktokInsights, dateRange), selectedAccountIds);
    if (metaCampaigns.length > 0 || filteredMeta.length > 0) {
      list.push(buildChannelSummary("meta", "Meta Ads", filteredMeta, metaCampaigns));
    }
    if (tiktokCampaigns.length > 0 || filteredTiktok.length > 0) {
      list.push(buildChannelSummary("tiktok", "TikTok Ads", filteredTiktok, tiktokCampaigns));
    }
    return list;
  }, [metaInsights, tiktokInsights, metaCampaigns, tiktokCampaigns, dateRange, selectedAccountIds]);

  const totals = useMemo(() => {
    return channels.reduce(
      (acc, ch) => ({
        spend_cents: acc.spend_cents + ch.spend_cents,
        impressions: acc.impressions + ch.impressions,
        clicks: acc.clicks + ch.clicks,
        conversions: acc.conversions + ch.conversions,
        conversion_value_cents: acc.conversion_value_cents + ch.conversion_value_cents,
      }),
      { spend_cents: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value_cents: 0 }
    );
  }, [channels]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nenhum dado disponível"
        description="Conecte um canal de anúncios e sincronize as campanhas para ver a visão geral"
      />
    );
  }

  const roas = totals.spend_cents > 0 ? totals.conversion_value_cents / totals.spend_cents : 0;
  const cpa = totals.conversions > 0 ? totals.spend_cents / totals.conversions : 0;
  const pacingPct = globalBudgetCents > 0 ? Math.min((totals.spend_cents / globalBudgetCents) * 100, 100) : 0;

  const summaryCards = [
    { title: "Investimento Total", value: formatCurrency(totals.spend_cents), icon: DollarSign },
    { title: "ROAS Blended", value: `${roas.toFixed(2)}x`, icon: TrendingUp },
    { title: "CPA Médio", value: formatCurrency(cpa), icon: MousePointer },
    { title: "Conversões", value: formatNumber(totals.conversions), icon: ShoppingCart },
    { title: "Receita", value: formatCurrency(totals.conversion_value_cents), icon: BarChart3 },
  ];

  const selectedCount = selectedAccountIds?.length ?? adAccounts.length;
  const allSelected = selectedCount === adAccounts.length || !selectedAccountIds;

  return (
    <div className="space-y-6">
      {/* Filters row: accounts + date */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Account selector */}
          {adAccounts.length > 0 && onToggleAccount && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 font-normal border-dashed">
                  <BarChart3 className="h-3 w-3" />
                  {allSelected ? "Todas as contas" : `${selectedCount} conta${selectedCount !== 1 ? "s" : ""}`}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandEmpty>Nenhuma conta encontrada</CommandEmpty>
                    <CommandGroup>
                      {adAccounts.map(account => {
                        const isSelected = !selectedAccountIds || selectedAccountIds.includes(account.id);
                        return (
                          <CommandItem
                            key={account.id}
                            onSelect={() => onToggleAccount(account.id)}
                            className="cursor-pointer"
                          >
                            <div className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                            )}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <span className="text-xs truncate">{account.name || account.id}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {/* Date presets */}
          {DATE_PRESETS.map(preset => (
            <Button
              key={preset.days}
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => setDateRange({ from: preset.days === 0 ? new Date() : subDays(new Date(), preset.days), to: new Date() })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 font-normal border-dashed">
              <CalendarDays className="h-3 w-3" />
              {dateRange?.from ? (
                dateRange.to
                  ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                  : format(dateRange.from, "dd/MM/yyyy")
              ) : "Período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      {trackingAlerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1">
                {trackingAlerts.map((alert, i) => (
                  <p key={i} className="text-sm text-destructive">{alert}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryCards.map(card => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">{card.title}</CardTitle>
              <card.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pacing bar */}
      {globalBudgetCents > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Pacing Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Gasto: {formatCurrency(totals.spend_cents)}</span>
              <span>Orçamento: {formatCurrency(globalBudgetCents)} / {globalBudgetMode === "daily" ? "dia" : "mês"}</span>
            </div>
            <Progress value={pacingPct} className="h-2" />
            <p className="text-xs text-muted-foreground">{pacingPct.toFixed(1)}% utilizado</p>
          </CardContent>
        </Card>
      )}

      {/* Per-channel breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map(ch => {
          const chRoas = ch.spend_cents > 0 ? ch.conversion_value_cents / ch.spend_cents : 0;
          return (
            <Card key={ch.channel}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{ch.label}</CardTitle>
                  <Badge variant="outline" className="text-xs">{ch.campaigns_count} campanhas</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Investimento</span>
                  <span className="font-medium">{formatCurrency(ch.spend_cents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ROAS</span>
                  <span className="font-medium">{chRoas.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Conversões</span>
                  <span className="font-medium">{formatNumber(ch.conversions)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Receita</span>
                  <span className="font-medium">{formatCurrency(ch.conversion_value_cents)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
