import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Package, 
  Truck, 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  RotateCcw,
  Clock,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ShipmentEvent {
  id: string;
  status: string;
  description: string | null;
  location: string | null;
  occurred_at: string;
  created_at: string;
}

interface ShipmentTimelineProps {
  events: ShipmentEvent[];
  isLoading?: boolean;
}

const statusIcons: Record<string, typeof Package> = {
  'label_created': Package,
  'posted': Package,
  'in_transit': Truck,
  'out_for_delivery': MapPin,
  'delivered': CheckCircle,
  'failed': AlertTriangle,
  'returned': RotateCcw,
  'default': Clock,
};

const statusColors: Record<string, string> = {
  'label_created': 'bg-gray-100 text-gray-600 border-gray-300',
  'posted': 'bg-blue-100 text-blue-600 border-blue-300',
  'in_transit': 'bg-yellow-100 text-yellow-600 border-yellow-300',
  'out_for_delivery': 'bg-orange-100 text-orange-600 border-orange-300',
  'delivered': 'bg-green-100 text-green-600 border-green-300',
  'failed': 'bg-red-100 text-red-600 border-red-300',
  'returned': 'bg-purple-100 text-purple-600 border-purple-300',
  'default': 'bg-muted text-muted-foreground border-muted',
};

export function ShipmentTimeline({ events, isLoading }: ShipmentTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhum evento de rastreamento ainda
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Os eventos aparecerão aqui conforme o pacote for movimentado
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px] pr-4">
      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />
        
        <div className="space-y-4">
          {events.map((event, index) => {
            const Icon = statusIcons[event.status] || statusIcons.default;
            const colorClass = statusColors[event.status] || statusColors.default;
            const isFirst = index === 0;
            
            return (
              <div key={event.id} className="relative flex gap-4 pl-2">
                {/* Ícone */}
                <div className={`relative z-10 flex items-center justify-center h-8 w-8 rounded-full border-2 ${colorClass} ${isFirst ? 'ring-2 ring-offset-2 ring-primary/20' : ''}`}>
                  <Icon className="h-4 w-4" />
                </div>
                
                {/* Conteúdo */}
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-medium text-sm ${isFirst ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {event.description || event.status}
                      </p>
                      {event.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(event.occurred_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
