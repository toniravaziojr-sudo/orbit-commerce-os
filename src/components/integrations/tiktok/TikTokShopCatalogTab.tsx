// =============================================
// TIKTOK SHOP CATALOG TAB
// UI for managing TikTok Shop product catalog sync
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Package,
} from 'lucide-react';
import { useTikTokCatalog } from '@/hooks/useTikTokCatalog';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    synced: { label: 'Sincronizado', variant: 'default' },
    pending: { label: 'Pendente', variant: 'secondary' },
    error: { label: 'Erro', variant: 'destructive' },
    paused: { label: 'Pausado', variant: 'outline' },
  };
  const s = map[status] || { label: status, variant: 'outline' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function TikTokShopCatalogTab() {
  const {
    syncedProducts, isLoading, refetch,
    syncProducts, isSyncing,
    checkStatus, isCheckingStatus,
  } = useTikTokCatalog();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {syncedProducts.length} produto(s) sincronizado(s)
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => checkStatus(undefined)} disabled={isCheckingStatus}>
            {isCheckingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Verificar Status
          </Button>
          <Button size="sm" onClick={() => syncProducts(undefined)} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
            Sincronizar Todos
          </Button>
        </div>
      </div>

      {syncedProducts.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhum produto sincronizado com o TikTok Shop. Clique em "Sincronizar Todos" para enviar seu catálogo.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>TikTok ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>TikTok Status</TableHead>
                <TableHead>Último Sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncedProducts.map((product: any) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {product.products?.name || product.product_id?.substring(0, 8)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {product.tiktok_product_id || '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={product.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {product.tiktok_status || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {product.last_synced_at
                      ? new Date(product.last_synced_at).toLocaleDateString('pt-BR')
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
