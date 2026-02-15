// =============================================
// TIKTOK ADS INSIGHTS TAB
// Shows performance metrics for TikTok Ad campaigns
// =============================================

import { useTikTokAds } from '@/hooks/useTikTokAds';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, BarChart3, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

function formatCents(cents: number) {
  if (!cents) return 'R$ 0,00';
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatNumber(n: number) {
  if (!n) return '0';
  return n.toLocaleString('pt-BR');
}

function formatPercent(n: number) {
  if (!n) return '0%';
  return `${(n * 100).toFixed(2)}%`;
}

export function TikTokAdsInsightsTab() {
  const { insights, insightsLoading, syncInsights } = useTikTokAds();

  if (insightsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {insights.length} registro{insights.length !== 1 ? 's' : ''} de métricas
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncInsights.mutate({})}
          disabled={syncInsights.isPending}
          className="gap-2"
        >
          {syncInsights.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sincronizar
        </Button>
      </div>

      {insights.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Sem métricas"
          description="Sincronize para importar dados de performance das campanhas."
          action={{
            label: 'Sincronizar agora',
            onClick: () => syncInsights.mutate({}),
          }}
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Conversões</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {format(new Date(i.date_start), 'dd/MM/yy')}
                  </TableCell>
                  <TableCell className="font-medium max-w-[160px] truncate text-xs">
                    {i.tiktok_ad_campaigns?.name || i.tiktok_campaign_id}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatNumber(i.impressions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatNumber(i.clicks)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatPercent(i.ctr)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatCents(i.spend_cents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatNumber(i.conversions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-medium">
                    {i.roas ? i.roas.toFixed(2) + 'x' : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
