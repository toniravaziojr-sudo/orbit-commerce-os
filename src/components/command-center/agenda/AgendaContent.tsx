import { useState } from "react";
import { CalendarClock, Plus, AlertTriangle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAgendaTasks, type TaskStatus } from "@/hooks/useAgendaTasks";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { AgendaTaskList } from "./AgendaTaskList";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "react-router-dom";

type FilterType = 'all' | 'pending' | 'completed' | 'cancelled' | 'today' | 'week';

export function AgendaContent() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('pending');
  const { tasks, reminders, isLoading, getTaskReminders } = useAgendaTasks();
  const { status: whatsappStatus } = useWhatsAppStatus();

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const now = new Date();
    const dueAt = new Date(task.due_at);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    switch (activeFilter) {
      case 'pending':
        return task.status === 'pending';
      case 'completed':
        return task.status === 'completed';
      case 'cancelled':
        return task.status === 'cancelled';
      case 'today':
        return dueAt >= today && dueAt < new Date(today.getTime() + 24 * 60 * 60 * 1000);
      case 'week':
        return dueAt >= today && dueAt < weekEnd;
      default:
        return true;
    }
  });

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* WhatsApp Warning - Only shown here in Agenda */}
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

      {/* Main Content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg font-semibold">Tarefas e Lembretes</CardTitle>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Lembrete
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterType)}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="week">Próximos 7 dias</TabsTrigger>
              <TabsTrigger value="completed">Concluídas</TabsTrigger>
              <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
              <TabsTrigger value="all">Todas</TabsTrigger>
            </TabsList>

            <TabsContent value={activeFilter} className="mt-0">
              <AgendaTaskList
                tasks={filteredTasks}
                isLoading={isLoading}
                getTaskReminders={getTaskReminders}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreateTaskDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
