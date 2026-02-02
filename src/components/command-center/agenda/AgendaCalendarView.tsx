import { useState } from "react";
import { CalendarClock, Plus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAgendaTasks, type AgendaTask } from "@/hooks/useAgendaTasks";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { AgendaCalendar } from "./AgendaCalendar";
import { DayTasksDialog } from "./DayTasksDialog";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "react-router-dom";

export function AgendaCalendarView() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayTasks, setSelectedDayTasks] = useState<AgendaTask[]>([]);
  const [isDayDialogOpen, setIsDayDialogOpen] = useState(false);
  
  const { tasks, reminders, isLoading, getTaskReminders } = useAgendaTasks();
  const { status: whatsappStatus } = useWhatsAppStatus();

  // Stats
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const todayCount = tasks.filter(t => {
    const today = new Date();
    const dueAt = new Date(t.due_at);
    return dueAt.toDateString() === today.toDateString() && t.status === 'pending';
  }).length;
  
  const pendingReminders = reminders.filter(r => r.status === 'pending').length;
  const failedReminders = reminders.filter(r => r.status === 'failed').length;

  const handleDayClick = (date: Date, dayTasks: AgendaTask[]) => {
    setSelectedDate(date);
    setSelectedDayTasks(dayTasks);
    setIsDayDialogOpen(true);
  };

  const handleAddTask = (date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
    setIsCreateOpen(true);
    setIsDayDialogOpen(false);
  };

  const handleAddTaskFromDialog = () => {
    setIsCreateOpen(true);
    setIsDayDialogOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* WhatsApp Warning */}
      {!whatsappStatus.isConfigured && (
        <Alert variant="default" className="border-warning/50 bg-warning/10">
          <MessageCircle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">WhatsApp não configurado</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Para receber lembretes no WhatsApp, configure a integração.{" "}
            <Link to="/integrations" className="font-medium text-primary hover:underline">
              Ir para Integrações → WhatsApp
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pendentes"
          value={pendingCount.toString()}
          icon={CalendarClock}
          variant="warning"
        />
        <StatCard
          title="Concluídas"
          value={completedCount.toString()}
          icon={CalendarClock}
          variant="success"
        />
        <StatCard
          title="Hoje"
          value={todayCount.toString()}
          icon={CalendarClock}
          variant="primary"
        />
        <StatCard
          title="Lembretes Agendados"
          value={pendingReminders.toString()}
          icon={MessageCircle}
          variant={failedReminders > 0 ? "destructive" : "info"}
          description={failedReminders > 0 ? `${failedReminders} falharam` : undefined}
        />
      </div>

      {/* Create button */}
      <div className="flex justify-end">
        <Button onClick={() => handleAddTask()}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Lembrete
        </Button>
      </div>

      {/* Calendar */}
      <AgendaCalendar
        tasks={tasks}
        reminders={reminders}
        isLoading={isLoading}
        onDayClick={handleDayClick}
        onAddTask={handleAddTask}
        getTaskReminders={getTaskReminders}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 items-center text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <span className="font-medium">Legenda:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-warning" />
          <span>Pendente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-success" />
          <span>Concluída</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive" />
          <span>Atrasada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted-foreground/50" />
          <span>Cancelada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-info" />
          <span>Com lembrete</span>
        </div>
      </div>

      {/* Day Tasks Dialog */}
      <DayTasksDialog
        open={isDayDialogOpen}
        onOpenChange={setIsDayDialogOpen}
        date={selectedDate}
        tasks={selectedDayTasks}
        getTaskReminders={getTaskReminders}
        onAddTask={handleAddTaskFromDialog}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
