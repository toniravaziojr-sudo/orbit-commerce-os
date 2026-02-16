import { useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, BarChart3, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface AdsRoiReportsTabProps {
  insights: any[];
  campaigns: any[];
  selectedAccountIds: string[];
  adAccounts: { id: string; name: string }[];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function getAccountId(campaign: any): string {
  return campaign.ad_account_id || campaign.advertiser_id || campaign.customer_id || "unknown";
}

interface RoiData {
  spend_cents: number;
  revenue_cents: number;
  cogs_cents: number;
  fees_cents: number;
  gross_profit_cents: number;
  real_roi: number;
  roas: number;
  orders_count: number;
  avg_ticket_cents: number;
  avg_cpa_cents: number;
  conversions: number;
}

export function AdsRoiReportsTab({ insights, campaigns, selectedAccountIds, adAccounts }: AdsRoiReportsTabProps) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  // Fetch recent paid orders
  const thirtyDaysAgo = useMemo(() => new Date(Date.now() - 30 * 86400000).toISOString(), []);
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["orders-roi", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, payment_status")
        .eq("tenant_id", tenantId!)
        .eq("payment_status", "approved")
        .gte("created_at", thirtyDaysAgo)
        .limit(500);
      return (data || []) as any[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch order items with cost_price for COGS
  const orderIds = useMemo(() => orders.map((o: any) => o.id), [orders]);
  const { data: orderItems = [] } = useQuery({
    queryKey: ["order-items-roi", orderIds.length],
    queryFn: async () => {
      if (orderIds.length === 0) return [];
      const { data } = await supabase
        .from("order_items")
        .select("order_id, cost_price, quantity")
        .in("order_id", orderIds.slice(0, 200));
      return (data || []) as any[];
    },
    enabled: orderIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Campaign → account mapping
  const campaignAccountMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaigns) {
      const cid = c.meta_campaign_id || c.google_campaign_id || c.tiktok_campaign_id;
      if (cid) map.set(cid, getAccountId(c));
    }
    return map;
  }, [campaigns]);

  // Calculate real ROI per account
  const roiByAccount = useMemo(() => {
    const selectedSet = new Set(selectedAccountIds);
    const accountSpend = new Map<string, number>();
    const accountConversions = new Map<string, number>();

    for (const row of insights) {
      const cid = row.meta_campaign_id || row.tiktok_campaign_id || "";
      const accountId = campaignAccountMap.get(cid);
      if (!accountId || (selectedAccountIds.length > 0 && !selectedSet.has(accountId))) continue;
      accountSpend.set(accountId, (accountSpend.get(accountId) || 0) + (row.spend_cents || 0));
      accountConversions.set(accountId, (accountConversions.get(accountId) || 0) + (row.conversions || 0));
    }

    const GATEWAY_FEE_PCT = 0.04;
    const totalRevenue = orders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const totalCogs = orderItems.reduce((s: number, i: any) => s + ((i.cost_price || 0) * (i.quantity || 1)), 0);

    const results = new Map<string, RoiData>();
    const totalSpendAllAccounts = Array.from(accountSpend.values()).reduce((s, v) => s + v, 0);

    for (const [accountId, spend] of accountSpend.entries()) {
      const spendShare = totalSpendAllAccounts > 0 ? spend / totalSpendAllAccounts : 0;
      const attrRevenue = Math.round(totalRevenue * spendShare);
      const attrCogs = Math.round(totalCogs * spendShare);
      const fees = Math.round(attrRevenue * GATEWAY_FEE_PCT);
      const grossProfit = attrRevenue - attrCogs - fees - spend;
      const realRoi = spend > 0 ? (attrRevenue - attrCogs - fees) / spend : 0;
      const roas = spend > 0 ? attrRevenue / spend : 0;
      const conversions = accountConversions.get(accountId) || 0;
      const ordersCount = Math.round(orders.length * spendShare);
      const avgTicket = ordersCount > 0 ? Math.round(attrRevenue / ordersCount) : 0;
      const avgCpa = conversions > 0 ? Math.round(spend / conversions) : 0;

      results.set(accountId, {
        spend_cents: spend, revenue_cents: attrRevenue, cogs_cents: attrCogs,
        fees_cents: fees, gross_profit_cents: grossProfit,
        real_roi: Math.round(realRoi * 100) / 100, roas: Math.round(roas * 100) / 100,
        orders_count: ordersCount, avg_ticket_cents: avgTicket, avg_cpa_cents: avgCpa, conversions,
      });
    }

    return results;
  }, [insights, orders, orderItems, campaigns, selectedAccountIds, campaignAccountMap]);

  if (ordersLoading) {
    return <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-48 w-full" />)}</div>;
  }

  if (roiByAccount.size === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados de ROI"
        description="Sincronize campanhas e tenha pedidos pagos para calcular o ROI real"
      />
    );
  }

  const accountNameMap = new Map(adAccounts.map(a => [a.id, a.name]));

  return (
    <div className="space-y-6">
      {Array.from(roiByAccount.entries()).map(([accountId, data]) => {
        const isPositive = data.gross_profit_cents > 0;
        const profitMarginPct = data.revenue_cents > 0
          ? Math.round((data.gross_profit_cents / data.revenue_cents) * 100)
          : 0;

        return (
          <div key={accountId} className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              {accountNameMap.get(accountId) || accountId}
              <Badge variant={isPositive ? "default" : "destructive"} className="text-xs">
                {isPositive ? "Lucrativo" : "Prejuízo"}
              </Badge>
            </h3>

            {/* Main ROI metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">ROI Real</CardTitle>
                  {data.real_roi >= 1 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className={`text-xl font-bold ${data.real_roi >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {data.real_roi.toFixed(2)}x
                  </div>
                  <p className="text-[11px] text-muted-foreground">(Receita - COGS - Taxas) / Spend</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">ROAS</CardTitle>
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold">{data.roas.toFixed(2)}x</div>
                  <p className="text-[11px] text-muted-foreground">Receita / Spend</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Lucro Bruto</CardTitle>
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className={`text-xl font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {formatCurrency(data.gross_profit_cents)}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Margem: {profitMarginPct}%</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">CPA Médio</CardTitle>
                  <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold">{formatCurrency(data.avg_cpa_cents)}</div>
                  <p className="text-[11px] text-muted-foreground">{data.conversions} conversões</p>
                </CardContent>
              </Card>
            </div>

            {/* Breakdown */}
            <Card>
              <CardContent className="py-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Investimento</p>
                    <p className="font-semibold">{formatCurrency(data.spend_cents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Receita Atribuída</p>
                    <p className="font-semibold">{formatCurrency(data.revenue_cents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">COGS (Custo Produtos)</p>
                    <p className="font-semibold text-destructive">-{formatCurrency(data.cogs_cents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Taxas Gateway (~4%)</p>
                    <p className="font-semibold text-destructive">-{formatCurrency(data.fees_cents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Ticket Médio</p>
                    <p className="font-semibold">{formatCurrency(data.avg_ticket_cents)}</p>
                  </div>
                </div>
                {data.revenue_cents > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Distribuição de receita</span>
                    </div>
                    <Progress
                      value={data.revenue_cents > 0 ? Math.min(100, Math.max(0, ((data.revenue_cents - data.cogs_cents - data.fees_cents - data.spend_cents) / data.revenue_cents) * 100)) : 0}
                      className="h-2"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>COGS {Math.round(data.cogs_cents / data.revenue_cents * 100)}%</span>
                      <span>Taxas {Math.round(data.fees_cents / data.revenue_cents * 100)}%</span>
                      <span>Ads {Math.round(data.spend_cents / data.revenue_cents * 100)}%</span>
                      <span className={isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                        Lucro {profitMarginPct}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
