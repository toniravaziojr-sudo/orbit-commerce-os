import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package, Truck, Printer, ExternalLink, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
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

interface GeneratedShipment {
  id: string;
  order_id: string;
  tracking_code: string;
  carrier: string;
  delivery_status: string;
  created_at: string;
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
  
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch pending orders (status = paid/processing, no shipment yet)
  const { data: pendingOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['orders-for-shipment', currentTenant?.id, selectedCarrier, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('orders')
        .select('id, order_number, customer_name, shipping_carrier, shipping_city, shipping_state, created_at, total')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['paid', 'processing'])
        .is('tracking_code', null)
        .order('created_at', { ascending: false });

      if (selectedCarrier !== 'all') {
        if (selectedCarrier === 'outros') {
          query = query.not('shipping_carrier', 'ilike', '%correios%')
            .not('shipping_carrier', 'ilike', '%loggi%')
            .not('shipping_carrier', 'ilike', '%frenet%');
        } else {
          query = query.ilike('shipping_carrier', `%${selectedCarrier}%`);
        }
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PendingOrder[];
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch generated shipments for selected carrier
  const { data: generatedShipments, isLoading: loadingShipments } = useQuery({
    queryKey: ['generated-shipments', currentTenant?.id, selectedCarrier, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('shipments')
        .select(`
          id, order_id, tracking_code, carrier, delivery_status, created_at,
          order:orders!inner(order_number, customer_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedCarrier !== 'all' && selectedCarrier !== 'outros') {
        query = query.ilike('carrier', `%${selectedCarrier}%`);
      } else if (selectedCarrier === 'outros') {
        query = query.not('carrier', 'ilike', '%correios%')
          .not('carrier', 'ilike', '%loggi%')
          .not('carrier', 'ilike', '%frenet%');
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GeneratedShipment[];
    },
    enabled: !!currentTenant?.id,
  });

  // Toggle order selection
  const toggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedOrders.size === (pendingOrders?.length || 0)) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(pendingOrders?.map(o => o.id) || []));
    }
  };

  // Generate shipments for selected orders
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
      toast.success(`${successCount} remessa(s) gerada(s) com sucesso`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} remessa(s) falharam`);
    }

    queryClient.invalidateQueries({ queryKey: ['orders-for-shipment'] });
    queryClient.invalidateQueries({ queryKey: ['generated-shipments'] });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
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

      {/* Main Content - Two Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Pending Orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Pedidos Pendentes de Remessa
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {pendingOrders?.length || 0} pedido(s)
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : !pendingOrders?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                Nenhum pedido pendente de remessa
              </div>
            ) : (
              <>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedOrders.size === pendingOrders.length && pendingOrders.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Frete</TableHead>
                        <TableHead>Destino</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOrders.map(order => (
                        <TableRow 
                          key={order.id}
                          className="cursor-pointer"
                          onClick={() => toggleOrder(order.id)}
                        >
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.has(order.id)}
                              onCheckedChange={() => toggleOrder(order.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            #{order.order_number}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {order.customer_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {order.shipping_carrier || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {order.shipping_city}/{order.shipping_state}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Action Bar */}
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
                      <>Gerando...</>
                    ) : (
                      <>
                        <Truck className="h-4 w-4" />
                        Gerar Remessa
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Generated Shipments */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Remessas Geradas
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {generatedShipments?.length || 0} remessa(s)
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loadingShipments ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : !generatedShipments?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                Nenhuma remessa gerada
              </div>
            ) : (
              <ScrollArea className="h-[440px]">
                <div className="space-y-3">
                  {generatedShipments.map(shipment => (
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
                          <p className="text-xs text-muted-foreground font-mono mt-1">
                            {shipment.tracking_code}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Imprimir etiqueta"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Rastrear"
                          >
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
      </div>
    </div>
  );
}
