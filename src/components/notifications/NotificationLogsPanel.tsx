import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCcw,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { useNotificationLogs, type NotificationLog } from "@/hooks/useNotificationLogs";

interface NotificationLogsPanelProps {
  orderId?: string;
  customerId?: string;
  checkoutSessionId?: string;
  title?: string;
  emptyMessage?: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' },
  scheduled: { label: 'Agendado', icon: Clock, variant: 'outline' },
  sent: { label: 'Enviado', icon: CheckCircle, variant: 'default' },
  failed: { label: 'Falhou', icon: XCircle, variant: 'destructive' },
  cancelled: { label: 'Cancelado', icon: XCircle, variant: 'secondary' },
};

const ruleTypeLabels: Record<string, string> = {
  payment: 'Pagamento',
  shipping: 'Envio',
  abandoned_checkout: 'Checkout Abandonado',
  post_sale: 'Pós-vendas',
};

function formatDateTime(dateString: string | null) {
  if (!dateString) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function NotificationLogsPanel({
  orderId,
  customerId,
  checkoutSessionId,
  title = "Histórico de Notificações",
  emptyMessage = "Nenhuma notificação registrada",
}: NotificationLogsPanelProps) {
  const { logs, isLoading, refetch } = useNotificationLogs({
    orderId,
    customerId,
    checkoutSessionId,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {title}
          </h3>
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Bell className="h-4 w-4" />
          {title} ({logs.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <NotificationLogItem key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationLogItem({ log }: { log: NotificationLog }) {
  const [open, setOpen] = useState(false);
  const status = statusConfig[log.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardContent className="pt-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-0.5">
                  {log.channel === 'whatsapp' ? (
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  ) : (
                    <Mail className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm truncate">
                      {log.rule_name || 'Regra removida'}
                    </span>
                    <Badge variant={status.variant} className="flex items-center gap-1 text-xs">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {ruleTypeLabels[log.rule_type] || log.rule_type}
                    </Badge>
                    <span>{log.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</span>
                    {log.recipient && <span>→ {log.recipient}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                <p>{formatDateTime(log.created_at)}</p>
                {log.sent_at && log.status === 'sent' && (
                  <p className="text-green-600">Enviado: {formatDateTime(log.sent_at)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t pt-3 space-y-3 bg-muted/30">
            {log.scheduled_for && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Agendado para</span>
                <span>{formatDateTime(log.scheduled_for)}</span>
              </div>
            )}
            {log.attempt_count !== null && log.attempt_count > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tentativas</span>
                <span>{log.attempt_count}</span>
              </div>
            )}
            {log.error_message && (
              <div className="text-sm">
                <span className="text-muted-foreground block mb-1">Erro</span>
                <p className="text-destructive bg-destructive/10 p-2 rounded text-xs font-mono">
                  {log.error_message}
                </p>
              </div>
            )}
            {log.content_preview && (
              <div className="text-sm">
                <span className="text-muted-foreground block mb-1">Prévia do conteúdo</span>
                <p className="bg-muted p-2 rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {log.content_preview}
                </p>
              </div>
            )}
            {log.attachments && Array.isArray(log.attachments) && log.attachments.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground block mb-1">Anexos</span>
                <div className="flex flex-wrap gap-1">
                  {log.attachments.map((att: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {att.name || att.file_name || `Anexo ${i + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
