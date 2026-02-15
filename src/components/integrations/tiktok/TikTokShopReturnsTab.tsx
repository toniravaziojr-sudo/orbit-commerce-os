// =============================================
// TIKTOK SHOP RETURNS TAB
// UI for managing returns and after-sales
// =============================================

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, RefreshCw, AlertCircle, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';
import { useTikTokReturns } from '@/hooks/useTikTokReturns';

function ReturnStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendente', variant: 'secondary' },
    approved: { label: 'Aprovada', variant: 'default' },
    rejected: { label: 'Rejeitada', variant: 'destructive' },
    completed: { label: 'Concluída', variant: 'default' },
    cancelled: { label: 'Cancelada', variant: 'outline' },
  };
  const s = map[status] || { label: status, variant: 'outline' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function ReturnTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    return: 'Devolução',
    refund: 'Reembolso',
    replacement: 'Troca',
  };
  return <Badge variant="outline" className="text-xs">{map[type] || type}</Badge>;
}

export function TikTokShopReturnsTab() {
  const {
    returns, isLoading, refetch,
    syncReturns, isSyncing,
    approveReturn, isApproving,
    rejectReturn, isRejecting,
  } = useTikTokReturns();

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
          {returns.length} devolução(ões)
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => syncReturns({})} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Sincronizar
          </Button>
        </div>
      </div>

      {returns.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma devolução encontrada. Clique em "Sincronizar" para importar do TikTok Shop.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell className="font-mono text-xs">
                    {ret.tiktok_order_id?.substring(0, 12)}...
                  </TableCell>
                  <TableCell>
                    <ReturnTypeBadge type={ret.return_type} />
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {ret.reason || '—'}
                  </TableCell>
                  <TableCell>
                    {(ret.refund_amount_cents / 100).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: ret.currency || 'BRL',
                    })}
                  </TableCell>
                  <TableCell>
                    <ReturnStatusBadge status={ret.status} />
                  </TableCell>
                  <TableCell>
                    {ret.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:text-primary/80"
                          onClick={() => approveReturn({ returnId: ret.id })}
                          disabled={isApproving}
                          title="Aprovar"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => rejectReturn({ returnId: ret.id })}
                          disabled={isRejecting}
                          title="Rejeitar"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
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
