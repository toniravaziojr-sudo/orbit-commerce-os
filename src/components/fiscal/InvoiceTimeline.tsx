import { useState, useEffect } from 'react';
import { History, Loader2, CheckCircle, XCircle, Send, Printer, FileEdit, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimelineEvent {
  id: string;
  event_type: string;
  description?: string | null;
  metadata?: any;
  event_data?: any;
  created_at: string;
}

interface InvoiceTimelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber?: string;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  created: Send,
  submitted: Send,
  authorized: CheckCircle,
  rejected: XCircle,
  cancelled: XCircle,
  canceled: XCircle,
  printed: Printer,
  cce_authorized: FileEdit,
  cce_rejected: FileEdit,
  status_check: History,
  default: AlertTriangle,
};

const EVENT_COLORS: Record<string, string> = {
  created: 'bg-blue-500',
  submitted: 'bg-blue-500',
  authorized: 'bg-green-500',
  rejected: 'bg-red-500',
  cancelled: 'bg-red-500',
  canceled: 'bg-red-500',
  printed: 'bg-purple-500',
  cce_authorized: 'bg-amber-500',
  cce_rejected: 'bg-red-500',
  status_check: 'bg-gray-500',
  default: 'bg-gray-500',
};

export function InvoiceTimeline({ open, onOpenChange, invoiceId, invoiceNumber }: InvoiceTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && invoiceId) {
      loadEvents();
    }
  }, [open, invoiceId]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('fiscal_invoice_events')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    return EVENT_ICONS[eventType] || EVENT_ICONS.default;
  };

  const getEventColor = (eventType: string) => {
    return EVENT_COLORS[eventType] || EVENT_COLORS.default;
  };

  const formatEventType = (eventType: string) => {
    const labels: Record<string, string> = {
      created: 'Criada',
      submitted: 'Enviada para SEFAZ',
      authorized: 'Autorizada',
      rejected: 'Rejeitada',
      cancelled: 'Cancelada',
      canceled: 'Cancelada',
      printed: 'Impressa',
      cce_authorized: 'Carta de Correção',
      cce_rejected: 'CC-e Rejeitada',
      status_check: 'Consulta de Status',
    };
    return labels[eventType] || eventType;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico da NF-e
          </DialogTitle>
          {invoiceNumber && (
            <DialogDescription>
              NF-e {invoiceNumber}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum evento registrado
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />

              <div className="space-y-4">
                {events.map((event, index) => {
                  const Icon = getEventIcon(event.event_type);
                  const color = getEventColor(event.event_type);

                  return (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Icon */}
                      <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {formatEventType(event.event_type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {(event.description || event.event_data?.description) && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {event.description || event.event_data?.description}
                          </p>
                        )}
                        {(event.metadata?.protocolo || event.event_data?.protocolo) && (
                          <p className="mt-1 text-xs font-mono text-muted-foreground">
                            Protocolo: {event.metadata?.protocolo || event.event_data?.protocolo}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
