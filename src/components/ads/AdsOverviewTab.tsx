import { useMemo, useState } from "react";
import { DollarSign, TrendingUp, MousePointer, ShoppingCart, BarChart3, AlertTriangle, ChevronDown, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { subDays, parseISO, startOfDay, endOfDay } from "date-fns";
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

interface AdsOverviewTabProps {
  metaInsights: any[];
  tiktokInsights: any[];
  googleInsights?: any[];
  metaCampaigns: any[];
  tiktokCampaigns: any[];
  googleCampaigns?: any[];
  globalBudgetCents: number;
  globalBudgetMode: string;
  isLoading: boolean;
  trackingAlerts: string[];
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

function filterInsightsByDate(insights: any[], startDate?: Date, endDate?: Date) {
  if (!startDate || !endDate) return insights;
  const rangeFrom = startOfDay(startDate);
  const rangeTo = endOfDay(endDate);
  return insights.filter(i => {
    try {
      const dStart = parseISO(i.date_start);
      const dStop = parseISO(i.date_stop);
      return !(dStop < rangeFrom || dStart > rangeTo);
    } catch { return false; }
  });
}

type ChannelKey = "meta" | "google" | "tiktok";

const AVAILABLE_CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: "meta", label: "Meta Ads" },
  { key: "google", label: "Google Ads" },
  { key: "tiktok", label: "TikTok Ads" },
];

export function AdsOverviewTab({
  metaInsights,
  tiktokInsights,
  googleInsights = [],
  metaCampaigns,
  tiktokCampaigns,
  googleCampaigns = [],
  globalBudgetCents,
  globalBudgetMode,
  isLoading,
  trackingAlerts,
}: AdsOverviewTabProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedChannels, setSelectedChannels] = useState<Set<ChannelKey>>(new Set(["meta", "google", "tiktok"]));

  const handleDateChange = (start?: Date, end?: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const toggleChannel = (key: ChannelKey) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least one
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const channels = useMemo(() => {
    const list: ChannelSummary[] = [];
    if (selectedChannels.has("meta")) {
      const filteredMeta = filterInsightsByDate(metaInsights, startDate, endDate);
      if (metaCampaigns.length > 0 || filteredMeta.length > 0) {
        list.push(buildChannelSummary("meta", "Meta Ads", filteredMeta, metaCampaigns));
      }
    }
    if (selectedChannels.has("tiktok")) {
      const filteredTiktok = filterInsightsByDate(tiktokInsights, startDate, endDate);
      if (tiktokCampaigns.length > 0 || filteredTiktok.length > 0) {
        list.push(buildChannelSummary("tiktok", "TikTok Ads", filteredTiktok, tiktokCampaigns));
      }
    }
    if (selectedChannels.has("google")) {
      // Google insights may come as summary object or array
      const googleData = googleInsights.length > 0 ? googleInsights : [];
      if (googleCampaigns.length > 0 || googleData.length > 0) {
        // Convert summary format to compatible array
        const normalizedInsights = googleData.map((g: any) => ({
          spend_cents: g.spend ? Math.round(g.spend * 100) : (g.cost_micros ? Math.round(g.cost_micros / 10000) : 0),
          impressions: g.impressions || 0,
          clicks: g.clicks || 0,
          conversions: g.conversions || 0,
          conversion_value_cents: g.conversions_value ? Math.round(g.conversions_value * 100) : 0,
        }));
        list.push(buildChannelSummary("google", "Google Ads", normalizedInsights, googleCampaigns));
      }
    }
    return list;
  }, [metaInsights, tiktokInsights, googleInsights, metaCampaigns, tiktokCampaigns, googleCampaigns, startDate, endDate, selectedChannels]);

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

  const allChannelsSelected = selectedChannels.size === AVAILABLE_CHANNELS.length;

  return (
    <div className="space-y-6">
      {/* Filters row: platform selector + date */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Platform selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 font-normal border-dashed">
                <BarChart3 className="h-3 w-3" />
                {allChannelsSelected ? "Todas as plataformas" : `${selectedChannels.size} plataforma${selectedChannels.size !== 1 ? "s" : ""}`}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <Command>
                <CommandList>
                  <CommandEmpty>Nenhuma plataforma</CommandEmpty>
                  <CommandGroup>
                    {AVAILABLE_CHANNELS.map(ch => {
                      const isSelected = selectedChannels.has(ch.key);
                      return (
                        <CommandItem
                          key={ch.key}
                          onSelect={() => toggleChannel(ch.key)}
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                          )}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <span className="text-xs">{ch.label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Date Range Filter */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
            label="Período"
          />
        </div>
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
