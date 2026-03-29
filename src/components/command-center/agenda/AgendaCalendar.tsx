import { useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import {
  Plus,
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MonthlyCalendar, DayHeader, type DayCellInfo } from "@/components/ui/monthly-calendar";
import type { AgendaTask, AgendaReminder } from "@/hooks/useAgendaTasks";

interface AgendaCalendarProps {
  tasks: AgendaTask[];
  reminders: AgendaReminder[];
  isLoading: boolean;
  onDayClick: (date: Date, dayTasks: AgendaTask[]) => void;
  onAddTask: (date: Date) => void;
  getTaskReminders: (taskId: string) => AgendaReminder[];
}

export function AgendaCalendar({
  tasks,
  reminders,
  isLoading,
  onDayClick,
  onAddTask,
  getTaskReminders,
}: AgendaCalendarProps) {
  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, AgendaTask[]>();
    tasks.forEach((task) => {
      const key = format(parseISO(task.due_at), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) || []), task]);
    });
    return map;
  }, [tasks]);

  const handleDayClick = (date: Date, dayTasks: AgendaTask[]) => {
    if (dayTasks.length > 0) {
      onDayClick(date, dayTasks);
    } else {
      onAddTask(date);
    }
  };

  return (
    <MonthlyCalendar
      isLoading={isLoading}
      headerRight={
        <span className="text-lg font-semibold">Calendário de Lembretes</span>
      }
      renderCell={(info) => (
        <AgendaDayCell
          info={info}
          dayTasks={tasksByDate.get(info.dateKey) || []}
          getTaskReminders={getTaskReminders}
          onClick={handleDayClick}
        />
      )}
    />
  );
}

// ── Day Cell ──
function AgendaDayCell({
  info,
  dayTasks,
  getTaskReminders,
  onClick,
}: {
  info: DayCellInfo;
  dayTasks: AgendaTask[];
  getTaskReminders: (taskId: string) => AgendaReminder[];
  onClick: (date: Date, tasks: AgendaTask[]) => void;
}) {
  const hasTasks = dayTasks.length > 0;
  const pendingCount = dayTasks.filter(t => t.status === "pending").length;
  const completedCount = dayTasks.filter(t => t.status === "completed").length;
  const cancelledCount = dayTasks.filter(t => t.status === "cancelled").length;

  const hasOverdue = dayTasks.some(t => {
    const dueAt = parseISO(t.due_at);
    return t.status === "pending" && dueAt < new Date();
  });

  const hasPendingReminders = dayTasks.some(t => {
    const taskReminders = getTaskReminders(t.id);
    return taskReminders.some(r => r.status === "pending");
  });

  const hasFailedReminders = dayTasks.some(t => {
    const taskReminders = getTaskReminders(t.id);
    return taskReminders.some(r => r.status === "failed");
  });

  return (
    <div
      onClick={() => onClick(info.date, dayTasks)}
      className={cn(
        "h-full p-1 rounded-md border-2 transition-all cursor-pointer hover:shadow-md relative",
        info.isToday && "ring-2 ring-primary ring-offset-2",
        info.holiday && "ring-2 ring-destructive/50",
        hasOverdue && "bg-destructive/10 border-destructive/50",
        !hasOverdue && pendingCount > 0 && "bg-warning/10 border-warning/50",
        !hasOverdue && pendingCount === 0 && completedCount > 0 && "bg-success/10 border-success/50",
        !hasOverdue && pendingCount === 0 && completedCount === 0 && cancelledCount > 0 && "bg-muted/50 border-muted-foreground/30",
        !hasTasks && "bg-background border-border hover:border-primary/50"
      )}
    >
      <DayHeader
        date={info.date}
        holiday={info.holiday}
        isToday={info.isToday}
        className={hasOverdue ? "text-destructive" : undefined}
      >
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
      </DayHeader>

      {hasTasks && (
        <div className="flex flex-wrap gap-1 mt-1 px-1">
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
          {completedCount > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-success text-success-foreground text-[10px] font-medium">
              <CheckCircle className="h-2.5 w-2.5" />
              {completedCount}
            </div>
          )}
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

      {hasTasks && (
        <div className="mt-1 px-1 space-y-0.5">
          {dayTasks.slice(0, 2).map(task => (
            <div
              key={task.id}
              className={cn(
                "text-[10px] truncate leading-tight",
                task.status === "completed" && "text-muted-foreground line-through",
                task.status === "cancelled" && "text-muted-foreground/50 line-through",
                task.status === "pending" && "text-foreground"
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

      {!hasTasks && (
        <div className="text-xs text-muted-foreground/50 px-1 flex items-center gap-1 mt-2">
          <Plus className="h-3 w-3" />
          Adicionar
        </div>
      )}
    </div>
  );
}
