// =============================================
// RemessasManager — aba "Remessas" (agrupador)
// =============================================
// Lista shipping_remessas (camada de agrupamento de N objetos de postagem).
// Mostra todas as remessas do tenant — sem filtro padrão (transparência total
// confirmada na UX em 02/06/2026).
// Ações em lote por remessa: imprimir Protocolo PLP, Etiquetas, NFs, DCs ficam
// para a Fase 3. Esta fase entrega visibilidade + drill-down dos objetos.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, Package, ChevronRight, CheckCircle, AlertTriangle, Clock, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { formatDateTimeBR } from '@/lib/date-format';

interface RemessaRow {
  id: string;
  numero: string;
  carrier: string;
  descricao: string | null;
  status: string;
  total_objetos: number;
  total_emitidos: number;
  total_falhas: number;
  protocolo_plp: string | null;
  emitted_at: string | null;
  dispatched_at: string | null;
  created_at: string;
}

interface RemessaObjeto {
  id: string;
  tracking_code: string | null;
  carrier: string | null;
  delivery_status: string;
  created_at: string;
  source_pedido_venda_id: string | null;
  order?: { order_number: string | null; customer_name: string | null } | null;
  pv?: { numero: number | null; dest_nome: string | null } | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  rascunho: { label: 'Rascunho', variant: 'outline', icon: Clock },
  emitida: { label: 'Emitida', variant: 'default', icon: CheckCircle },
  parcial: { label: 'Parcial', variant: 'secondary', icon: AlertTriangle },
  despachada: { label: 'Despachada', variant: 'default', icon: Truck },
  finalizada: { label: 'Finalizada', variant: 'default', icon: CheckCircle },
  cancelada: { label: 'Cancelada', variant: 'destructive', icon: AlertTriangle },
};

