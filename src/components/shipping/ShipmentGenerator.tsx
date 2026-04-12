import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ptBR } from 'date-fns/locale';
import { Package, Truck, Printer, ExternalLink, AlertTriangle, CheckCircle, Clock, FileText, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCreateShipment } from '@/hooks/useShipments';
import { toast } from 'sonner';

import { formatDateTimeBR, formatDayMonthTimeBR } from "@/lib/date-format";

interface ShipmentRecord {
  id: string;
  order_id: string;
  tracking_code: string;
  carrier: string;
  delivery_status: string;
  created_at: string;
  source: string | null;
  metadata: any;
  label_url: string | null;
  nfe_key: string | null;
  invoice_id: string | null;
  order?: {
    id?: string;
    order_number: string;
    customer_name: string;
    shipping_carrier?: string;
    shipping_city?: string;
    shipping_state?: string;
    total?: number;
    created_at?: string;
    status?: string;
  };
  invoice?: {
    danfe_url: string | null;
    chave_acesso: string | null;
    numero: number | null;
  } | null;
}

const CARRIERS = [
  { value: 'all', label: 'Todas Transportadoras' },
  { value: 'correios', label: 'Correios' },
  { value: 'loggi', label: 'Loggi' },
  { value: 'frenet', label: 'Frenet' },
  { value: 'outros', label: 'Outros' },
];

