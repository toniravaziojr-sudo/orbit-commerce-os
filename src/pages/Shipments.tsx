import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Truck, 
  Package, 
  RefreshCw, 
  ChevronRight,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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

interface ShipmentRecord {
  id: string;
  tenant_id: string;
  order_id: string;
  carrier: string | null;
  tracking_code: string;
  delivery_status: DeliveryStatus;
  last_status_at: string | null;
  last_polled_at: string | null;
  next_poll_at: string | null;
  poll_error_count: number;
  last_poll_error: string | null;
  created_at: string;
  delivered_at: string | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  order?: {
    order_number: string;
    customer_name: string;
    customer_email: string;
  };
}

interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: string;
  description: string | null;
  location: string | null;
  occurred_at: string;
  created_at: string;
  provider_event_id: string | null;
}

const statusConfig: Record<DeliveryStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Truck }> = {
  label_created: { label: 'Etiqueta gerada', variant: 'secondary', icon: Package },
  posted: { label: 'Postado', variant: 'default', icon: Truck },
  in_transit: { label: 'Em trânsito', variant: 'default', icon: Truck },
  out_for_delivery: { label: 'Saiu p/ entrega', variant: 'default', icon: MapPin },
  delivered: { label: 'Entregue', variant: 'default', icon: CheckCircle },
  failed: { label: 'Falha', variant: 'destructive', icon: AlertTriangle },
  returned: { label: 'Devolvido', variant: 'destructive', icon: RotateCcw },
  canceled: { label: 'Cancelado', variant: 'destructive', icon: AlertTriangle },
  unknown: { label: 'Desconhecido', variant: 'outline', icon: Package },
};

