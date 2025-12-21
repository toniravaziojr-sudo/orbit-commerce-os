import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, RefreshCw, Send, CheckCircle, XCircle, Ban, 
  MoreHorizontal, Eye, Calendar, RotateCcw, X, MessageSquare, Mail
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification, NotificationStatus } from "@/hooks/useNotifications";

interface NotificationsListProps {
  notifications: Notification[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onViewDetails: (notification: Notification) => void;
  onCancel: (id: string) => Promise<boolean>;
  onReschedule: (id: string) => void;
  onReprocess: (id: string) => Promise<boolean>;
}

const statusConfig: Record<NotificationStatus, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: 'Agendada', icon: Clock, variant: 'secondary' },
  retrying: { label: 'Retrying', icon: RefreshCw, variant: 'outline' },
  sending: { label: 'Enviando', icon: Send, variant: 'default' },
  sent: { label: 'Enviada', icon: CheckCircle, variant: 'default' },
  failed: { label: 'Falhou', icon: XCircle, variant: 'destructive' },
  canceled: { label: 'Cancelada', icon: Ban, variant: 'outline' },
};

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  email: Mail,
};

export function NotificationsList({
  notifications,
  isLoading,
  hasMore,
  onLoadMore,
  onViewDetails,
  onCancel,
  onReschedule,
  onReprocess,
}: NotificationsListProps) {
  const [cancelDialogId, setCancelDialogId] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleCancel = async () => {
    if (!cancelDialogId) return;
    setIsCanceling(true);
    await onCancel(cancelDialogId);
    setIsCanceling(false);
    setCancelDialogId(null);
  };

  if (isLoading && notifications.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma notificação encontrada
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Destinatário</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Tentativas</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead>Próxima / Enviado</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.map((notification) => {
            const status = statusConfig[notification.status] || statusConfig.scheduled;
            const StatusIcon = status.icon;
            const ChannelIcon = channelIcons[notification.channel] || MessageSquare;
            const canCancel = ['scheduled', 'retrying'].includes(notification.status);
            const canReprocess = ['failed', 'retrying'].includes(notification.status);

            return (
              <TableRow key={notification.id}>
                <TableCell>
                  <Badge variant={status.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{notification.channel}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{notification.recipient}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{notification.template_key || '-'}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {notification.attempt_count} / {notification.max_attempts}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(notification.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {notification.sent_at 
                      ? format(new Date(notification.sent_at), "dd/MM HH:mm", { locale: ptBR })
                      : notification.next_attempt_at 
                        ? format(new Date(notification.next_attempt_at), "dd/MM HH:mm", { locale: ptBR })
                        : '-'
                    }
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails(notification)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                      {canCancel && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onReschedule(notification.id)}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Reagendar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setCancelDialogId(notification.id)}
                            className="text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </DropdownMenuItem>
                        </>
                      )}
                      {canReprocess && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onReprocess(notification.id)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reprocessar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}

      <AlertDialog open={!!cancelDialogId} onOpenChange={() => setCancelDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar notificação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A notificação não será enviada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={isCanceling}>
              {isCanceling ? 'Cancelando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
