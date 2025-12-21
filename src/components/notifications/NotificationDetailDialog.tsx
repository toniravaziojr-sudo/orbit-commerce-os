import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, RefreshCw, Send, CheckCircle, XCircle, Ban, 
  MessageSquare, Mail, ExternalLink
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Notification, NotificationAttempt, NotificationStatus } from "@/hooks/useNotifications";

interface NotificationDetailDialogProps {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchAttempts: (id: string) => Promise<NotificationAttempt[]>;
}

const statusConfig: Record<NotificationStatus, { label: string; icon: React.ElementType; color: string }> = {
  scheduled: { label: 'Agendada', icon: Clock, color: 'text-blue-500' },
  retrying: { label: 'Retrying', icon: RefreshCw, color: 'text-warning' },
  sending: { label: 'Enviando', icon: Send, color: 'text-info' },
  sent: { label: 'Enviada', icon: CheckCircle, color: 'text-success' },
  failed: { label: 'Falhou', icon: XCircle, color: 'text-destructive' },
  canceled: { label: 'Cancelada', icon: Ban, color: 'text-muted-foreground' },
};

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  email: Mail,
};

export function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
  fetchAttempts,
}: NotificationDetailDialogProps) {
  const [attempts, setAttempts] = useState<NotificationAttempt[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);

  useEffect(() => {
    if (notification && open) {
      setIsLoadingAttempts(true);
      fetchAttempts(notification.id)
        .then(setAttempts)
        .finally(() => setIsLoadingAttempts(false));
    }
  }, [notification, open, fetchAttempts]);

  if (!notification) return null;

  const status = statusConfig[notification.status] || statusConfig.scheduled;
  const StatusIcon = status.icon;
  const ChannelIcon = channelIcons[notification.channel] || MessageSquare;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <ChannelIcon className="h-5 w-5" />
            Detalhes da Notificação
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-100px)]">
          <div className="space-y-6 pr-4">
            {/* Status e Info Principal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge variant="outline" className={`gap-1 ${status.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Canal</p>
                <p className="font-medium capitalize">{notification.channel}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Destinatário</p>
                <p className="font-mono text-sm">{notification.recipient}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Template</p>
                <p className="font-medium">{notification.template_key || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tentativas</p>
                <p className="font-medium">{notification.attempt_count} / {notification.max_attempts}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Criado em</p>
                <p className="text-sm">
                  {format(new Date(notification.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </p>
              </div>
            </div>

            {notification.sent_at && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Enviado em</p>
                <p className="text-sm text-success">
                  {format(new Date(notification.sent_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </p>
              </div>
            )}

            {notification.last_error && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Último erro</p>
                <p className="text-sm text-destructive font-mono bg-destructive/10 p-2 rounded">
                  {notification.last_error}
                </p>
              </div>
            )}

            <Separator />

            {/* Referências */}
            <div>
              <p className="text-sm font-medium mb-2">Referências</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ID</p>
                  <p className="font-mono text-xs break-all">{notification.id}</p>
                </div>
                {notification.event_id && (
                  <div>
                    <p className="text-muted-foreground">Event ID</p>
                    <p className="font-mono text-xs break-all">{notification.event_id}</p>
                  </div>
                )}
                {notification.rule_id && (
                  <div>
                    <p className="text-muted-foreground">Rule ID</p>
                    <p className="font-mono text-xs break-all">{notification.rule_id}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Payload */}
            <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>Payload</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-[200px]">
                  {JSON.stringify(notification.payload, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Timeline de Attempts */}
            <div>
              <p className="text-sm font-medium mb-3">Timeline de Tentativas</p>
              
              {isLoadingAttempts ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma tentativa registrada</p>
              ) : (
                <div className="space-y-3">
                  {attempts.map((attempt) => (
                    <div 
                      key={attempt.id} 
                      className={`p-3 rounded-lg border ${
                        attempt.status === 'success' 
                          ? 'border-success/30 bg-success/5' 
                          : attempt.status === 'error'
                            ? 'border-destructive/30 bg-destructive/5'
                            : 'border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={attempt.status === 'success' ? 'default' : 'destructive'}>
                            Tentativa #{attempt.attempt_no}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(attempt.started_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </span>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {attempt.status}
                        </Badge>
                      </div>
                      
                      {attempt.error_message && (
                        <p className="text-xs text-destructive font-mono mt-2">
                          {attempt.error_code && `[${attempt.error_code}] `}
                          {attempt.error_message}
                        </p>
                      )}
                      
                      {attempt.finished_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Finalizado: {format(new Date(attempt.finished_at), "HH:mm:ss", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
