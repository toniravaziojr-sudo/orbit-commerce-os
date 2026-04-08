// =============================================
// TIKTOK ADS - ADS TAB
// Lists and manages individual TikTok ads
// =============================================

import { useTikTokAdGroups } from '@/hooks/useTikTokAdGroups';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RefreshCw, Film } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function mapStatus(s: string) {
  if (s === 'ENABLE' || s === 'AD_STATUS_DELIVERY_OK') return 'active';
  if (s === 'DISABLE' || s?.includes('PAUSE')) return 'inactive';
  return 'pending';
}

export function TikTokAdsAdsTab() {
  const { ads, adsLoading, syncAds } = useTikTokAdGroups();

  if (adsLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Carregando anúncios...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{ads.length} anúncio(s)</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncAds.mutate()}
          disabled={syncAds.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncAds.isPending ? 'animate-spin' : ''}`} />
          Sincronizar
        </Button>
      </div>

      {ads.length === 0 ? (
        <EmptyState
          icon={Film}
          title="Nenhum anúncio"
          description="Sincronize com o TikTok para importar seus anúncios."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>CTA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((ad) => (
                <TableRow key={ad.id}>
                  <TableCell className="font-medium text-sm">{ad.name}</TableCell>
                  <TableCell>
                    <StatusBadge variant={mapStatus(ad.status) === 'active' ? 'success' : mapStatus(ad.status) === 'inactive' ? 'destructive' : 'warning'} dot>{ad.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ad.ad_format || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ad.call_to_action || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
