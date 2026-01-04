import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Truck, 
  Package, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Plus,
  Settings,
  TrendingUp,
  ArrowRight,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';
import { CreateShipmentDialog } from '@/components/shipping/CreateShipmentDialog';
import { CarrierCardsGrid } from '@/components/shipping/CarrierCardsGrid';
import { TrackingLookup } from '@/components/shipping/TrackingLookup';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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
  created_at: string;
  delivered_at: string | null;
  order?: {
    order_number: string;
    customer_name: string;
  };
}

const statusConfig: Record<DeliveryStatus, { label: string; color: string }> = {
  label_created: { label: 'Etiqueta', color: 'hsl(var(--muted-foreground))' },
  posted: { label: 'Postado', color: 'hsl(220, 70%, 50%)' },
  in_transit: { label: 'Em trânsito', color: 'hsl(220, 70%, 50%)' },
  out_for_delivery: { label: 'Saiu p/ entrega', color: 'hsl(45, 90%, 45%)' },
  delivered: { label: 'Entregue', color: 'hsl(142, 70%, 45%)' },
  failed: { label: 'Falha', color: 'hsl(0, 70%, 50%)' },
  returned: { label: 'Devolvido', color: 'hsl(0, 70%, 50%)' },
  canceled: { label: 'Cancelado', color: 'hsl(0, 70%, 50%)' },
  unknown: { label: 'Desconhecido', color: 'hsl(var(--muted-foreground))' },
};

const CARRIER_COLORS = {
  correios: 'hsl(220, 70%, 50%)',
  loggi: 'hsl(142, 70%, 45%)',
  frenet: 'hsl(30, 90%, 50%)',
  outros: 'hsl(var(--muted-foreground))',
};

