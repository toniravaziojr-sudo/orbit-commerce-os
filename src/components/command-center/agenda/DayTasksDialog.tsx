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
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

interface DayTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  tasks: AgendaTask[];
  getTaskReminders: (taskId: string) => AgendaReminder[];
  onAddTask: () => void;
}

export function DayTasksDialog({
  open,
  onOpenChange,
  date,
  tasks,
  getTaskReminders,
  onAddTask,
}: DayTasksDialogProps) {
  const { completeTask, cancelTask, deleteTask, isUpdating, isDeleting } = useAgendaTasks();

  if (!date) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>
            <Button size="sm" onClick={onAddTask} className="gap-1">
              <Plus className="h-4 w-4" />
              Novo Lembrete
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma tarefa para este dia.
              </p>
            </div>
          ) : (
            <TooltipProvider>
              {tasks.map(task => {
                const reminders = getTaskReminders(task.id);
                const remindersSummary = getRemindersSummary(reminders);
                const dueAt = new Date(task.due_at);
                const isOverdue = task.status === 'pending' && dueAt < new Date();
                const failedReminder = reminders.find(r => r.status === 'failed');

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      isOverdue 
                        ? "border-destructive/50 bg-destructive/5" 
                        : "border-border/50 bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                      task.status === 'completed' 
                        ? "bg-success/10 text-success" 
                        : task.status === 'cancelled'
                        ? "bg-muted text-muted-foreground"
                        : isOverdue
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    )}>
                      {task.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : task.status === 'cancelled' ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <CalendarClock className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm text-foreground truncate">{task.title}</h4>
                        {getStatusBadge(task.status)}
                        {task.is_recurring && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Repeat className="h-2.5 w-2.5" />
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {task.recurrence?.type === 'daily' && `A cada ${task.recurrence.interval} dia(s)`}
                              {task.recurrence?.type === 'weekly' && `A cada ${task.recurrence.interval} semana(s)`}
                              {task.recurrence?.type === 'monthly' && `A cada ${task.recurrence.interval} mês(es)`}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className={cn(
                          "flex items-center gap-1",
                          isOverdue ? "text-destructive font-medium" : ""
                        )}>
                          <Clock className="h-3 w-3" />
                          {format(dueAt, "HH:mm", { locale: ptBR })}
                          {isOverdue && ' (atrasada)'}
                        </span>

                        {reminders.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                "flex items-center gap-1",
                                remindersSummary.failed > 0 ? "text-destructive" : ""
                              )}>
                                <Bell className="h-3 w-3" />
                                {remindersSummary.pending > 0 && `${remindersSummary.pending} pendente`}
                                {remindersSummary.failed > 0 && (
                                  <span className="text-destructive">
                                    • {remindersSummary.failed} falhou
                                  </span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <div className="space-y-1">
                                <p className="font-medium text-xs">Lembretes:</p>
                                {reminders.map(r => (
                                  <div key={r.id} className="text-xs flex items-center gap-2">
                                    <span>{format(new Date(r.remind_at), "HH:mm")}</span>
                                    <Badge variant="outline" className={cn(
                                      "text-[10px] py-0",
                                      r.status === 'sent' ? "text-success" :
                                      r.status === 'failed' ? "text-destructive" :
                                      r.status === 'pending' ? "text-warning" : ""
                                    )}>
                                      {r.status === 'pending' && 'Aguardando'}
                                      {r.status === 'sent' && 'Enviado'}
                                      {r.status === 'failed' && 'Falhou'}
                                      {r.status === 'skipped' && 'Pulado'}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {failedReminder && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-destructive">
                                <AlertCircle className="h-3 w-3" />
                                Erro
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {failedReminder.last_error || 'Erro desconhecido'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {task.status === 'pending' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => completeTask(task.id)}
                              disabled={isUpdating}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Concluir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => cancelTask(task.id)}
                              disabled={isUpdating}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
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
                  </div>
                );
              })}
            </TooltipProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
