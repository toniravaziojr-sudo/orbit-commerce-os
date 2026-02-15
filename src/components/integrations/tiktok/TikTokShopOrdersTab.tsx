// =============================================
// TIKTOK SHOP ORDERS TAB
// UI for viewing and syncing TikTok Shop orders
// =============================================

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, AlertCircle, ShoppingCart } from 'lucide-react';
import { useTikTokOrders } from '@/hooks/useTikTokOrders';

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendente', variant: 'secondary' },
    confirmed: { label: 'Confirmado', variant: 'default' },
    shipped: { label: 'Enviado', variant: 'default' },
    delivered: { label: 'Entregue', variant: 'default' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
  };
  const s = map[status] || { label: status, variant: 'outline' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function TikTokShopOrdersTab() {
  const {
    orders, isLoading, refetch,
    syncOrders, isSyncing,
  } = useTikTokOrders();

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
          {orders.length} pedido(s)
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => syncOrders({})} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
            Sincronizar Pedidos
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum pedido sincronizado. Clique em "Sincronizar Pedidos" para importar da TikTok Shop.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido TikTok</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">
                    {order.tiktok_order_id?.substring(0, 12)}...
                  </TableCell>
                  <TableCell>{order.buyer_name || '—'}</TableCell>
                  <TableCell>
                    {(order.order_total_cents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: order.currency || 'BRL',
                    })}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString('pt-BR')}
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
