// =============================================
// DASHBOARD TAB — Visão analítica + Preview de Vendas
// Sub-abas: Geral / Loja Virtual / Mercado Livre / Shopee / TikTok
// As 3 últimas só aparecem quando há conexão ativa no marketplace.
// =============================================
import { useState, useMemo } from "react";
import { subDays } from "date-fns";
import { Store, ShoppingBag, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DashboardMetricsGrid } from "@/components/dashboard/DashboardMetricsGrid";
import { OrderLimitWarning } from "@/components/billing/OrderLimitWarning";
import { PaymentMethodBanner } from "@/components/billing/PaymentMethodBanner";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useActiveMarketplaces } from "@/hooks/useActiveMarketplaces";
import { getComparisonLabel } from "@/lib/date-presets";
import { SalesPreviewBlock } from "./SalesPreviewBlock";
import { channelIncludesAds, type ChannelFilter } from "@/lib/dashboard/channelFilter";

interface ChannelPanelProps {
  channel: ChannelFilter;
  startDate?: Date;
  endDate?: Date;
  trendLabel: string;
  detailHref?: string;
  detailLabel?: string;
}

function ChannelPanel({ channel, startDate, endDate, trendLabel, detailHref, detailLabel }: ChannelPanelProps) {
  const { data: metrics, isLoading } = useDashboardMetrics(startDate, endDate, channel);
  const hideAds = !channelIncludesAds(channel);

  const previewFilters = useMemo(() => ({
    startDate: startDate || subDays(new Date(), 29),
    endDate: endDate || new Date(),
    channel,
  }), [startDate, endDate, channel]);

  return (
    <div className="space-y-6">
      {detailHref && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to={detailHref}>
              {detailLabel || "Ver detalhes do canal"}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      <DashboardMetricsGrid
        metrics={metrics}
        isLoading={isLoading}
        trendLabel={trendLabel}
        hideAds={hideAds}
        showSourceBadges
      />

      <SalesPreviewBlock filters={previewFilters} />
    </div>
  );
}

export function DashboardTab() {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [channelTab, setChannelTab] = useState<ChannelFilter>("all");

  const { data: active } = useActiveMarketplaces();

  const handleDateChange = (start?: Date, end?: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  const trendLabel = getComparisonLabel(startDate, endDate);

  return (
    <div className="space-y-6 animate-fade-in">
      <PaymentMethodBanner />

      <div className="flex justify-end">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
          label="Período"
        />
      </div>

      <OrderLimitWarning />

      <Tabs value={channelTab} onValueChange={(v) => setChannelTab(v as ChannelFilter)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all" className="gap-2">
            <Store className="h-3.5 w-3.5" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="storefront" className="gap-2">
            <ShoppingBag className="h-3.5 w-3.5" />
            Loja Virtual
          </TabsTrigger>
          {active?.mercadolivre && (
            <TabsTrigger value="mercadolivre">Mercado Livre</TabsTrigger>
          )}
          {active?.shopee && (
            <TabsTrigger value="shopee">Shopee</TabsTrigger>
          )}
          {active?.tiktok_shop && (
            <TabsTrigger value="tiktok_shop">TikTok Shop</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <ChannelPanel channel="all" startDate={startDate} endDate={endDate} trendLabel={trendLabel} />
        </TabsContent>

        <TabsContent value="storefront" className="mt-6">
          <ChannelPanel channel="storefront" startDate={startDate} endDate={endDate} trendLabel={trendLabel} />
        </TabsContent>

        {active?.mercadolivre && (
          <TabsContent value="mercadolivre" className="mt-6">
            <ChannelPanel
              channel="mercadolivre"
              startDate={startDate}
              endDate={endDate}
              trendLabel={trendLabel}
              detailHref="/marketplaces/mercadolivre"
              detailLabel="Ver detalhes no Mercado Livre"
            />
          </TabsContent>
        )}

        {active?.shopee && (
          <TabsContent value="shopee" className="mt-6">
            <ChannelPanel
              channel="shopee"
              startDate={startDate}
              endDate={endDate}
              trendLabel={trendLabel}
              detailHref="/marketplaces/shopee"
              detailLabel="Ver detalhes na Shopee"
            />
          </TabsContent>
        )}

        {active?.tiktok_shop && (
          <TabsContent value="tiktok_shop" className="mt-6">
            <ChannelPanel
              channel="tiktok_shop"
              startDate={startDate}
              endDate={endDate}
              trendLabel={trendLabel}
              detailHref="/marketplaces/tiktok-shop"
              detailLabel="Ver detalhes no TikTok Shop"
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
