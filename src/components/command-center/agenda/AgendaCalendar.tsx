import { useState, useMemo } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  CalendarClock,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getHolidayForDate } from "@/lib/brazilian-holidays";
import type { AgendaTask, AgendaReminder } from "@/hooks/useAgendaTasks";

interface AgendaCalendarProps {
  tasks: AgendaTask[];
  reminders: AgendaReminder[];
  isLoading: boolean;
  onDayClick: (date: Date, dayTasks: AgendaTask[]) => void;
  onAddTask: (date: Date) => void;
  getTaskReminders: (taskId: string) => AgendaReminder[];
}

const statusConfig = {
  pending: { 
    color: "bg-warning/20 border-warning text-warning", 
    label: "Pendente",
    icon: Clock,
  },
  completed: { 
    color: "bg-success/20 border-success text-success", 
    label: "Concluída",
    icon: CheckCircle,
  },
  cancelled: { 
    color: "bg-muted text-muted-foreground border-muted-foreground/30", 
    label: "Cancelada",
    icon: XCircle,
  },
};

export function AgendaCalendar({
  tasks,
  reminders,
  isLoading,
  onDayClick,
  onAddTask,
  getTaskReminders,
}: AgendaCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentMonth]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, AgendaTask[]>();
    tasks.forEach((task) => {
      const key = format(parseISO(task.due_at), "yyyy-MM-dd");
      const existing = map.get(key) || [];
      map.set(key, [...existing, task]);
    });
    return map;
  }, [tasks]);

  // Stats for current month
  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    const monthTasks = tasks.filter(t => {
      const dueAt = parseISO(t.due_at);
      return dueAt >= monthStart && dueAt <= monthEnd;
    });
    
    return {
      total: monthTasks.length,
      pending: monthTasks.filter(t => t.status === 'pending').length,
      completed: monthTasks.filter(t => t.status === 'completed').length,
      cancelled: monthTasks.filter(t => t.status === 'cancelled').length,
    };
  }, [tasks, currentMonth]);

  const weekDayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const handleDayClick = (date: Date, dayTasks: AgendaTask[]) => {
    if (dayTasks.length > 0) {
      onDayClick(date, dayTasks);
    } else {
      onAddTask(date);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg font-semibold">Calendário de Lembretes</CardTitle>
            {/* Month stats */}
            <div className="hidden md:flex items-center gap-2 text-sm">
              {monthStats.pending > 0 && (
                <Badge variant="outline" className="text-warning border-warning gap-1">
                  <Clock className="h-3 w-3" />
                  {monthStats.pending} pendente{monthStats.pending > 1 ? 's' : ''}
                </Badge>
              )}
              {monthStats.completed > 0 && (
                <Badge variant="outline" className="text-success border-success gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {monthStats.completed}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[160px] text-center font-medium capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1">
            {weekDayHeaders.map((day) => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        ) : (
          <TooltipProvider>
            <div className="grid grid-cols-7 gap-1">
              {/* Week headers */}
              {weekDayHeaders.map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              
              {/* Empty cells for days before month start */}
              {Array.from({ length: days[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] bg-muted/30 rounded-md" />
              ))}
              
              {/* Calendar days */}
              {days.map((date) => {
                const dateKey = format(date, "yyyy-MM-dd");
                const dayTasks = tasksByDate.get(dateKey) || [];
                const holiday = getHolidayForDate(date);
                const today = isToday(date);
                const hasTasks = dayTasks.length > 0;
                
                // Count by status
                const pendingCount = dayTasks.filter(t => t.status === 'pending').length;
                const completedCount = dayTasks.filter(t => t.status === 'completed').length;
                const cancelledCount = dayTasks.filter(t => t.status === 'cancelled').length;
                
                // Check for overdue tasks
                const hasOverdue = dayTasks.some(t => {
                  const dueAt = parseISO(t.due_at);
                  return t.status === 'pending' && dueAt < new Date();
                });
                
                // Check for tasks with pending reminders
                const hasPendingReminders = dayTasks.some(t => {
                  const taskReminders = getTaskReminders(t.id);
                  return taskReminders.some(r => r.status === 'pending');
                });
                
                // Check for failed reminders
                const hasFailedReminders = dayTasks.some(t => {
                  const taskReminders = getTaskReminders(t.id);
                  return taskReminders.some(r => r.status === 'failed');
                });

                return (
                  <div
                    key={dateKey}
                    onClick={() => handleDayClick(date, dayTasks)}
                    className={cn(
                      "min-h-[100px] p-1 rounded-md border-2 transition-all cursor-pointer hover:shadow-md relative",
                      // Today
                      today && "ring-2 ring-primary ring-offset-2",
                      // Holiday
                      holiday && "ring-2 ring-destructive/50",
                      // Has overdue tasks
                      hasOverdue && "bg-destructive/10 border-destructive/50",
                      // Has pending tasks
                      !hasOverdue && pendingCount > 0 && "bg-warning/10 border-warning/50",
                      // Has only completed
                      !hasOverdue && pendingCount === 0 && completedCount > 0 && "bg-success/10 border-success/50",
                      // Has only cancelled
                      !hasOverdue && pendingCount === 0 && completedCount === 0 && cancelledCount > 0 && "bg-muted/50 border-muted-foreground/30",
                      // Empty day
                      !hasTasks && "bg-background border-border hover:border-primary/50"
                    )}
                  >
                    {/* Day number and holiday */}
                    <div className={cn(
                      "text-xs font-medium p-1 flex items-center gap-1",
                      today && "text-primary font-bold",
                      hasOverdue && "text-destructive"
                    )}>
                      {format(date, "d")}
                      {holiday && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">{holiday.emoji}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{holiday.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {hasFailedReminders && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Lembrete com erro no envio</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    
                    {/* Task indicators */}
                    {hasTasks && (
                      <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {/* Pending tasks */}
                        {pendingCount > 0 && (
                          <div className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                            hasOverdue 
                              ? "bg-destructive text-destructive-foreground" 
                              : "bg-warning text-warning-foreground"
                          )}>
                            <Clock className="h-2.5 w-2.5" />
                            {pendingCount}
                          </div>
                        )}
                        
                        {/* Completed tasks */}
                        {completedCount > 0 && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-success text-success-foreground text-[10px] font-medium">
                            <CheckCircle className="h-2.5 w-2.5" />
                            {completedCount}
                          </div>
                        )}
                        
                        {/* Reminder indicator */}
                        {hasPendingReminders && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-info text-info-foreground text-[10px]">
                                <Bell className="h-2.5 w-2.5" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Lembretes agendados</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                    
                    {/* Task titles preview (show up to 2) */}
                    {hasTasks && (
                      <div className="mt-1 px-1 space-y-0.5">
                        {dayTasks.slice(0, 2).map(task => (
                          <div 
                            key={task.id}
                            className={cn(
                              "text-[10px] truncate leading-tight",
                              task.status === 'completed' && "text-muted-foreground line-through",
                              task.status === 'cancelled' && "text-muted-foreground/50 line-through",
                              task.status === 'pending' && "text-foreground"
                            )}
                          >
                            {task.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{dayTasks.length - 2} mais
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Empty day placeholder */}
                    {!hasTasks && (
                      <div className="text-xs text-muted-foreground/50 px-1 flex items-center gap-1 mt-2">
                        <Plus className="h-3 w-3" />
                        Adicionar
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
