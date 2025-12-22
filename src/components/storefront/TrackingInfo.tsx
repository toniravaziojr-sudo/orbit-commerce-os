// =============================================
// TRACKING INFO - Componente de rastreio para o Storefront
// Exibe informações de rastreio para o cliente
// =============================================

import { Package, Truck, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  deliveryStatusLabels, 
  type DeliveryStatus 
} from '@/hooks/useShipments';

interface TrackingInfoProps {
  trackingCode: string;
  carrier: string;
  deliveryStatus?: string;
  lastStatusAt?: string;
  deliveredAt?: string;
  compact?: boolean;
}

export function TrackingInfo({
  trackingCode,
  carrier,
  deliveryStatus = 'in_transit',
  lastStatusAt,
  deliveredAt,
  compact = false,
}: TrackingInfoProps) {
  const statusLabel = deliveryStatusLabels[deliveryStatus as DeliveryStatus] || deliveryStatus;
  const isDelivered = deliveryStatus === 'delivered';
  const trackingUrl = getTrackingUrl(carrier, trackingCode);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-xs">{trackingCode}</span>
        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {isDelivered ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Truck className="h-5 w-5 text-primary" />
          )}
          <div>
            <p className="font-medium text-sm">{carrier}</p>
            <p className="font-mono text-xs text-muted-foreground">{trackingCode}</p>
          </div>
        </div>
        <Badge variant={isDelivered ? 'default' : 'secondary'} className={isDelivered ? 'bg-green-600' : ''}>
          {statusLabel}
        </Badge>
      </div>

      {lastStatusAt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            Atualizado em {new Date(lastStatusAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      {deliveredAt && (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          <span>
            Entregue em {new Date(deliveredAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      <a
        href={trackingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
      >
        <ExternalLink className="h-4 w-4" />
        Rastrear encomenda
      </a>
    </div>
  );
}

// Helper para gerar URL de rastreio
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
  
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} ${trackingCode}`)}`;
}