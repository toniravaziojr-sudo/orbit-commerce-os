import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { Mail, Users, Megaphone, ListPlus, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListDialog } from "@/components/email-marketing/ListDialog";
import { TemplateDialog } from "@/components/email-marketing/TemplateDialog";
import { CampaignDialog } from "@/components/email-marketing/CampaignDialog";
import { Badge } from "@/components/ui/badge";

export default function EmailMarketing() {
  const { lists, subscribers, templates, campaigns, queueStats } = useEmailMarketing();
  
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);

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
              <CardTitle>Listas de Email</CardTitle>
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
                    <div key={list.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{list.name}</p>
                          <p className="text-sm text-muted-foreground">{list.description || "Sem descrição"}</p>
                        </div>
                      </div>
                      {list.customer_tags?.name && (
                        <Badge variant="secondary" style={{ backgroundColor: list.customer_tags.color }}>
                          {list.customer_tags.name}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscribers">
          <Card>
            <CardHeader><CardTitle>Assinantes</CardTitle></CardHeader>
            <CardContent>
              {subscribers.length === 0 ? (
                <EmptyState icon={Users} title="Nenhum assinante" description="Assinantes capturados via formulários aparecerão aqui" />
              ) : (
                <div className="space-y-2">
                  {subscribers.slice(0, 50).map((sub: any) => (
                    <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{sub.name || sub.email}</p>
                        <p className="text-sm text-muted-foreground">{sub.email}</p>
                      </div>
                      <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
                        {sub.status === 'active' ? 'Ativo' : sub.status}
                      </Badge>
                    </div>
                  ))}
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
                <div className="space-y-2">
                  {templates.map((tpl: any) => (
                    <div key={tpl.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">{tpl.name}</p>
                        <p className="text-sm text-muted-foreground">{tpl.subject}</p>
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
                    <div key={camp.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">{camp.name}</p>
                        <p className="text-sm text-muted-foreground">{camp.type} • {camp.sent_count || 0} enviados</p>
                      </div>
                      <Badge variant={camp.status === 'active' ? 'default' : 'secondary'}>
                        {camp.status === 'active' ? 'Ativo' : camp.status}
                      </Badge>
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
