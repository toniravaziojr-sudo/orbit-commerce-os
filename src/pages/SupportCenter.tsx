import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Ticket, 
  HelpCircle, 
  MessageCircle, 
  PlayCircle,
  ExternalLink,
  Clock,
  CheckCircle,
} from "lucide-react";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { SupportTicketList } from "@/components/support-center/SupportTicketList";
import { CreateTicketDialog } from "@/components/support-center/CreateTicketDialog";
import { SupportTicketDetail } from "@/components/support-center/SupportTicketDetail";
import { TutorialsList } from "@/components/support-center/TutorialsList";

export default function SupportCenter() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tickets' | 'tutorials'>('tickets');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'closed'>('all');
  
  const { tickets, isLoading } = useSupportTickets(activeTab);
  const { isPlatformOperator } = usePlatformOperator();

  const openCount = tickets?.filter(t => t.status === 'open' || t.status === 'pending').length || 0;
  const closedCount = tickets?.filter(t => t.status === 'closed').length || 0;

  // If a ticket is selected, show the detail view
  if (selectedTicketId) {
    const ticket = tickets?.find(t => t.id === selectedTicketId);
    return (
      <SupportTicketDetail 
        ticketId={selectedTicketId} 
        ticket={ticket}
        onBack={() => setSelectedTicketId(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={isPlatformOperator ? "Central de Tickets" : "Suporte"}
        description={isPlatformOperator 
          ? "Gerencie todos os chamados de suporte dos clientes"
          : "Precisa de ajuda? Abra um chamado ou acesse nossa central de ajuda"
        }
        actions={
          !isPlatformOperator && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Chamado
            </Button>
          )
        }
      />

      {/* Quick Actions Cards - Only for tenants */}
      {!isPlatformOperator && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card 
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Abrir Chamado</h3>
                  <p className="text-sm text-muted-foreground">
                    Relate um problema ou dúvida
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => setActiveTab('open')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-amber-500/10 p-3">
                  <Ticket className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Meus Chamados</h3>
                  <p className="text-sm text-muted-foreground">
                    {openCount} chamado{openCount !== 1 ? 's' : ''} em aberto
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => window.open('https://docs.comandocentral.com.br', '_blank')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-blue-500/10 p-3">
                  <HelpCircle className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold flex items-center gap-1">
                    Central de Ajuda
                    <ExternalLink className="h-3 w-3" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tutoriais e documentação
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={() => window.open('https://wa.me/5511999999999', '_blank')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-green-500/10 p-3">
                  <MessageCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold flex items-center gap-1">
                    Falar com Suporte
                    <ExternalLink className="h-3 w-3" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    WhatsApp / Email
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {isPlatformOperator ? "Todos os Chamados" : "Meus Chamados"}
              </CardTitle>
              <CardDescription>
                {isPlatformOperator 
                  ? "Visualize e responda os chamados de suporte"
                  : "Acompanhe o status dos seus chamados"
                }
              </CardDescription>
            </div>
            {isPlatformOperator && (
              <div className="flex gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {openCount} abertos
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {closedCount} fechados
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="open" className="flex items-center gap-1">
                Abertos
                {openCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                    {openCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="closed">Fechados</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <SupportTicketList 
                tickets={tickets || []} 
                isLoading={isLoading}
                onSelectTicket={setSelectedTicketId}
                isPlatformView={isPlatformOperator}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreateTicketDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
    </div>
  );
}
