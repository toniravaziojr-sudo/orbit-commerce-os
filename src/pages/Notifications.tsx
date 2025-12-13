import { Bell, Plus, Zap, Mail, MessageSquare, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Notifications() {
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Notificações & Automações"
        description="Configure regras, automações e notificações por WhatsApp e Email"
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        }
      />

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Zap className="h-4 w-4" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Regras de Automação</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Zap}
                title="Nenhuma regra configurada"
                description="Crie regras para automatizar notificações baseadas em eventos como: pagamento confirmado, pedido enviado, carrinho abandonado, etc."
                action={{
                  label: "Criar Primeira Regra",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Templates de Mensagem</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={MessageSquare}
                title="Nenhum template criado"
                description="Crie templates reutilizáveis para WhatsApp e Email. Use variáveis dinâmicas como nome do cliente, número do pedido, etc."
                action={{
                  label: "Criar Template",
                  onClick: () => {},
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Histórico de Envios</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={Bell}
                title="Nenhuma notificação enviada"
                description="O histórico completo de todas as notificações enviadas aparecerá aqui com status, timestamps e logs de erro."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Channel Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-success/10 p-3">
                <MessageSquare className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">WhatsApp</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conecte sua conta do WhatsApp Business para enviar notificações automáticas.
                </p>
                <Button variant="outline" size="sm" className="mt-4">
                  Configurar WhatsApp
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-info/10 p-3">
                <Mail className="h-6 w-6 text-info" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Email</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure o envio de emails transacionais e marketing para seus clientes.
                </p>
                <Button variant="outline" size="sm" className="mt-4">
                  Configurar Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
