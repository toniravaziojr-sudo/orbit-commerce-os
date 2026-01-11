import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle,
  XCircle,
  Trash2,
  MoreVertical,
  Bell,
  AlertCircle,
  Repeat,
  Clock,
} from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAgendaTasks, type AgendaTask, type AgendaReminder } from "@/hooks/useAgendaTasks";
import { Skeleton } from "@/components/ui/skeleton";

interface AgendaTaskListProps {
  tasks: AgendaTask[];
  isLoading: boolean;
  getTaskReminders: (taskId: string) => AgendaReminder[];
}

export function AgendaTaskList({ tasks, isLoading, getTaskReminders }: AgendaTaskListProps) {
  const { completeTask, cancelTask, deleteTask, isUpdating, isDeleting } = useAgendaTasks();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CalendarClock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma tarefa encontrada</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Crie um lembrete para receber notificações via WhatsApp.
        </p>
      </div>
    );
  }

  const getStatusBadge = (status: AgendaTask['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-warning border-warning">Pendente</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="text-success border-success">Concluída</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="text-muted-foreground">Cancelada</Badge>;
    }
  };

  const getRemindersSummary = (reminders: AgendaReminder[]) => {
    const pending = reminders.filter(r => r.status === 'pending').length;
    const sent = reminders.filter(r => r.status === 'sent').length;
    const failed = reminders.filter(r => r.status === 'failed').length;

    return { pending, sent, failed, total: reminders.length };
  };

  return (
    <div className="space-y-3">
      {tasks.map(task => {
        const reminders = getTaskReminders(task.id);
        const remindersSummary = getRemindersSummary(reminders);
        const dueAt = new Date(task.due_at);
        const isOverdue = task.status === 'pending' && dueAt < new Date();
        const failedReminder = reminders.find(r => r.status === 'failed');

        return (
          <div
            key={task.id}
            className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
              isOverdue 
                ? 'border-destructive/50 bg-destructive/5' 
                : 'border-border/50 bg-muted/30 hover:bg-muted/50'
            }`}
          >
            {/* Icon */}
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${
              task.status === 'completed' 
                ? 'bg-success/10 text-success' 
                : task.status === 'cancelled'
                ? 'bg-muted text-muted-foreground'
                : isOverdue
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'
            }`}>
              {task.status === 'completed' ? (
                <CheckCircle className="h-5 w-5" />
              ) : task.status === 'cancelled' ? (
                <XCircle className="h-5 w-5" />
              ) : (
                <CalendarClock className="h-5 w-5" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium text-foreground truncate">{task.title}</h4>
                {getStatusBadge(task.status)}
                {task.is_recurring && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="gap-1">
                          <Repeat className="h-3 w-3" />
                          Recorrente
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {task.recurrence?.type === 'daily' && `A cada ${task.recurrence.interval} dia(s)`}
                        {task.recurrence?.type === 'weekly' && `A cada ${task.recurrence.interval} semana(s)`}
                        {task.recurrence?.type === 'monthly' && `A cada ${task.recurrence.interval} mês(es)`}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {task.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}

              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {format(dueAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {isOverdue && ' (atrasada)'}
                </span>

                {reminders.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`flex items-center gap-1 ${
                          remindersSummary.failed > 0 ? 'text-destructive' : ''
                        }`}>
                          <Bell className="h-3.5 w-3.5" />
                          {remindersSummary.pending > 0 && `${remindersSummary.pending} pendente(s)`}
                          {remindersSummary.sent > 0 && ` • ${remindersSummary.sent} enviado(s)`}
                          {remindersSummary.failed > 0 && (
                            <span className="text-destructive">
                              • {remindersSummary.failed} falhou
                            </span>
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="space-y-1">
                          <p className="font-medium">Lembretes:</p>
                          {reminders.map(r => (
                            <div key={r.id} className="text-xs flex items-center gap-2">
                              <span>{format(new Date(r.remind_at), "dd/MM HH:mm")}</span>
                              <Badge variant="outline" className={`text-xs ${
                                r.status === 'sent' ? 'text-success' :
                                r.status === 'failed' ? 'text-destructive' :
                                r.status === 'pending' ? 'text-warning' : ''
                              }`}>
                                {r.status === 'pending' && 'Aguardando'}
                                {r.status === 'sent' && 'Enviado'}
                                {r.status === 'failed' && 'Falhou'}
                                {r.status === 'skipped' && 'Pulado'}
                              </Badge>
                              {r.last_error && (
                                <span className="text-destructive truncate max-w-[150px]">
                                  {r.last_error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {failedReminder && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Erro no envio
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {failedReminder.last_error || 'Erro desconhecido'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Actions */}
            {task.status === 'pending' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => completeTask(task.id)}
                    disabled={isUpdating}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como concluída
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => cancelTask(task.id)}
                    disabled={isUpdating}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => deleteTask(task.id)}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );
}
