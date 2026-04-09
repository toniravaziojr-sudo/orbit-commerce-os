import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Bot,
  CalendarClock,
  ClipboardList,
  Bell,
  MessageSquare,
} from "lucide-react";
import { AgendaContent } from "@/components/command-center/agenda";
import { EmbeddedCommandAssistant } from "@/components/command-assistant/EmbeddedCommandAssistant";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardTab } from "@/components/command-center/DashboardTab";
import { ExecutionsQueue } from "@/components/command-center/ExecutionsQueue";
import { AlertsTab } from "@/components/command-center/AlertsTab";
import { CommunicationsTab } from "@/components/command-center/CommunicationsTab";

export default function CommandCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "dashboard";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Central de Comando"
        description="Visão geral da sua operação, assistente de comando e tarefas pendentes"
      />

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-6">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="executions" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Execuções</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas</span>
          </TabsTrigger>
          <TabsTrigger value="communications" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Comunicações</span>
          </TabsTrigger>
          <TabsTrigger value="assistant" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Assistente</span>
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            <span className="hidden sm:inline">Agenda</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="executions" className="mt-6">
          <ExecutionsQueue />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <AlertsTab />
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <CommunicationsTab />
        </TabsContent>

        <TabsContent value="assistant" className="mt-6">
          <EmbeddedCommandAssistant />
        </TabsContent>

        <TabsContent value="agenda" className="mt-6">
          <AgendaContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
