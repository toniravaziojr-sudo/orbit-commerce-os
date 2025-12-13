import { MessageSquare, Bot, User, Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Support() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Atendimento"
        description="Inbox unificada com IA copiloto e atendimento humano"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Conversas Abertas"
          value="0"
          icon={MessageSquare}
          variant="primary"
        />
        <StatCard
          title="Aguardando Resposta"
          value="0"
          icon={Inbox}
          variant="warning"
        />
        <StatCard
          title="Resolvidas Hoje"
          value="0"
          icon={User}
          variant="success"
        />
        <StatCard
          title="Respostas da IA"
          value="0"
          icon={Bot}
          variant="info"
        />
      </div>

      <Tabs defaultValue="inbox" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="h-4 w-4" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Bot className="h-4 w-4" />
            IA Copiloto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Conversas</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={MessageSquare}
                title="Nenhuma conversa"
                description="Quando clientes entrarem em contato, as conversas aparecerão aqui com histórico completo, tags e atribuições."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">IA Copiloto</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Bot}
                title="Configure a IA"
                description="A IA pode resumir conversas, sugerir respostas e buscar informações de pedidos e clientes automaticamente."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
