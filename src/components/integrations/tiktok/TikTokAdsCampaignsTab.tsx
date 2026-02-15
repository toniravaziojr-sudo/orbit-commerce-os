// =============================================
// TIKTOK ADS CAMPAIGNS TAB
// Lists and manages TikTok Ad campaigns
// =============================================

import { useTikTokAds } from '@/hooks/useTikTokAds';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Megaphone, Loader2 } from 'lucide-react';

function campaignStatusVariant(status: string) {
  switch (status?.toUpperCase()) {
    case 'ENABLE':
    case 'CAMPAIGN_STATUS_ENABLE':
      return 'success' as const;
    case 'DISABLE':
    case 'CAMPAIGN_STATUS_DISABLE':
      return 'warning' as const;
    case 'DELETE':
    case 'CAMPAIGN_STATUS_DELETE':
      return 'destructive' as const;
    default:
      return 'default' as const;
  }
}

function campaignStatusLabel(status: string) {
  switch (status?.toUpperCase()) {
    case 'ENABLE':
    case 'CAMPAIGN_STATUS_ENABLE':
      return 'Ativo';
    case 'DISABLE':
    case 'CAMPAIGN_STATUS_DISABLE':
      return 'Pausado';
    case 'DELETE':
    case 'CAMPAIGN_STATUS_DELETE':
      return 'Removido';
    default:
      return status || '—';
  }
}

function formatBudget(cents: number | null) {
  if (!cents) return '—';
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export function TikTokAdsCampaignsTab() {
  const { campaigns, campaignsLoading, syncCampaigns } = useTikTokAds();

  if (campaignsLoading) {
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
          {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncCampaigns.mutate()}
          disabled={syncCampaigns.isPending}
          className="gap-2"
        >
          {syncCampaigns.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sincronizar
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha"
          description="Sincronize para importar campanhas do TikTok Ads."
          action={{
            label: 'Sincronizar agora',
            onClick: () => syncCampaigns.mutate(),
          }}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead className="text-right">Orçamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {c.name}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={campaignStatusVariant(c.status)} dot>
                      {campaignStatusLabel(c.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {c.objective_type || '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBudget(c.budget_cents)}
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
