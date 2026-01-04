import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Truck, CheckCircle, AlertTriangle, RotateCcw, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useShipmentEvents } from '@/hooks/useShipments';

type DeliveryStatus = 
  | 'label_created' 
  | 'posted' 
  | 'in_transit' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'failed' 
  | 'returned' 
  | 'canceled' 
  | 'unknown';

interface ShipmentWithOrder {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_code: string;
  delivery_status: DeliveryStatus;
  created_at: string;
  delivered_at: string | null;
  order: {
    order_number: string;
    customer_name: string;
    customer_email: string;
  };
}

const statusConfig: Record<DeliveryStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  label_created: { label: 'Etiqueta', variant: 'outline' },
  posted: { label: 'Postado', variant: 'secondary' },
  in_transit: { label: 'Em trânsito', variant: 'secondary' },
  out_for_delivery: { label: 'Saiu p/ entrega', variant: 'secondary' },
  delivered: { label: 'Entregue', variant: 'default' },
  failed: { label: 'Falha', variant: 'destructive' },
  returned: { label: 'Devolvido', variant: 'destructive' },
  canceled: { label: 'Cancelado', variant: 'destructive' },
  unknown: { label: 'Desconhecido', variant: 'outline' },
};

const CARRIERS = [
  { value: 'all', label: 'Todas Transportadoras' },
  { value: 'correios', label: 'Correios' },
  { value: 'loggi', label: 'Loggi' },
  { value: 'frenet', label: 'Frenet' },
  { value: 'outros', label: 'Outros' },
];

type SubTab = 'in_transit' | 'delivered' | 'problems' | 'returned';

interface TrackingTabProps {
  initialSubTab?: SubTab;
}

export function TrackingTab({ initialSubTab = 'in_transit' }: TrackingTabProps) {
  const { currentTenant } = useAuth();
  
  // Default: last 7 days
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(initialSubTab);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentWithOrder | null>(null);

  // Fetch all shipments
  const { data: allShipments, isLoading } = useQuery({
    queryKey: ['tracking-shipments', currentTenant?.id, startDate?.toISOString(), endDate?.toISOString(), selectedCarrier],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('shipments')
        .select(`
          id, order_id, carrier, tracking_code, delivery_status, created_at, delivered_at,
          order:orders!inner(order_number, customer_name, customer_email)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      if (selectedCarrier !== 'all') {
        if (selectedCarrier === 'outros') {
          query = query.not('carrier', 'ilike', '%correios%')
            .not('carrier', 'ilike', '%loggi%')
            .not('carrier', 'ilike', '%frenet%');
        } else {
          query = query.ilike('carrier', `%${selectedCarrier}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ShipmentWithOrder[];
    },
    enabled: !!currentTenant?.id,
  });

  // Filter by sub-tab and search
  const filteredShipments = useMemo(() => {
    let filtered = allShipments || [];

    // Filter by sub-tab
    switch (activeSubTab) {
      case 'in_transit':
        filtered = filtered.filter(s => ['posted', 'in_transit', 'out_for_delivery', 'label_created'].includes(s.delivery_status));
        break;
      case 'delivered':
        filtered = filtered.filter(s => s.delivery_status === 'delivered');
        break;
      case 'problems':
        filtered = filtered.filter(s => ['failed', 'canceled'].includes(s.delivery_status));
        break;
      case 'returned':
        filtered = filtered.filter(s => s.delivery_status === 'returned');
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.order.order_number.toLowerCase().includes(query) ||
        s.tracking_code.toLowerCase().includes(query) ||
        s.order.customer_name.toLowerCase().includes(query) ||
        s.order.customer_email.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allShipments, activeSubTab, searchQuery]);

  // Count per sub-tab
  const counts = useMemo(() => {
    const shipments = allShipments || [];
    return {
      in_transit: shipments.filter(s => ['posted', 'in_transit', 'out_for_delivery', 'label_created'].includes(s.delivery_status)).length,
      delivered: shipments.filter(s => s.delivery_status === 'delivered').length,
      problems: shipments.filter(s => ['failed', 'canceled'].includes(s.delivery_status)).length,
      returned: shipments.filter(s => s.delivery_status === 'returned').length,
    };
  }, [allShipments]);

  // Shipment events for detail modal
  const { data: shipmentEvents, isLoading: loadingEvents } = useShipmentEvents(selectedShipment?.id);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          label="Período"
        />

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

        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pedido, rastreio, nome ou email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as SubTab)}>
        <TabsList>
          <TabsTrigger value="in_transit" className="gap-2">
            <Truck className="h-4 w-4" />
            Em Trânsito
            <Badge variant="secondary" className="ml-1">{counts.in_transit}</Badge>
          </TabsTrigger>
          <TabsTrigger value="delivered" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Entregues
            <Badge variant="secondary" className="ml-1">{counts.delivered}</Badge>
          </TabsTrigger>
          <TabsTrigger value="problems" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Com Problemas
            <Badge variant="secondary" className="ml-1">{counts.problems}</Badge>
          </TabsTrigger>
          <TabsTrigger value="returned" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Em Devolução
            <Badge variant="secondary" className="ml-1">{counts.returned}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Content - same for all tabs, filtered by activeSubTab */}
        <TabsContent value={activeSubTab} className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : filteredShipments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum rastreio encontrado</p>
                  <p className="text-sm mt-1">Ajuste os filtros para ver resultados</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Código de Rastreio</TableHead>
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredShipments.map(shipment => (
                        <TableRow 
                          key={shipment.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedShipment(shipment)}
                        >
                          <TableCell className="font-medium">
                            #{shipment.order.order_number}
                          </TableCell>
                          <TableCell>{shipment.order.customer_name}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {shipment.tracking_code}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{shipment.carrier || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig[shipment.delivery_status]?.variant || 'outline'}>
                              {statusConfig[shipment.delivery_status]?.label || shipment.delivery_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(shipment.created_at), 'dd/MM/yyyy', { locale: ptBR })}
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
      </Tabs>

      {/* Detail Modal */}
      <Dialog open={!!selectedShipment} onOpenChange={(open) => !open && setSelectedShipment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Rastreamento - #{selectedShipment?.order.order_number}
            </DialogTitle>
          </DialogHeader>

          {selectedShipment && (
            <div className="space-y-4">
              {/* Shipment Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedShipment.order.customer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Transportadora</p>
                  <p className="font-medium">{selectedShipment.carrier || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Código de Rastreio</p>
                  <p className="font-mono font-medium">{selectedShipment.tracking_code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status Atual</p>
                  <Badge variant={statusConfig[selectedShipment.delivery_status]?.variant || 'outline'}>
                    {statusConfig[selectedShipment.delivery_status]?.label || selectedShipment.delivery_status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Data de Criação</p>
                  <p className="font-medium">
                    {format(new Date(selectedShipment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Events Timeline */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Histórico de Eventos</h4>
                {loadingEvents ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : !shipmentEvents?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum evento registrado
                  </p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {shipmentEvents.map((event, index) => (
                        <div key={event.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                            {index < shipmentEvents.length - 1 && (
                              <div className="w-0.5 flex-1 bg-border mt-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-3">
                            <p className="font-medium text-sm">{event.status}</p>
                            {event.description && (
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                            )}
                            {event.location && (
                              <p className="text-xs text-muted-foreground">{event.location}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(event.occurred_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