// Tradução do status do objeto (espelho do ShipmentGenerator)
const objetoStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  label_created: { label: 'Etiqueta gerada', variant: 'outline' },
  posted: { label: 'Postado', variant: 'secondary' },
  in_transit: { label: 'Em trânsito', variant: 'secondary' },
  out_for_delivery: { label: 'Saiu p/ entrega', variant: 'secondary' },
  delivered: { label: 'Entregue', variant: 'default' },
  failed: { label: 'Falha', variant: 'destructive' },
  returned: { label: 'Devolvido', variant: 'destructive' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, variant: 'outline' as const, icon: Package };
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function ObjetoStatusBadge({ status }: { status: string }) {
  const cfg = objetoStatusConfig[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>;
}

export function RemessasManager() {
  const { currentTenant } = useAuth();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [openRemessa, setOpenRemessa] = useState<RemessaRow | null>(null);

  const { data: remessas, isLoading } = useQuery({
    queryKey: ['shipping-remessas', currentTenant?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [] as RemessaRow[];
      let q = supabase
        .from('shipping_remessas')
        .select('id, numero, carrier, descricao, status, total_objetos, total_emitidos, total_falhas, protocolo_plp, emitted_at, dispatched_at, created_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (startDate) {
        const { toSaoPauloStartIso } = await import('@/lib/date-timezone');
        q = q.gte('created_at', toSaoPauloStartIso(startDate));
      }
      if (endDate) {
        const { toSaoPauloEndIso } = await import('@/lib/date-timezone');
        q = q.lte('created_at', toSaoPauloEndIso(endDate));
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as RemessaRow[];
    },
    enabled: !!currentTenant?.id,
  });

  const { data: objetos, isLoading: loadingObjetos } = useQuery({
    queryKey: ['shipping-remessa-objetos', openRemessa?.id],
    queryFn: async () => {
      if (!openRemessa?.id) return [] as RemessaObjeto[];
      const { data, error } = await supabase
        .from('shipments')
        .select('id, tracking_code, carrier, delivery_status, created_at, source_pedido_venda_id, order:orders(order_number, customer_name)')
        .eq('remessa_id', openRemessa.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as RemessaObjeto[];

      // Fallback: buscar dados do PV para objetos sem pedido vinculado (PV manual/duplicado)
      const pvIds = Array.from(
        new Set(rows.filter(r => !r.order && r.source_pedido_venda_id).map(r => r.source_pedido_venda_id as string))
      );
      if (pvIds.length > 0) {
        const { data: pvs } = await supabase
          .from('fiscal_invoices')
          .select('id, numero, dest_nome')
          .in('id', pvIds);
        const pvMap = Object.fromEntries((pvs || []).map((p: any) => [p.id, p]));
        rows.forEach(r => {
          if (!r.order && r.source_pedido_venda_id && pvMap[r.source_pedido_venda_id]) {
            r.pv = { numero: pvMap[r.source_pedido_venda_id].numero, dest_nome: pvMap[r.source_pedido_venda_id].dest_nome };
          }
        });
      }
      return rows;
    },
    enabled: !!openRemessa?.id,
  });

  const total = remessas?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Remessas (agrupadores)</h3>
          <p className="text-sm text-muted-foreground">
            Cada remessa agrupa um ou mais objetos de postagem enviados juntos para a transportadora.
          </p>
        </div>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          label="Período"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Histórico de remessas
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {total} remessa(s)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : total === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma remessa criada ainda.</p>
              <p className="text-sm mt-1">
                As remessas são criadas automaticamente quando você emite um ou mais objetos de postagem.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Objetos</TableHead>
                    <TableHead className="text-center">Emitidos</TableHead>
                    <TableHead className="text-center">Falhas</TableHead>
                    <TableHead>Protocolo PLP</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {remessas!.map(r => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setOpenRemessa(r)}
                    >
                      <TableCell className="font-medium font-mono text-xs">{r.numero}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{r.carrier || '—'}</Badge>
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-center">{r.total_objetos}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">{r.total_emitidos}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.total_falhas > 0
                          ? <span className="text-destructive font-medium">{r.total_falhas}</span>
                          : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {r.protocolo_plp || <span className="opacity-50">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTimeBR(new Date(r.created_at))}
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!openRemessa} onOpenChange={(v) => !v && setOpenRemessa(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {openRemessa && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {openRemessa.numero}
                </SheetTitle>
                <SheetDescription>
                  {openRemessa.descricao || `Remessa via ${openRemessa.carrier}`}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="mt-1"><StatusBadge status={openRemessa.status} /></div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Objetos</p>
                    <p className="text-lg font-semibold mt-1">{openRemessa.total_objetos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Emitidos</p>
                    <p className="text-lg font-semibold mt-1 text-green-600">{openRemessa.total_emitidos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Falhas</p>
                    <p className={`text-lg font-semibold mt-1 ${openRemessa.total_falhas > 0 ? 'text-destructive' : ''}`}>
                      {openRemessa.total_falhas}
                    </p>
                  </div>
                </div>

                {openRemessa.protocolo_plp && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-xs text-muted-foreground">Protocolo PLP</p>
                    <p className="font-mono text-sm mt-1">{openRemessa.protocolo_plp}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Objetos da remessa
                  </h4>
                  {loadingObjetos ? (
                    <div className="space-y-2">
                      {[1, 2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                    </div>
                  ) : (objetos?.length || 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum objeto vinculado.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido de Venda</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Rastreio</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {objetos!.map(o => {
                          const pvNumero = o.pv?.numero != null ? `PV ${o.pv.numero}` : null;
                          const orderNumero = o.order?.order_number ? `#${o.order.order_number}` : null;
                          const referencia = pvNumero || orderNumero || '—';
                          const cliente = o.pv?.dest_nome || o.order?.customer_name || '—';
                          return (
                            <TableRow key={o.id}>
                              <TableCell className="font-medium">{referencia}</TableCell>
                              <TableCell className="text-sm">{cliente}</TableCell>
                              <TableCell className="font-mono text-xs">{o.tracking_code || '—'}</TableCell>
                              <TableCell>
                                <ObjetoStatusBadge status={o.delivery_status} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Ações em lote (Protocolo PLP, etiquetas, NFs, DCs) serão liberadas em breve.
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
