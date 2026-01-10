import { useState, useEffect } from 'react';
import { 
  Truck, 
  Settings, 
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  RefreshCw,
  Gift,
  DollarSign
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useShipments, type Shipment } from '@/hooks/useShipments';
import { ShippingCarrierSettings } from '@/components/shipping/ShippingCarrierSettings';
import { FreeShippingRulesTab } from '@/components/shipping/FreeShippingRulesTab';
import { CustomShippingRulesTab } from '@/components/shipping/CustomShippingRulesTab';

const PAGE_SIZE = 20;

const shippingStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  processing: { label: 'Processando', variant: 'outline', icon: RefreshCw },
  shipped: { label: 'Enviado', variant: 'default', icon: Truck },
  in_transit: { label: 'Em Trânsito', variant: 'default', icon: Truck },
  out_for_delivery: { label: 'Saiu para Entrega', variant: 'default', icon: MapPin },
  delivered: { label: 'Entregue', variant: 'default', icon: CheckCircle },
  returned: { label: 'Devolvido', variant: 'destructive', icon: AlertCircle },
  failed: { label: 'Falhou', variant: 'destructive', icon: AlertCircle },
};

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export default function Shipping() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'shipments');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (tabFromUrl && ['shipments', 'settings', 'frete-gratis', 'frete-personalizado'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const { shipments, stats, totalCount, isLoading } = useShipments({
    page: currentPage,
    pageSize: PAGE_SIZE,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Envios"
        description="Gestão de entregas, rastreamento e transportadoras"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Aguardando Envio"
          value={stats.pendingCount.toString()}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Em Trânsito"
          value={stats.inTransitCount.toString()}
          icon={Truck}
          variant="primary"
        />
        <StatCard
          title="Entregues (Mês)"
          value={stats.deliveredCount.toString()}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Taxa de Entrega"
          value={`${stats.deliveryRate.toFixed(1)}%`}
          icon={Package}
          variant="info"
        />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="shipments" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Envios</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Transportadoras</span>
          </TabsTrigger>
          <TabsTrigger value="frete-gratis" className="gap-2">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Frete Grátis</span>
          </TabsTrigger>
          <TabsTrigger value="frete-personalizado" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Frete Personalizado</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shipments" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                >
                  Todos
                </Button>
                {Object.entries(shippingStatusConfig).map(([key, config]) => (
                  <Button
                    key={key}
                    variant={statusFilter === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                  >
                    {config.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shipments List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Envios
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({totalCount} {totalCount === 1 ? 'envio' : 'envios'})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : shipments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum envio encontrado</p>
                  <p className="text-sm mt-1">Os envios dos pedidos aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shipments.map((shipment) => {
                    const statusConfig = shippingStatusConfig[shipment.shipping_status] || shippingStatusConfig.pending;
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <div 
                        key={shipment.id} 
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/orders/${shipment.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            shipment.shipping_status === 'delivered' ? 'bg-green-100 text-green-600' :
                            shipment.shipping_status === 'in_transit' || shipment.shipping_status === 'shipped' ? 'bg-blue-100 text-blue-600' :
                            shipment.shipping_status === 'pending' || shipment.shipping_status === 'processing' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            <StatusIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{shipment.order_number}</span>
                              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {shipment.customer_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {shipment.shipping_city && `${shipment.shipping_city} - ${shipment.shipping_state}`}
                              {!shipment.shipping_city && 'Endereço não informado'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          <div>
                            {shipment.tracking_code ? (
                              <>
                                <p className="font-mono text-sm">{shipment.tracking_code}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {shipment.shipping_carrier || 'Sem transportadora'}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">Sem rastreio</p>
                            )}
                            {shipment.shipped_at && (
                              <p className="text-xs text-muted-foreground">
                                Enviado em {formatDateTime(shipment.shipped_at)}
                              </p>
                            )}
                          </div>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} a {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || isLoading}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <ShippingCarrierSettings />
        </TabsContent>

        <TabsContent value="frete-gratis">
          <FreeShippingRulesTab />
        </TabsContent>

        <TabsContent value="frete-personalizado">
          <CustomShippingRulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
