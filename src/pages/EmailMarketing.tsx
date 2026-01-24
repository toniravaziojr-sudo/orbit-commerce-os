import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { Mail, Users, Megaphone, ListPlus, Plus, MoreHorizontal, Eye, Trash2, Edit, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListDialog } from "@/components/email-marketing/ListDialog";
import { TemplateDialog } from "@/components/email-marketing/TemplateDialog";
import { CampaignDialog } from "@/components/email-marketing/CampaignDialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Search, Tag } from "lucide-react";

export default function EmailMarketing() {
  const navigate = useNavigate();
  const { lists, subscribers, templates, campaigns, queueStats } = useEmailMarketing();
  
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [subscriberSearch, setSubscriberSearch] = useState("");

  const handleViewList = (list: any) => {
    navigate(`/email-marketing/list/${list.id}`);
  };

  const filteredSubscribers = subscribers.filter((sub: any) =>
    (sub.name?.toLowerCase() || "").includes(subscriberSearch.toLowerCase()) ||
    sub.email.toLowerCase().includes(subscriberSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Email Marketing"
        description="Gerencie listas, assinantes, templates e campanhas de email"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assinantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscribers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enviados (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{queueStats?.sent || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Na Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{queueStats?.queued || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Falhas (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{queueStats?.failed || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lists" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lists" className="gap-2"><ListPlus className="h-4 w-4" />Listas</TabsTrigger>
          <TabsTrigger value="subscribers" className="gap-2"><Users className="h-4 w-4" />Assinantes</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><Mail className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2"><Megaphone className="h-4 w-4" />Campanhas</TabsTrigger>
        </TabsList>

        <TabsContent value="lists">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Listas de Email</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em uma lista para ver assinantes e detalhes
                </p>
              </div>
              <Button size="sm" onClick={() => setListDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Nova Lista
              </Button>
            </CardHeader>
            <CardContent>
              {lists.length === 0 ? (
                <EmptyState 
                  icon={ListPlus} 
                  title="Nenhuma lista" 
                  description="Crie sua primeira lista para começar a capturar leads"
                  action={{ label: "Criar Lista", onClick: () => setListDialogOpen(true) }}
                />
              ) : (
                <div className="space-y-2">
                  {lists.map((list: any) => (
                    <div 
                      key={list.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => handleViewList(list)}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <ListPlus className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{list.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {list.description || "Sem descrição"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {list.customer_tags && (
                          <Badge 
                            variant="outline" 
                            className="gap-1.5 shrink-0"
                            style={{ 
                              borderColor: list.customer_tags.color, 
                              color: list.customer_tags.color,
                              backgroundColor: list.customer_tags.color + "15"
                            }}
                          >
                            <Tag className="h-3 w-3" />
                            {list.customer_tags.name}
                          </Badge>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscribers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Assinantes</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar assinantes..."
                  className="pl-9"
                  value={subscriberSearch}
                  onChange={(e) => setSubscriberSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {subscribers.length === 0 ? (
                <EmptyState icon={Users} title="Nenhum assinante" description="Assinantes capturados via formulários aparecerão aqui" />
              ) : (
                <div className="space-y-2">
                  {filteredSubscribers.slice(0, 50).map((sub: any) => (
                    <div key={sub.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{sub.name || sub.email}</p>
                          <p className="text-sm text-muted-foreground">{sub.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sub.source && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {sub.source}
                          </span>
                        )}
                        <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
                          {sub.status === 'active' ? 'Ativo' : sub.status === 'unsubscribed' ? 'Descadastrado' : sub.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {filteredSubscribers.length > 50 && (
                    <p className="text-sm text-center text-muted-foreground py-2">
                      Mostrando 50 de {filteredSubscribers.length} assinantes
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Templates de Email</CardTitle>
              <Button size="sm" onClick={() => setTemplateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Novo Template
              </Button>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <EmptyState 
                  icon={Mail} 
                  title="Nenhum template" 
                  description="Crie templates reutilizáveis para suas campanhas"
                  action={{ label: "Criar Template", onClick: () => setTemplateDialogOpen(true) }}
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {templates.map((tpl: any) => (
                    <div key={tpl.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Mail className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{tpl.name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{tpl.subject}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Campanhas</CardTitle>
              <Button size="sm" onClick={() => setCampaignDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Nova Campanha
              </Button>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <EmptyState 
                  icon={Megaphone} 
                  title="Nenhuma campanha" 
                  description="Crie campanhas para enviar emails em massa"
                  action={{ label: "Criar Campanha", onClick: () => setCampaignDialogOpen(true) }}
                />
              ) : (
                <div className="space-y-2">
                  {campaigns.map((camp: any) => (
                    <div key={camp.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{camp.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {camp.type === 'broadcast' ? 'Broadcast' : 'Automação'} • {camp.sent_count || 0} enviados
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={camp.status === 'active' ? 'default' : 'secondary'}>
                          {camp.status === 'active' ? 'Ativa' : camp.status === 'draft' ? 'Rascunho' : camp.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ListDialog open={listDialogOpen} onOpenChange={setListDialogOpen} />
      <TemplateDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen} />
      <CampaignDialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen} />
    </div>
  );
}
