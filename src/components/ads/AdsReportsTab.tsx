import { useMemo } from "react";
import { DollarSign, Eye, MousePointer, TrendingUp, Bot, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

interface AdAccount {
  id: string;
  name: string;
}

interface AdsReportsTabProps {
  insights: any[];
  actions: any[];
  channel: string;
  selectedAccountIds: string[];
  adAccounts: AdAccount[];
  campaigns: any[];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function getAccountId(campaign: any): string {
  return campaign.ad_account_id || campaign.advertiser_id || campaign.customer_id || "unknown";
}

function SummaryCards({ summary, label }: { summary: any; label?: string }) {
  const ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
  const cpa = summary.conversions > 0 ? summary.spend_cents / summary.conversions : 0;
  const roas = summary.spend_cents > 0 ? summary.conversion_value_cents / summary.spend_cents : 0;

  const cards = [
    { title: "Investimento", value: formatCurrency(summary.spend_cents), icon: DollarSign },
    { title: "Impressões", value: formatNumber(summary.impressions), icon: Eye, desc: `Alcance: ${formatNumber(summary.reach)}` },
    { title: "Cliques", value: formatNumber(summary.clicks), icon: MousePointer, desc: `CTR: ${ctr.toFixed(2)}%` },
    { title: "Conversões", value: formatNumber(summary.conversions), icon: TrendingUp, desc: `CPA: ${formatCurrency(cpa)}` },
    { title: "ROAS", value: `${roas.toFixed(2)}x`, icon: Bot, desc: formatCurrency(summary.conversion_value_cents) },
  ];

  return (
    <div className="space-y-2">
      {label && (
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {label}
        </h3>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(card => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">{card.title}</CardTitle>
              <card.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-lg font-bold">{card.value}</div>
              {card.desc && <p className="text-[11px] text-muted-foreground">{card.desc}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdsReportsTab({ insights, actions, channel, selectedAccountIds, adAccounts, campaigns }: AdsReportsTabProps) {
  // Build campaign → account mapping
  const campaignAccountMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaigns) {
      const cid = c.meta_campaign_id || c.google_campaign_id || c.tiktok_campaign_id;
      if (cid) map.set(cid, getAccountId(c));
    }
    return map;
  }, [campaigns]);

  // Group insights by account
  const perAccountSummaries = useMemo(() => {
    const selectedSet = new Set(selectedAccountIds);
    const accountMap = new Map<string, { impressions: number; clicks: number; spend_cents: number; conversions: number; reach: number; conversion_value_cents: number }>();

    for (const row of insights) {
      const campaignId = row.meta_campaign_id || row.tiktok_campaign_id || "";
      const accountId = campaignAccountMap.get(campaignId);
      if (!accountId || (selectedAccountIds.length > 0 && !selectedSet.has(accountId))) continue;

      const existing = accountMap.get(accountId) || { impressions: 0, clicks: 0, spend_cents: 0, conversions: 0, reach: 0, conversion_value_cents: 0 };
      existing.impressions += row.impressions || 0;
      existing.clicks += row.clicks || 0;
      existing.spend_cents += row.spend_cents || (row.cost_micros ? Math.round((row.cost_micros || 0) / 10000) : 0);
      existing.conversions += row.conversions || 0;
      existing.reach += row.reach || 0;
      existing.conversion_value_cents += row.conversion_value_cents || 0;
      accountMap.set(accountId, existing);
    }

    return accountMap;
  }, [insights, selectedAccountIds, campaignAccountMap]);

  if (perAccountSummaries.size === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados de relatório"
        description="Sincronize os dados das campanhas para ver relatórios"
      />
    );
  }

  const accountEntries = Array.from(perAccountSummaries.entries());
  const accountNameMap = new Map(adAccounts.map(a => [a.id, a.name]));

  return (
    <div className="space-y-6">
      {accountEntries.map(([accountId, summary]) => (
        <SummaryCards
          key={accountId}
          summary={summary}
          label={accountNameMap.get(accountId) || accountId}
        />
      ))}
    </div>
  );
}
