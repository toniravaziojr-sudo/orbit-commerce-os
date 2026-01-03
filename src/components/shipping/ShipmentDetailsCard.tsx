import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ExternalLink, 
  Printer, 
  RefreshCw, 
  Copy, 
  CheckCircle,
  Truck,
  Package,
  MapPin,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ShipmentTimeline } from './ShipmentTimeline';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  status: string;
  description: string | null;
  location: string | null;
  occurred_at: string;
  created_at: string;
}

interface ShipmentDetailsCardProps {
  shipment: {
    id: string;
    order_id: string;
    tracking_code: string;
    carrier: string | null;
    delivery_status: DeliveryStatus;
    last_status_at: string | null;
    last_polled_at: string | null;
    next_poll_at: string | null;
    poll_error_count: number;
    last_poll_error: string | null;
    delivered_at: string | null;
    created_at: string;
    order?: {
      order_number: string;
      customer_name: string;
      customer_email: string;
    };
  };
  events: ShipmentEvent[];
  eventsLoading?: boolean;
}

const statusConfig: Record<DeliveryStatus, { label: string; color: string; icon: typeof Package }> = {
  label_created: { label: 'Etiqueta gerada', color: 'bg-gray-100 text-gray-800', icon: Package },
  posted: { label: 'Postado', color: 'bg-blue-100 text-blue-800', icon: Package },
  in_transit: { label: 'Em trânsito', color: 'bg-yellow-100 text-yellow-800', icon: Truck },
  out_for_delivery: { label: 'Saiu p/ entrega', color: 'bg-orange-100 text-orange-800', icon: MapPin },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: 'Falha', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  returned: { label: 'Devolvido', color: 'bg-purple-100 text-purple-800', icon: AlertTriangle },
  canceled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: AlertTriangle },
  unknown: { label: 'Desconhecido', color: 'bg-gray-100 text-gray-800', icon: Package },
};

const carrierTrackingUrls: Record<string, (code: string) => string> = {
  correios: (code) => `https://rastreamento.correios.com.br/app/index.php?codigo=${code}`,
  loggi: (code) => `https://www.loggi.com/rastreio/${code}`,
  jadlog: (code) => `https://www.jadlog.com.br/tracking?cte=${code}`,
};

export function ShipmentDetailsCard({ shipment, events, eventsLoading }: ShipmentDetailsCardProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const config = statusConfig[shipment.delivery_status] || statusConfig.unknown;
  const StatusIcon = config.icon;

  // Obter etiqueta
  const printLabel = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('shipping-get-label', {
        body: { 
          tracking_code: shipment.tracking_code,
          provider_shipment_id: (shipment as any).provider_shipment_id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao obter etiqueta');

      return data;
    },
    onSuccess: (data) => {
      if (data.label_url) {
        window.open(data.label_url, '_blank');
      } else if (data.label_base64) {
        // Converter base64 para URL e abrir
        const byteCharacters = atob(data.label_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.label_type || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        toast.info('Etiqueta não disponível');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Atualizar rastreamento
  const refreshTracking = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tracking-poll-single', {
        body: { shipment_id: shipment.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Rastreamento atualizado');
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['shipment-events', shipment.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCopyTracking = () => {
    navigator.clipboard.writeText(shipment.tracking_code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const trackingUrl = shipment.carrier 
    ? carrierTrackingUrls[shipment.carrier.toLowerCase()]?.(shipment.tracking_code)
    : null;

  return (
    <div className="space-y-4">
      {/* Status atual */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <div className={`flex items-center justify-center h-12 w-12 rounded-full ${config.color}`}>
          <StatusIcon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{config.label}</h3>
          {shipment.delivered_at ? (
            <p className="text-sm text-muted-foreground">
              Entregue em {format(new Date(shipment.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          ) : shipment.last_status_at ? (
            <p className="text-sm text-muted-foreground">
              Última atualização: {format(new Date(shipment.last_status_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          ) : null}
        </div>
      </div>

      {/* Informações do rastreio */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Código de Rastreio</p>
          <div className="flex items-center gap-2">
            <p className="font-mono font-semibold">{shipment.tracking_code}</p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyTracking}>
              {copied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Transportadora</p>
          <p className="font-medium">{shipment.carrier || '—'}</p>
        </div>
        {shipment.order && (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Pedido</p>
              <p className="font-medium">{shipment.order.order_number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-medium truncate">{shipment.order.customer_name}</p>
            </div>
          </>
        )}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => printLabel.mutate()}
          disabled={printLabel.isPending}
        >
          <Printer className="h-4 w-4 mr-2" />
          {printLabel.isPending ? 'Carregando...' : 'Imprimir Etiqueta'}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refreshTracking.mutate()}
          disabled={refreshTracking.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshTracking.isPending ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
        
        {trackingUrl && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.open(trackingUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Rastrear no site
          </Button>
        )}
      </div>

      {/* Erros de polling */}
      {shipment.poll_error_count > 0 && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              {shipment.poll_error_count} erro(s) ao consultar rastreamento
            </p>
            {shipment.last_poll_error && (
              <p className="text-xs text-orange-600 dark:text-orange-500">
                {shipment.last_poll_error}
              </p>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Timeline de eventos */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de Rastreamento
        </h4>
        <ShipmentTimeline events={events} isLoading={eventsLoading} />
      </div>
    </div>
  );
}
