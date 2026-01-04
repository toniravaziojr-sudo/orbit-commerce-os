import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Package, 
  Truck, 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  RotateCcw,
  Clock,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: string;
  description: string | null;
  location: string | null;
  occurred_at: string;
  created_at: string;
}

interface ShipmentRecord {
  id: string;
  tracking_code: string;
  carrier: string | null;
  delivery_status: DeliveryStatus;
  created_at: string;
  delivered_at: string | null;
  order?: {
    order_number: string;
    customer_name: string;
  };
}

const statusConfig: Record<DeliveryStatus, { label: string; icon: typeof Truck; color: string }> = {
  label_created: { label: 'Etiqueta gerada', icon: Package, color: 'text-muted-foreground' },
  posted: { label: 'Postado', icon: Truck, color: 'text-blue-500' },
  in_transit: { label: 'Em trânsito', icon: Truck, color: 'text-blue-500' },
  out_for_delivery: { label: 'Saiu p/ entrega', icon: MapPin, color: 'text-amber-500' },
  delivered: { label: 'Entregue', icon: CheckCircle, color: 'text-green-500' },
  failed: { label: 'Falha', icon: AlertTriangle, color: 'text-red-500' },
  returned: { label: 'Devolvido', icon: RotateCcw, color: 'text-red-500' },
  canceled: { label: 'Cancelado', icon: AlertTriangle, color: 'text-red-500' },
  unknown: { label: 'Desconhecido', icon: Package, color: 'text-muted-foreground' },
};

export function TrackingLookup() {
  const { currentTenant } = useAuth();
  const [searchCode, setSearchCode] = useState('');
  const [searchedCode, setSearchedCode] = useState('');

  // Fetch shipment by tracking code
  const { data: shipment, isLoading: loadingShipment, error } = useQuery({
    queryKey: ['tracking-lookup', currentTenant?.id, searchedCode],
    queryFn: async () => {
      if (!currentTenant?.id || !searchedCode) return null;
      
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          order:orders!inner(order_number, customer_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .ilike('tracking_code', `%${searchedCode}%`)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as ShipmentRecord | null;
    },
    enabled: !!currentTenant?.id && !!searchedCode,
  });

  // Fetch events for found shipment
  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ['tracking-events', shipment?.id],
    queryFn: async () => {
      if (!shipment?.id) return [];
      
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', shipment.id)
        .order('occurred_at', { ascending: false });
      
      if (error) throw error;
      return data as ShipmentEvent[];
    },
    enabled: !!shipment?.id,
  });

  const handleSearch = () => {
    if (searchCode.trim()) {
      setSearchedCode(searchCode.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const config = shipment ? statusConfig[shipment.delivery_status] : null;
  const StatusIcon = config?.icon || Package;

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consultar Rastreio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Digite o código de rastreio..."
                className="pl-9"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button onClick={handleSearch} disabled={!searchCode.trim()}>
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loadingShipment && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {searchedCode && !loadingShipment && !shipment && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum rastreio encontrado para "{searchedCode}"</p>
              <p className="text-sm mt-2">Verifique se o código está correto</p>
            </div>
          </CardContent>
        </Card>
      )}

      {shipment && config && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon className={`h-6 w-6 ${config.color}`} />
                <div>
                  <CardTitle className="text-lg">{shipment.tracking_code}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Pedido #{shipment.order?.order_number} • {shipment.order?.customer_name}
                  </p>
                </div>
              </div>
              <Badge variant={shipment.delivery_status === 'delivered' ? 'default' : 'secondary'}>
                {config.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
              <span>Transportadora: <strong className="text-foreground">{shipment.carrier || 'Não definido'}</strong></span>
              <span>Criado em: <strong className="text-foreground">{format(new Date(shipment.created_at), "dd/MM/yyyy", { locale: ptBR })}</strong></span>
              {shipment.delivered_at && (
                <span>Entregue em: <strong className="text-foreground">{format(new Date(shipment.delivered_at), "dd/MM/yyyy", { locale: ptBR })}</strong></span>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Histórico de Eventos</h4>
              {loadingEvents ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : events && events.length > 0 ? (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
                    
                    {events.map((event, index) => (
                      <div key={event.id} className="relative pl-8 pb-6 last:pb-0">
                        {/* Timeline dot */}
                        <div className={`absolute left-0 w-4 h-4 rounded-full border-2 ${
                          index === 0 ? 'bg-primary border-primary' : 'bg-background border-border'
                        }`} />
                        
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{event.status}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(event.occurred_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                          )}
                          {event.location && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum evento registrado ainda</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