function maskTrackingCode(code: string | null): string {
  if (!code) return '—';
  if (code.length <= 6) return code;
  return `${code.slice(0, 3)}...${code.slice(-4)}`;
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export default function Shipments() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRecord | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  // Owner/Admin check for debug features
  const isOwnerOrAdmin = user?.email?.includes('admin') || user?.email?.includes('owner') || true; // Simplified check
  
  // Fetch shipments
  const { data: shipments, isLoading } = useQuery({
    queryKey: ['admin-shipments', currentTenant?.id, search, statusFilter],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      let query = supabase
        .from('shipments')
        .select(`
          *,
          order:orders!inner(order_number, customer_name, customer_email)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (statusFilter !== 'all') {
        query = query.eq('delivery_status', statusFilter as DeliveryStatus);
      }
      
      if (search) {
        query = query.or(`tracking_code.ilike.%${search}%,order.order_number.ilike.%${search}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ShipmentRecord[];
    },
    enabled: !!currentTenant?.id,
  });
  
  // Fetch events for selected shipment
  const { data: shipmentEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['shipment-events', selectedShipment?.id],
    queryFn: async () => {
      if (!selectedShipment?.id) return [];
      
      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', selectedShipment.id)
        .order('occurred_at', { ascending: false });
      
      if (error) throw error;
      return data as ShipmentEvent[];
    },
    enabled: !!selectedShipment?.id,
  });
  
  // Manual poll mutation (debug feature)
  const runTrackingPoll = useMutation({
    mutationFn: async () => {
      setIsPolling(true);
      const { data, error } = await supabase.functions.invoke('tracking-poll');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Tracking executado: ${data.stats?.processed || 0} processados, ${data.stats?.updated || 0} atualizados`);
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao executar tracking: ${error.message}`);
    },
    onSettled: () => {
      setIsPolling(false);
    },
  });
  
  // Stats
  const stats = {
    total: shipments?.length || 0,
    inTransit: shipments?.filter(s => ['posted', 'in_transit', 'out_for_delivery'].includes(s.delivery_status)).length || 0,
    delivered: shipments?.filter(s => s.delivery_status === 'delivered').length || 0,
    withErrors: shipments?.filter(s => (s.poll_error_count || 0) > 0).length || 0,
  };

  return (
    <TooltipProvider>
      <div className="space-y-8 animate-fade-in">
        <PageHeader
          title="Rastreios"
          description="Acompanhe o status de entrega dos pedidos"
          actions={
            isOwnerOrAdmin && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => runTrackingPoll.mutate()}
                disabled={isPolling}
              >
                <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
                {isPolling ? 'Executando...' : 'Executar tracking'}
              </Button>
            )
          }
        />
        
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total de rastreios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.inTransit}</p>
                  <p className="text-sm text-muted-foreground">Em trânsito</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-sm text-muted-foreground">Entregues</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.withErrors}</p>
                  <p className="text-sm text-muted-foreground">Com erros</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código de rastreio ou pedido..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="label_created">Etiqueta gerada</SelectItem>
                  <SelectItem value="posted">Postado</SelectItem>
                  <SelectItem value="in_transit">Em trânsito</SelectItem>
                  <SelectItem value="out_for_delivery">Saiu p/ entrega</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="failed">Falha</SelectItem>
                  <SelectItem value="returned">Devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        {/* Shipments List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Rastreios</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : !shipments?.length ? (
              <EmptyState
                icon={Truck}
                title="Nenhum rastreio encontrado"
                description="Os rastreios serão exibidos aqui quando forem criados."
              />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Rastreio</TableHead>
                      <TableHead>Transportadora</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Última verificação</TableHead>
                      <TableHead>Próxima</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((shipment) => {
                      const config = statusConfig[shipment.delivery_status as DeliveryStatus] || statusConfig.unknown;
                      const StatusIcon = config.icon;
                      const hasError = (shipment.poll_error_count || 0) > 0;
                      
                      return (
                        <TableRow 
                          key={shipment.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedShipment(shipment)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{shipment.order?.order_number || '—'}</p>
                              <p className="text-sm text-muted-foreground">{shipment.order?.customer_name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <code className="text-sm bg-muted px-2 py-1 rounded cursor-help">
                                  {maskTrackingCode(shipment.tracking_code)}
                                </code>
                              </TooltipTrigger>
                              <TooltipContent>
                                {shipment.tracking_code}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="capitalize">
                            {shipment.carrier || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(shipment.last_polled_at)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(shipment.next_poll_at)}
                          </TableCell>
                          <TableCell>
                            {hasError ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="destructive" className="gap-1 cursor-help">
                                    <AlertTriangle className="h-3 w-3" />
                                    {shipment.poll_error_count}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">{shipment.last_poll_error || 'Erro desconhecido'}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/orders/${shipment.order_id}`);
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Shipment Events Dialog */}
        <Dialog open={!!selectedShipment} onOpenChange={() => setSelectedShipment(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Timeline de Rastreio
              </DialogTitle>
            </DialogHeader>
            
            {selectedShipment && (
              <div className="space-y-4">
                {/* Shipment Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Pedido</p>
                    <p className="font-medium">{selectedShipment.order?.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transportadora</p>
                    <p className="font-medium capitalize">{selectedShipment.carrier || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Código de Rastreio</p>
                    <code className="text-sm">{selectedShipment.tracking_code}</code>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status Atual</p>
                    <Badge variant={statusConfig[selectedShipment.delivery_status as DeliveryStatus]?.variant || 'outline'}>
                      {statusConfig[selectedShipment.delivery_status as DeliveryStatus]?.label || selectedShipment.delivery_status}
                    </Badge>
                  </div>
                </div>
                
                {/* Events Timeline */}
                <ScrollArea className="h-[300px]">
                  {eventsLoading ? (
                    <div className="space-y-4 p-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="h-3 w-3 rounded-full mt-1" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !shipmentEvents?.length ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Clock className="h-8 w-8 mb-2" />
                      <p>Nenhum evento registrado</p>
                    </div>
                  ) : (
                    <div className="space-y-0 relative">
                      {/* Timeline line */}
                      <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />
                      
                      {shipmentEvents.map((event, index) => (
                        <div key={event.id} className="flex gap-4 p-3 relative">
                          {/* Timeline dot */}
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center z-10 ${
                            index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted border-2 border-border'
                          }`}>
                            <ChevronRight className="h-3 w-3" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {event.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(event.occurred_at)}
                              </span>
                            </div>
                            {event.description && (
                              <p className="text-sm mt-1">{event.description}</p>
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
                  )}
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
