import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { Mail, Users, Megaphone, ListPlus, Plus, MoreHorizontal, Eye, Trash2, Edit, ChevronRight, Workflow, Pause, Play, Copy, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListDialog } from "@/components/email-marketing/ListDialog";
import { TemplateDialog } from "@/components/email-marketing/TemplateDialog";
import { CampaignDialog } from "@/components/email-marketing/CampaignDialog";
import { SubscribersTab } from "@/components/email-marketing/SubscribersTab";
import { AttributionsTab } from "@/components/email-marketing/AttributionsTab";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { showErrorToast } from "@/lib/error-toast";

export default function EmailMarketing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const emailMarketing = useEmailMarketing();
  const { lists, templates, campaigns, queueStats, subscribersCount, listsLoading, listsError, refetchLists, automationFlows, tenantId } = emailMarketing;

  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);

  // Render error state if needed
  if (listsError) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader title="Email Marketing" description="Gerencie listas, assinantes, templates e campanhas de email" />
        <QueryErrorState title="Erro ao carregar email marketing" onRetry={() => refetchLists()} />
      </div>
    );
  }

  const handleViewList = (list: any) => {
    navigate(`/email-marketing/list/${list.id}`);
  };

  const handlePauseCampaign = async (camp: any) => {
    const newStatus = camp.status === "paused" ? "active" : "paused";
    try {
      const { error } = await supabase
        .from("email_marketing_campaigns")
        .update({ status: newStatus })
        .eq("id", camp.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["email-marketing-campaigns"] });
      toast.success(newStatus === "paused" ? "Campanha pausada" : "Campanha retomada");
    } catch (err) {
      showErrorToast(err, { module: "email", action: "atualizar" });
    }
  };

  const handleDeleteCampaign = async () => {
    if (!deleteCampaignId) return;
    try {
      const { error } = await supabase
        .from("email_marketing_campaigns")
        .delete()
        .eq("id", deleteCampaignId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["email-marketing-campaigns"] });
      toast.success("Campanha excluída");
    } catch (err) {
      showErrorToast(err, { module: "email", action: "excluir" });
    } finally {
      setDeleteCampaignId(null);
    }
  };

  const handleDuplicateCampaign = async (camp: any) => {
    if (!tenantId) return;
    try {
      const { error } = await supabase
        .from("email_marketing_campaigns")
        .insert({
          tenant_id: tenantId,
          name: `${camp.name} (cópia)`,
          type: camp.type,
          list_id: camp.list_id,
          template_id: camp.template_id,
          status: "draft",
        });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["email-marketing-campaigns"] });
      toast.success("Campanha duplicada como rascunho");
    } catch (err) {
      showErrorToast(err, { module: "email", action: "duplicar" });
    }
  };

  const getCampaignStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Ativa";
      case "draft": return "Rascunho";
      case "paused": return "Pausada";
      case "sent": return "Enviada";
      default: return status;
    }
  };

  const getCampaignStatusVariant = (status: string) => {
    switch (status) {
      case "active": return "default" as const;
      case "paused": return "outline" as const;
      case "sent": return "secondary" as const;
      default: return "secondary" as const;
    }
  };

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
            <div className="text-2xl font-bold">{subscribersCount?.toLocaleString("pt-BR") || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enviados (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{queueStats?.sent || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Na Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{queueStats?.queued || 0}</div>
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
          <TabsTrigger value="automations" className="gap-2"><Workflow className="h-4 w-4" />Automações</TabsTrigger>
          <TabsTrigger value="attributions" className="gap-2"><TrendingUp className="h-4 w-4" />Atribuições</TabsTrigger>
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
                          <p className="text-xs font-medium text-muted-foreground">
                            {(list as any).member_count?.toLocaleString("pt-BR") ?? "—"} leads
                          </p>
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
          <SubscribersTab />
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
              <Button size="sm" onClick={() => navigate("/email-marketing/campaign/new")}>
                <Plus className="h-4 w-4 mr-2" />Nova Campanha
              </Button>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <EmptyState 
                  icon={Megaphone} 
                  title="Nenhuma campanha" 
                  description="Crie campanhas para enviar emails em massa"
                  action={{ label: "Criar Campanha", onClick: () => navigate("/email-marketing/campaign/new") }}
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
                        {(camp.sent_count || 0) > 0 && (
                          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                            <span title="Aberturas">
                              📬 {camp.sent_count > 0 ? Math.round(((camp.unique_open_count || 0) / camp.sent_count) * 100) : 0}%
                            </span>
                            <span title="Cliques">
                              🔗 {camp.sent_count > 0 ? Math.round(((camp.unique_click_count || 0) / camp.sent_count) * 100) : 0}%
                            </span>
                            <span title="Conversões">
                              💰 {camp.conversion_count || 0}
                              {(camp.conversion_value_cents || 0) > 0 && (
                                <> ({(camp.conversion_value_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</>
                              )}
                            </span>
                          </div>
                        )}
                        <Badge variant={getCampaignStatusVariant(camp.status)}>
                          {getCampaignStatusLabel(camp.status)}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
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
                            {(camp.status === "active" || camp.status === "paused") && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePauseCampaign(camp); }}>
                                {camp.status === "paused" ? (
                                  <><Play className="h-4 w-4 mr-2" />Retomar</>
                                ) : (
                                  <><Pause className="h-4 w-4 mr-2" />Pausar</>
                                )}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicateCampaign(camp); }}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteCampaignId(camp.id); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
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

        <TabsContent value="automations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Automações</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie fluxos automatizados com condições, delays e ações
                </p>
              </div>
              <Button size="sm" onClick={() => navigate("/email-marketing/automation/new")}>
                <Plus className="h-4 w-4 mr-2" />Nova Automação
              </Button>
            </CardHeader>
            <CardContent>
              {automationFlows.length === 0 ? (
                <EmptyState
                  icon={Workflow}
                  title="Nenhuma automação"
                  description="Crie fluxos visuais para automatizar emails, tags e segmentação"
                  action={{ label: "Criar Automação", onClick: () => navigate("/email-marketing/automation/new") }}
                />
              ) : (
                <div className="space-y-2">
                  {automationFlows.map((flow: any) => (
                    <div
                      key={flow.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/email-marketing/automation/${flow.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Workflow className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{flow.name || "Sem nome"}</p>
                          <p className="text-sm text-muted-foreground">
                            {flow.trigger_type === "list_subscription" ? "Entrada na lista" : flow.trigger_type}
                            {" • "}{flow.node_count} blocos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={flow.status === "active" ? "default" : "secondary"}>
                          {flow.status === "active" ? "Ativa" : flow.status === "draft" ? "Rascunho" : flow.status === "paused" ? "Pausada" : flow.status}
                        </Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attributions">
          <AttributionsTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ListDialog open={listDialogOpen} onOpenChange={setListDialogOpen} />
      <TemplateDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen} />
      <CampaignDialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen} />

      {/* Delete Campaign Confirmation */}
      <AlertDialog open={!!deleteCampaignId} onOpenChange={(open) => !open && setDeleteCampaignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}