export default function ShippingDashboard() {
  const { currentTenant, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  
  const isOwnerOrAdmin = hasRole('owner') || hasRole('admin');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Fetch shipments for stats and charts
  const { data: shipments, isLoading } = useQuery({
    queryKey: ['shipping-dashboard', currentTenant?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      let query = supabase
        .from('shipments')
        .select(`
          *,
          order:orders!inner(order_number, customer_name)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(500);
      
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
      return data as ShipmentRecord[];
    },
    enabled: !!currentTenant?.id,
  });

  // Manual poll mutation
  const runTrackingPoll = useMutation({
    mutationFn: async () => {
      setIsPolling(true);
      const { data, error } = await supabase.functions.invoke('tracking-poll');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const stats = data.stats || {};
      toast.success(`Rastreios atualizados: ${stats.updated || 0} de ${stats.processed || 0}`);
      queryClient.invalidateQueries({ queryKey: ['shipping-dashboard'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
    onSettled: () => {
      setIsPolling(false);
    },
  });

  // Calculate stats
  const stats = {
    total: shipments?.length || 0,
    inTransit: shipments?.filter(s => ['posted', 'in_transit', 'out_for_delivery'].includes(s.delivery_status)).length || 0,
    delivered: shipments?.filter(s => s.delivery_status === 'delivered').length || 0,
    failed: shipments?.filter(s => ['failed', 'returned', 'canceled'].includes(s.delivery_status)).length || 0,
  };

  const successRate = stats.total > 0 
    ? Math.round((stats.delivered / stats.total) * 100) 
    : 0;

  // Data for status pie chart
  const statusChartData = Object.entries(
    (shipments || []).reduce((acc, s) => {
      acc[s.delivery_status] = (acc[s.delivery_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([status, count]) => ({
    name: statusConfig[status as DeliveryStatus]?.label || status,
    value: count,
    color: statusConfig[status as DeliveryStatus]?.color || 'hsl(var(--muted))',
  }));

  // Data for carrier bar chart
  const carrierChartData = [
    { name: 'Correios', value: shipments?.filter(s => s.carrier?.toLowerCase() === 'correios').length || 0, fill: CARRIER_COLORS.correios },
    { name: 'Loggi', value: shipments?.filter(s => s.carrier?.toLowerCase() === 'loggi').length || 0, fill: CARRIER_COLORS.loggi },
    { name: 'Frenet', value: shipments?.filter(s => s.carrier?.toLowerCase() === 'frenet').length || 0, fill: CARRIER_COLORS.frenet },
    { name: 'Outros', value: shipments?.filter(s => s.carrier && !['correios', 'loggi', 'frenet'].includes(s.carrier.toLowerCase())).length || 0, fill: CARRIER_COLORS.outros },
  ].filter(d => d.value > 0);

  // Recent shipments
  const recentShipments = (shipments || []).slice(0, 10);

  const getStatusBadgeVariant = (status: DeliveryStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status === 'delivered') return 'default';
    if (['failed', 'returned', 'canceled'].includes(status)) return 'destructive';
    if (['in_transit', 'posted', 'out_for_delivery'].includes(status)) return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Logística"
        description="Gerencie remessas, rastreamento e transportadoras"
        actions={
          isOwnerOrAdmin && (
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => runTrackingPoll.mutate()}
              disabled={isPolling}
            >
              <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          )
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="remessas" className="gap-2">
            <Truck className="h-4 w-4" />
            Remessas
          </TabsTrigger>
          <TabsTrigger value="rastreios" className="gap-2">
            <Search className="h-4 w-4" />
            Rastreios
          </TabsTrigger>
          <TabsTrigger value="meios-transporte" className="gap-2">
            <Settings className="h-4 w-4" />
            Meios de Transporte
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {/* Date Filter */}
          <div className="flex justify-end">
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

          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-5">
            <StatCard
              title="Total de Remessas"
              value={stats.total}
              icon={Package}
              variant="default"
            />
            <StatCard
              title="Em Trânsito"
              value={stats.inTransit}
              icon={Truck}
              variant="primary"
            />
            <StatCard
              title="Entregues"
              value={stats.delivered}
              icon={CheckCircle}
              variant="success"
            />
            <StatCard
              title="Com Problemas"
              value={stats.failed}
              icon={AlertTriangle}
              variant="destructive"
            />
            <StatCard
              title="Taxa de Sucesso"
              value={`${successRate}%`}
              icon={TrendingUp}
              variant="success"
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Carrier Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Remessas por Transportadora</CardTitle>
              </CardHeader>
              <CardContent>
                {carrierChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={carrierChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {carrierChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Shipments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Últimas Remessas</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1"
                onClick={() => handleTabChange('remessas')}
              >
                Ver todas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : recentShipments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma remessa encontrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Transportadora</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentShipments.map(shipment => (
                      <TableRow 
                        key={shipment.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          handleTabChange('rastreios');
                        }}
                      >
                        <TableCell className="font-medium">
                          #{shipment.order?.order_number || '—'}
                        </TableCell>
                        <TableCell>{shipment.order?.customer_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {shipment.carrier || 'Não definido'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(shipment.delivery_status)}>
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remessas Tab */}
        <TabsContent value="remessas" className="mt-6 space-y-6">
          {/* Action Button */}
          <div className="flex justify-end">
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Criar Remessa
            </Button>
          </div>

          {/* Redirect to full shipments page */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Gerenciar Remessas</h3>
                <p className="text-muted-foreground mb-4">
                  Acesse a página completa de remessas para visualizar, filtrar e gerenciar todas as entregas.
                </p>
                <Button onClick={() => navigate('/shipping/shipments')}>
                  Ir para Lista de Remessas
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rastreios Tab */}
        <TabsContent value="rastreios" className="mt-6">
          <TrackingLookup />
        </TabsContent>

        {/* Meios de Transporte Tab */}
        <TabsContent value="meios-transporte" className="mt-6">
          <CarrierCardsGrid />
        </TabsContent>
      </Tabs>

      <CreateShipmentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
