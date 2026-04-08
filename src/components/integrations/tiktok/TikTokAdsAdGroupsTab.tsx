// =============================================
// TIKTOK ADS - AD GROUPS TAB
// Lists and manages TikTok ad groups
// =============================================

import { useTikTokAdGroups } from '@/hooks/useTikTokAdGroups';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RefreshCw, Layers } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function mapStatus(s: string) {
  if (s === 'ENABLE' || s === 'ADGROUP_STATUS_DELIVERY_OK') return 'active';
  if (s === 'DISABLE' || s?.includes('PAUSE')) return 'inactive';
  return 'pending';
}

export function TikTokAdsAdGroupsTab() {
  const { adGroups, adGroupsLoading, syncAdGroups } = useTikTokAdGroups();

  if (adGroupsLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Carregando grupos de anúncios...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{adGroups.length} grupo(s) de anúncios</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncAdGroups.mutate()}
          disabled={syncAdGroups.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncAdGroups.isPending ? 'animate-spin' : ''}`} />
          Sincronizar
        </Button>
      </div>

      {adGroups.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum grupo de anúncios"
          description="Sincronize com o TikTok para importar seus ad groups."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Promoção</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead className="text-right">Orçamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adGroups.map((ag) => (
                <TableRow key={ag.id}>
                  <TableCell className="font-medium text-sm">{ag.name}</TableCell>
                  <TableCell>
                    <StatusBadge variant={mapStatus(ag.status) === 'active' ? 'success' : mapStatus(ag.status) === 'inactive' ? 'destructive' : 'warning'} dot>{ag.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ag.promotion_type || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ag.optimize_goal || '—'}</TableCell>
                  <TableCell className="text-right text-sm">
                    {ag.budget_cents ? `R$ ${(ag.budget_cents / 100).toFixed(2)}` : '—'}
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
