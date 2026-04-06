import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package, Truck, Printer, ExternalLink, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface PendingOrder {
  id: string;
  order_number: string;
  customer_name: string;
  shipping_carrier: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  created_at: string;
  total: number;
}

interface ShipmentRecord {
  id: string;
  order_id: string;
  tracking_code: string;
  carrier: string;
  delivery_status: string;
  created_at: string;
  source: string | null;
  metadata: any;
  order?: {
    order_number: string;
    customer_name: string;
  };
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
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);

  // === TAB 1: Prontos para emitir remessa ===
  // Orders with draft shipments (auto-created by scheduler) OR paid orders without shipment
  const { data: readyOrders, isLoading: loadingReady } = useQuery({
    queryKey: ['orders-ready-shipment', currentTenant?.id, selectedCarrier, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      // Get draft shipments with order data
      let query = supabase
        .from('shipments')
        .select(`
          id, order_id, carrier, delivery_status, created_at, source, metadata,
          order:orders!inner(id, order_number, customer_name, shipping_carrier, shipping_city, shipping_state, total, created_at)
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

  // === TAB 2: Remessas emitidas (success - has tracking, not draft/failed) ===
  const { data: issuedShipments, isLoading: loadingIssued } = useQuery({
    queryKey: ['shipments-issued', currentTenant?.id, selectedCarrier, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('shipments')
        .select(`
          id, order_id, tracking_code, carrier, delivery_status, created_at, source, metadata,
          order:orders!inner(order_number, customer_name)
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

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ShipmentRecord[];
    },
    enabled: !!currentTenant?.id,
  });

  // === TAB 3: Remessas pendentes (failed/error) ===
  const { data: failedShipments, isLoading: loadingFailed } = useQuery({
    queryKey: ['shipments-failed', currentTenant?.id, selectedCarrier],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('shipments')
        .select(`
          id, order_id, tracking_code, carrier, delivery_status, created_at, source, metadata,
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

  const toggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
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
    
    if (successCount > 0) {
      toast.success(`${successCount} remessa(s) emitida(s) com sucesso`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} remessa(s) falharam`);
    }

    queryClient.invalidateQueries({ queryKey: ['orders-ready-shipment'] });
    queryClient.invalidateQueries({ queryKey: ['shipments-issued'] });
    queryClient.invalidateQueries({ queryKey: ['shipments-failed'] });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Rascunho', variant: 'outline' },
      label_created: { label: 'Etiqueta', variant: 'outline' },
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
            Prontos para emitir remessa
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
            Remessas pendentes
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {readyOrders!.map(shipment => {
                          const order = shipment.order as any;
                          const meta = shipment.metadata as any;
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
                          Emitir Remessa
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
                <span className="text-sm text-muted-foreground">
                  {issuedCount} remessa(s)
                </span>
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
                  <div className="space-y-3">
                    {issuedShipments!.map(shipment => (
                      <div
                        key={shipment.id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
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
                            {shipment.tracking_code && (
                              <p className="text-xs text-muted-foreground font-mono mt-1">
                                {shipment.tracking_code}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir etiqueta">
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Rastrear">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t">
                          <Badge variant="outline" className="text-xs">
                            {shipment.carrier}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(shipment.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
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
                          <Button variant="outline" size="sm" className="gap-1">
                            <Truck className="h-3 w-3" />
                            Reenviar
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t">
                          <Badge variant="outline" className="text-xs">
                            {shipment.carrier}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(shipment.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
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
    </div>
  );
}