export function ShipmentGenerator() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const createShipment = useCreateShipment();
  
  const [activeTab, setActiveTab] = useState('prontos');
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedIssued, setSelectedIssued] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [dispatchDialog, setDispatchDialog] = useState<ShipmentRecord | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['orders-ready-shipment'] });
    queryClient.invalidateQueries({ queryKey: ['shipments-issued'] });
    queryClient.invalidateQueries({ queryKey: ['shipments-failed'] });
  };

  // === TAB 1: Prontos para emitir remessa ===
  const { data: readyOrders, isLoading: loadingReady } = useQuery({
    queryKey: ['orders-ready-shipment', currentTenant?.id, selectedCarrier, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('shipments')
        .select<string, any>(`
          id, order_id, carrier, delivery_status, created_at, source, metadata, label_url, nfe_key, invoice_id,
          order:orders!inner(id, order_number, customer_name, shipping_carrier, shipping_city, shipping_state, total, created_at, status)
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('delivery_status', 'draft' as any)
        .order('created_at', { ascending: false });

      if (selectedCarrier !== 'all' && selectedCarrier !== 'outros') {
        query = query.ilike('carrier', `%${selectedCarrier}%`);
      }
      if (startDate) {
        const { toSaoPauloStartIso } = await import('@/lib/date-timezone');
        query = query.gte('created_at', toSaoPauloStartIso(startDate));
      }
      if (endDate) {
        const { toSaoPauloEndIso } = await import('@/lib/date-timezone');
        query = query.lte('created_at', toSaoPauloEndIso(endDate));
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ShipmentRecord[];
    },
    enabled: !!currentTenant?.id,
  });

  // === TAB 2: Remessas emitidas (has tracking, not draft/failed) ===
  const { data: issuedShipments, isLoading: loadingIssued } = useQuery({
    queryKey: ['shipments-issued', currentTenant?.id, selectedCarrier, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('shipments')
        .select(`
          id, order_id, tracking_code, carrier, delivery_status, created_at, source, metadata, label_url, nfe_key, invoice_id,
          order:orders!inner(order_number, customer_name, status)
        `)
        .eq('tenant_id', currentTenant.id)
        .not('delivery_status', 'in', '("draft","failed")')
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedCarrier !== 'all' && selectedCarrier !== 'outros') {
        query = query.ilike('carrier', `%${selectedCarrier}%`);
      }
      if (startDate) {
        const { toSaoPauloStartIso } = await import('@/lib/date-timezone');
        query = query.gte('created_at', toSaoPauloStartIso(startDate));
      }
      if (endDate) {
        const { toSaoPauloEndIso } = await import('@/lib/date-timezone');
        query = query.lte('created_at', toSaoPauloEndIso(endDate));
      }

      // Fetch DANFE URLs for invoices
      const { data, error } = await query;
      if (error) throw error;
      
      const shipments = (data || []) as ShipmentRecord[];
      
      // Fetch invoice data for shipments that have invoice_id
      const invoiceIds = shipments.map(s => s.invoice_id).filter(Boolean);
      if (invoiceIds.length > 0) {
        const { data: invoices } = await supabase
          .from('fiscal_invoices')
          .select('id, danfe_url, chave_acesso, numero')
          .in('id', invoiceIds as string[]);
        
        if (invoices) {
          const invoiceMap = Object.fromEntries(invoices.map(i => [i.id, i]));
          shipments.forEach(s => {
            if (s.invoice_id && invoiceMap[s.invoice_id]) {
              s.invoice = invoiceMap[s.invoice_id];
            }
          });
        }
      }
      
      return shipments;
    },
    enabled: !!currentTenant?.id,
  });

  // === TAB 3: Remessas pendentes (failed) ===
  const { data: failedShipments, isLoading: loadingFailed } = useQuery({
    queryKey: ['shipments-failed', currentTenant?.id, selectedCarrier],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('shipments')
        .select(`
          id, order_id, tracking_code, carrier, delivery_status, created_at, source, metadata, label_url, nfe_key, invoice_id,
          order:orders!inner(order_number, customer_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('delivery_status', 'failed' as any)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as ShipmentRecord[];
    },
    enabled: !!currentTenant?.id,
  });

  // === ACTIONS ===

  const toggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) newSelected.delete(orderId);
    else newSelected.add(orderId);
    setSelectedOrders(newSelected);
  };

  const toggleAll = () => {
    if (!readyOrders) return;
    if (selectedOrders.size === readyOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(readyOrders.map(s => s.order_id)));
    }
  };

  const toggleIssued = (id: string) => {
    const newSelected = new Set(selectedIssued);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIssued(newSelected);
  };

  const toggleAllIssued = () => {
    if (!issuedShipments) return;
    if (selectedIssued.size === issuedShipments.length) {
      setSelectedIssued(new Set());
    } else {
      setSelectedIssued(new Set(issuedShipments.map(s => s.id)));
    }
  };

  const handleGenerateShipments = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Selecione pelo menos um pedido');
      return;
    }

    setIsGenerating(true);
    let successCount = 0;
    let errorCount = 0;

    for (const orderId of selectedOrders) {
      try {
        await createShipment.mutateAsync({ order_id: orderId });
        successCount++;
      } catch (error) {
        console.error(`Error creating shipment for order ${orderId}:`, error);
        errorCount++;
      }
    }

    setIsGenerating(false);
    setSelectedOrders(new Set());
    
    if (successCount > 0) toast.success(`${successCount} remessa(s) emitida(s) com sucesso`);
    if (errorCount > 0) toast.error(`${errorCount} remessa(s) falharam`);
    invalidateAll();
  };

  const handleRetryShipment = async (orderId: string) => {
    try {
      // Reset shipment to draft before retrying
      await supabase
        .from('shipments')
        .update({ delivery_status: 'draft' as any })
        .eq('order_id', orderId)
        .eq('tenant_id', currentTenant?.id!)
        .eq('delivery_status', 'failed' as any);
      
      await createShipment.mutateAsync({ order_id: orderId });
      toast.success('Remessa reenviada com sucesso');
      invalidateAll();
    } catch (error) {
      toast.error('Falha ao reenviar remessa');
    }
  };

  // Print label
  const handlePrintLabel = (shipment: ShipmentRecord) => {
    if (shipment.label_url) {
      window.open(shipment.label_url, '_blank');
    } else {
      toast.error('Etiqueta não disponível');
    }
  };

  // Print DANFE
  const handlePrintDanfe = async (shipment: ShipmentRecord) => {
    if (shipment.invoice?.danfe_url) {
      window.open(shipment.invoice.danfe_url, '_blank');
      return;
    }
    // Fallback: fetch from DB
    if (shipment.invoice_id) {
      const { data } = await supabase
        .from('fiscal_invoices')
        .select('danfe_url')
        .eq('id', shipment.invoice_id)
        .single();
      if (data?.danfe_url) {
        window.open(data.danfe_url, '_blank');
      } else {
        toast.error('DANFE não disponível');
      }
    } else {
      toast.error('NF-e não vinculada à remessa');
    }
  };

  // Dispatch action: open dialog with print options + confirm
  const handleDispatchClick = (shipment: ShipmentRecord) => {
    setDispatchDialog(shipment);
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchDialog || !currentTenant?.id) return;
    setIsDispatching(true);

    try {
      // Update order status to dispatched
      await supabase
        .from('orders')
        .update({ 
          status: 'dispatched' as any,
          shipped_at: new Date().toISOString(),
        })
        .eq('id', dispatchDialog.order_id);

      // Log in order history
      await supabase
        .from('order_history')
        .insert({
          order_id: dispatchDialog.order_id,
          action: 'dispatched',
          description: `Despacho confirmado. Etiqueta: ${dispatchDialog.tracking_code || 'N/A'}`,
        });

      toast.success('Pedido marcado como despachado');
      setDispatchDialog(null);
      invalidateAll();
    } catch (error) {
      toast.error('Erro ao confirmar despacho');
    } finally {
      setIsDispatching(false);
    }
  };

  // Batch print
  const handleBatchPrint = async (type: 'labels' | 'danfes' | 'both') => {
    if (!issuedShipments) return;
    const selected = issuedShipments.filter(s => selectedIssued.has(s.id));
    
    if (selected.length === 0) {
      toast.error('Selecione ao menos uma remessa');
      return;
    }

    let opened = 0;
    for (const s of selected) {
      if ((type === 'labels' || type === 'both') && s.label_url) {
        window.open(s.label_url, '_blank');
        opened++;
      }
      if ((type === 'danfes' || type === 'both') && s.invoice?.danfe_url) {
        window.open(s.invoice.danfe_url, '_blank');
        opened++;
      }
    }

    if (opened === 0) {
      toast.error('Nenhum documento disponível para impressão');
    } else {
      toast.success(`${opened} documento(s) aberto(s) para impressão`);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Rascunho', variant: 'outline' },
      label_created: { label: 'Etiqueta criada', variant: 'outline' },
      posted: { label: 'Postado', variant: 'secondary' },
      in_transit: { label: 'Em trânsito', variant: 'secondary' },
      out_for_delivery: { label: 'Saiu p/ entrega', variant: 'secondary' },
      delivered: { label: 'Entregue', variant: 'default' },
      failed: { label: 'Falha', variant: 'destructive' },
      returned: { label: 'Devolvido', variant: 'destructive' },
    };
    const cfg = config[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const readyCount = readyOrders?.length || 0;
  const issuedCount = issuedShipments?.length || 0;
  const failedCount = failedShipments?.length || 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={selectedCarrier} onValueChange={setSelectedCarrier}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Transportadora" />
          </SelectTrigger>
          <SelectContent>
            {CARRIERS.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          label="Período"
        />
      </div>

      {/* 3-Tab Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="prontos" className="gap-2">
            <Package className="h-4 w-4" />
            Prontos para emitir
            {readyCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {readyCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="emitidas" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Remessas emitidas
            {issuedCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {issuedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pendentes
            {failedCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {failedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Prontos para emitir */}
        <TabsContent value="prontos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Prontos para emitir remessa
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {readyCount} pedido(s)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {loadingReady ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : readyCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhum pedido pronto para emitir remessa
                </div>
              ) : (
                <>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={selectedOrders.size === readyCount && readyCount > 0}
                              onCheckedChange={toggleAll}
                            />
                          </TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Frete</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>NF-e</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {readyOrders!.map(shipment => {
                          const order = shipment.order as any;
                          const meta = shipment.metadata as any;
                          const hasNFe = !!shipment.nfe_key;
                          return (
                            <TableRow 
                              key={shipment.id}
                              className="cursor-pointer"
                              onClick={() => toggleOrder(shipment.order_id)}
                            >
                              <TableCell onClick={e => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedOrders.has(shipment.order_id)}
                                  onCheckedChange={() => toggleOrder(shipment.order_id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                #{order?.order_number}
                              </TableCell>
                              <TableCell className="max-w-[120px] truncate">
                                {order?.customer_name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {shipment.carrier || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {order?.shipping_city}/{order?.shipping_state}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {meta?.weight_grams ? `${meta.weight_grams}g` : '-'}
                              </TableCell>
                              <TableCell>
                                {hasNFe ? (
                                  <Badge variant="default" className="text-xs">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Vinculada
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    Sem NF-e
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">
                      {selectedOrders.size} pedido(s) selecionado(s)
                    </span>
                    <Button
                      onClick={handleGenerateShipments}
                      disabled={selectedOrders.size === 0 || isGenerating}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <>Emitindo...</>
                      ) : (
                        <>
                          <Truck className="h-4 w-4" />
                          Emitir Remessa ({selectedOrders.size})
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Remessas emitidas */}
        <TabsContent value="emitidas" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Remessas emitidas
                </CardTitle>
                <div className="flex items-center gap-2">
                  {selectedIssued.size > 0 && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleBatchPrint('labels')} className="gap-1">
                        <Printer className="h-3 w-3" />
                        Etiquetas ({selectedIssued.size})
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBatchPrint('danfes')} className="gap-1">
                        <FileText className="h-3 w-3" />
                        DANFEs ({selectedIssued.size})
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleBatchPrint('both')} className="gap-1">
                        <Printer className="h-3 w-3" />
                        Tudo ({selectedIssued.size})
                      </Button>
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {issuedCount} remessa(s)
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingIssued ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : issuedCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhuma remessa emitida
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedIssued.size === issuedCount && issuedCount > 0}
                            onCheckedChange={toggleAllIssued}
                          />
                        </TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Rastreio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issuedShipments!.map(shipment => (
                        <TableRow key={shipment.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIssued.has(shipment.id)}
                              onCheckedChange={() => toggleIssued(shipment.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            #{shipment.order?.order_number}
                          </TableCell>
                          <TableCell className="max-w-[100px] truncate">
                            {shipment.order?.customer_name}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono">{shipment.tracking_code || '-'}</span>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(shipment.delivery_status)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{shipment.carrier}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDayMonthTimeBR(new Date(shipment.created_at))}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button 
                                variant="ghost" size="icon" className="h-7 w-7" 
                                title="Imprimir etiqueta"
                                onClick={() => handlePrintLabel(shipment)}
                                disabled={!shipment.label_url}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" size="icon" className="h-7 w-7" 
                                title="Imprimir DANFE"
                                onClick={() => handlePrintDanfe(shipment)}
                                disabled={!shipment.invoice_id}
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                              {shipment.order?.status !== 'dispatched' && shipment.order?.status !== 'shipped' && (
                                <Button 
                                  variant="outline" size="sm" className="h-7 gap-1 text-xs"
                                  onClick={() => handleDispatchClick(shipment)}
                                >
                                  <Send className="h-3 w-3" />
                                  Despachar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Remessas pendentes (erros) */}
        <TabsContent value="pendentes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Remessas pendentes
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {failedCount} remessa(s)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFailed ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : failedCount === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhuma remessa com erro pendente
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {failedShipments!.map(shipment => (
                      <div
                        key={shipment.id}
                        className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                #{shipment.order?.order_number}
                              </span>
                              {getStatusBadge(shipment.delivery_status)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {shipment.order?.customer_name}
                            </p>
                            {(shipment.metadata as any)?.error_message && (
                              <p className="text-xs text-destructive mt-1">
                                {(shipment.metadata as any).error_message}
                              </p>
                            )}
                          </div>
                          <Button 
                            variant="outline" size="sm" className="gap-1"
                            onClick={() => handleRetryShipment(shipment.order_id)}
                          >
                            <Truck className="h-3 w-3" />
                            Reenviar
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t">
                          <Badge variant="outline" className="text-xs">
                            {shipment.carrier}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTimeBR(new Date(shipment.created_at))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dispatch Confirmation Dialog */}
      <Dialog open={!!dispatchDialog} onOpenChange={(open) => !open && setDispatchDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Confirmar Despacho
            </DialogTitle>
          </DialogHeader>
          
          {dispatchDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pedido</span>
                  <span className="font-medium">#{dispatchDialog.order?.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Cliente</span>
                  <span className="text-sm">{dispatchDialog.order?.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Rastreio</span>
                  <span className="text-sm font-mono">{dispatchDialog.tracking_code || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transportadora</span>
                  <span className="text-sm">{dispatchDialog.carrier}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Imprimir documentos:</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" size="sm" className="gap-1 flex-1"
                    onClick={() => handlePrintLabel(dispatchDialog)}
                    disabled={!dispatchDialog.label_url}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Etiqueta
                  </Button>
                  <Button 
                    variant="outline" size="sm" className="gap-1 flex-1"
                    onClick={() => handlePrintDanfe(dispatchDialog)}
                    disabled={!dispatchDialog.invoice_id}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    DANFE
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchDialog(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmDispatch} 
              disabled={isDispatching}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {isDispatching ? 'Despachando...' : 'Confirmar Despacho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
