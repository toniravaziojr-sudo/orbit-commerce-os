// =============================================
// SHIPMENT SECTION - Seção de remessas no detalhe do pedido
// =============================================

import { useState } from 'react';
import { Package, Truck, ExternalLink, ChevronDown, ChevronUp, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  useOrderShipments, 
  useShipmentEvents,
  deliveryStatusLabels, 
  deliveryStatusColors,
  type ShipmentRecord,
  type DeliveryStatus 
} from '@/hooks/useShipments';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ShipmentSectionProps {
  orderId: string;
  orderTrackingCode?: string | null;
  orderCarrier?: string | null;
}

export function ShipmentSection({ orderId, orderTrackingCode, orderCarrier }: ShipmentSectionProps) {
  const { data: shipments, isLoading } = useOrderShipments(orderId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Remessas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Se não tem remessas na tabela shipments, mostrar dados legados do pedido
  if (!shipments || shipments.length === 0) {
    if (orderTrackingCode) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Rastreio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderCarrier && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transportadora</span>
                <span>{orderCarrier}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Código</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                  {orderTrackingCode}
                </span>
                <a
                  href={`https://www.google.com/search?q=${orderTrackingCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Remessas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aguardando expedição</p>
            <p className="text-xs">O rastreio aparecerá aqui quando disponível</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Remessas ({shipments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {shipments.map((shipment, index) => (
          <ShipmentItem key={shipment.id} shipment={shipment} isFirst={index === 0} />
        ))}
      </CardContent>
    </Card>
  );
}

function ShipmentItem({ shipment, isFirst }: { shipment: ShipmentRecord; isFirst: boolean }) {
  const [isOpen, setIsOpen] = useState(isFirst);
  const { data: events } = useShipmentEvents(isOpen ? shipment.id : undefined);

  const statusLabel = deliveryStatusLabels[shipment.delivery_status as DeliveryStatus] || shipment.delivery_status;
  const statusColor = deliveryStatusColors[shipment.delivery_status as DeliveryStatus] || 'bg-gray-100 text-gray-800';

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{shipment.carrier}</p>
                <p className="font-mono text-xs text-muted-foreground">{shipment.tracking_code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColor}>{statusLabel}</Badge>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-3">
          <Separator className="mb-3" />
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última atualização</span>
              <span>{formatDate(shipment.last_status_at)}</span>
            </div>
            
            {shipment.delivered_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entregue em</span>
                <span className="text-green-600 font-medium">{formatDate(shipment.delivered_at)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-muted-foreground">Origem</span>
              <span className="capitalize">{shipment.source}</span>
            </div>

            {/* Info de polling */}
            {shipment.last_polled_at && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Última consulta</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        {shipment.last_poll_error === 'no_provider_adapter' ? (
                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                        ) : shipment.poll_error_count > 0 ? (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        ) : (
                          <RefreshCw className="h-3 w-3 text-green-500" />
                        )}
                        <span className="text-xs">{formatDate(shipment.last_polled_at)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {shipment.last_poll_error === 'no_provider_adapter' ? (
                        <p>Aguardando integração com transportadora</p>
                      ) : shipment.poll_error_count > 0 ? (
                        <p>Erro: {shipment.last_poll_error} ({shipment.poll_error_count}x)</p>
                      ) : (
                        <p>Atualização automática ativa</p>
                      )}
                      {shipment.next_poll_at && (
                        <p className="text-xs text-muted-foreground">
                          Próxima: {formatDate(shipment.next_poll_at)}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            {/* Link externo de rastreio */}
            <div className="pt-2">
              <a
                href={getTrackingUrl(shipment.carrier, shipment.tracking_code)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                Rastrear no site da transportadora
              </a>
            </div>
          </div>

          {/* Eventos de rastreio */}
          {events && events.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Histórico
                </p>
                <div className="space-y-2 pl-6 border-l-2 border-muted">
                  {events.map((event) => (
                    <div key={event.id} className="relative pl-4">
                      <div className="absolute -left-[9px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                      <p className="text-sm">{event.description || event.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.occurred_at)}
                        {event.location && ` • ${event.location}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Helper para gerar URL de rastreio por transportadora
function getTrackingUrl(carrier: string, trackingCode: string): string {
  const carrierLower = carrier.toLowerCase();
  
  if (carrierLower.includes('correios') || carrierLower.includes('sedex') || carrierLower.includes('pac')) {
    return `https://www.linkcorreios.com.br/?id=${trackingCode}`;
  }
  
  if (carrierLower.includes('loggi')) {
    return `https://www.loggi.com/rastreador/${trackingCode}`;
  }
  
  if (carrierLower.includes('jadlog')) {
    return `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${trackingCode}`;
  }
  
  if (carrierLower.includes('total express') || carrierLower.includes('totalexpress')) {
    return `https://tracking.totalexpress.com.br/?code=${trackingCode}`;
  }
  
  // Fallback: busca no Google
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} ${trackingCode}`)}`;
}