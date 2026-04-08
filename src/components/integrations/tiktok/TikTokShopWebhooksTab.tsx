import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Webhook, CheckCircle2, XCircle, Clock, ArrowDownUp, ArrowDown, ArrowUp } from 'lucide-react';
import { useTikTokShopWebhooks } from '@/hooks/useTikTokShopWebhooks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    pending: { label: 'Pendente', icon: <Clock className="h-3 w-3" />, className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' },
    processed: { label: 'Processado', icon: <CheckCircle2 className="h-3 w-3" />, className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' },
    failed: { label: 'Falhou', icon: <XCircle className="h-3 w-3" />, className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
  };
  const s = map[status] || { label: status, icon: null, className: 'bg-muted text-muted-foreground border-border' };
  return (
    <Badge variant="outline" className={`${s.className} gap-1`}>
      {s.icon}
      {s.label}
    </Badge>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const shortType = type.replace(/_/g, ' ').toLowerCase();
  return <Badge variant="secondary" className="text-[10px]">{shortType}</Badge>;
}

export function TikTokShopWebhooksTab() {
  const { webhookEvents, eventsLoading, syncStockFromTikTok, pushStockToTikTok } = useTikTokShopWebhooks();

  return (
    <div className="space-y-4">
      {/* Stock sync actions */}
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Sincronização de Estoque</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncStockFromTikTok.mutate()}
            disabled={syncStockFromTikTok.isPending}
          >
            {syncStockFromTikTok.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowDown className="h-4 w-4 mr-2" />
            )}
            Importar do TikTok
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pushStockToTikTok.mutate()}
            disabled={pushStockToTikTok.isPending}
          >
            {pushStockToTikTok.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowUp className="h-4 w-4 mr-2" />
            )}
            Enviar para TikTok
          </Button>
        </div>
      </div>

      {/* Webhook events */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {webhookEvents.length} evento(s) recente(s)
        </p>
      </div>

      {eventsLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : webhookEvents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum evento de webhook</p>
          <p className="text-xs mt-1">Eventos de pedidos e produtos aparecerão aqui automaticamente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhookEvents.map((event: any) => (
            <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <Webhook className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <EventTypeBadge type={event.event_type} />
                  <StatusBadge status={event.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{format(new Date(event.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                  {event.event_id && (
                    <span className="font-mono truncate max-w-[120px]">{event.event_id}</span>
                  )}
                </div>
                {event.error_message && (
                  <p className="text-xs text-destructive mt-1">{event.error_message}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
