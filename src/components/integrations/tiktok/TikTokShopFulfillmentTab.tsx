// =============================================
// TIKTOK SHOP FULFILLMENT TAB
// UI for managing shipping/fulfillment submissions
// =============================================

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, AlertCircle, Truck } from 'lucide-react';
import { useTikTokFulfillment } from '@/hooks/useTikTokFulfillment';

function FulfillmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendente', variant: 'secondary' },
    submitted: { label: 'Enviado', variant: 'default' },
    error: { label: 'Erro', variant: 'destructive' },
  };
  const s = map[status] || { label: status, variant: 'outline' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function TikTokShopFulfillmentTab() {
  const {
    fulfillments, isLoading, refetch,
    shippingProviders, isLoadingProviders,
  } = useTikTokFulfillment();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {fulfillments.length} envio(s) registrado(s)
          {shippingProviders.length > 0 && (
            <span className="ml-2">· {shippingProviders.length} transportadora(s)</span>
          )}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {fulfillments.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum fulfillment registrado. Os envios de rastreio aparecerão aqui após serem submetidos ao TikTok Shop.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido TikTok</TableHead>
                <TableHead>Rastreio</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submetido em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fulfillments.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">
                    {f.tiktok_order_id?.substring(0, 12)}...
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {f.tracking_code || '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {f.carrier_name || f.carrier_code || '—'}
                  </TableCell>
                  <TableCell>
                    <FulfillmentStatusBadge status={f.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {f.submitted_at
                      ? new Date(f.submitted_at).toLocaleDateString('pt-BR')
                      : '—'}
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
