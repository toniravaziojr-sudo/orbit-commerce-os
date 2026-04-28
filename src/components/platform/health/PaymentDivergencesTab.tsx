import { useState } from 'react';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePaymentDivergences } from '@/hooks/useSystemHealth';

const BRT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

function fmt(d?: string | null) {
  if (!d) return '—';
  try { return BRT.format(new Date(d)); } catch { return '—'; }
}

const TYPE_LABEL: Record<string, string> = {
  no_order: 'Pagamento sem pedido',
  order_missing: 'Pedido excluído',
  amount_mismatch: 'Valor divergente',
  unknown: 'Outro',
};

const TYPE_VARIANT: Record<string, 'destructive' | 'default' | 'secondary'> = {
  no_order: 'destructive',
  order_missing: 'destructive',
  amount_mismatch: 'default',
  unknown: 'secondary',
};

export function PaymentDivergencesTab() {
  const [windowHours, setWindowHours] = useState(24);
  const divergences = usePaymentDivergences(windowHours, 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-warning" />
            Divergências de pagamento
          </CardTitle>
          <Tabs value={String(windowHours)} onValueChange={(v) => setWindowHours(Number(v))}>
            <TabsList>
              <TabsTrigger value="24">24h</TabsTrigger>
              <TabsTrigger value="168">7 dias</TabsTrigger>
              <TabsTrigger value="720">30 dias</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Pagamentos aprovados pelo gateway sem pedido correspondente, com pedido excluído ou com valor divergente.
        </p>
      </CardHeader>
      <CardContent>
        {divergences.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : divergences.error ? (
          <p className="text-sm text-destructive">{(divergences.error as Error).message}</p>
        ) : (divergences.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> Nenhuma divergência na janela selecionada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lojista</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(divergences.data ?? []).map((d) => (
                  <TableRow key={d.transaction_id}>
                    <TableCell className="font-medium">{d.tenant_name}</TableCell>
                    <TableCell>
                      <Badge variant={TYPE_VARIANT[d.divergence_type] ?? 'secondary'}>
                        {TYPE_LABEL[d.divergence_type] ?? d.divergence_type}
                      </Badge>
                    </TableCell>
                    <TableCell><code className="text-xs">{d.provider}</code></TableCell>
                    <TableCell className="text-xs">{d.method ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      R$ {Number(d.paid_amount ?? d.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.order_id ? (
                        <code className="text-xs">{d.order_id.slice(0, 8)}…</code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(d.paid_at ?? d.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
