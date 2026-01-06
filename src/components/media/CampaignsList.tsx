import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Calendar, MoreVertical, Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { EmptyState } from "@/components/ui/empty-state";
import { useMediaCampaigns, MediaCampaign } from "@/hooks/useMediaCampaigns";
import { CreateCampaignDialog } from "./CreateCampaignDialog";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  planning: { label: "Planejando", variant: "outline" },
  generating: { label: "Gerando", variant: "default" },
  ready: { label: "Pronto", variant: "default" },
  active: { label: "Ativo", variant: "default" },
  paused: { label: "Pausado", variant: "secondary" },
  completed: { label: "Concluído", variant: "outline" },
  archived: { label: "Arquivado", variant: "secondary" },
};

export function CampaignsList() {
  const navigate = useNavigate();
  const { campaigns, isLoading, deleteCampaign } = useMediaCampaigns();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<MediaCampaign | null>(null);

  const handleDelete = () => {
    if (campaignToDelete) {
      deleteCampaign.mutate(campaignToDelete.id);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const openCampaign = (campaign: MediaCampaign) => {
    navigate(`/media/campaign/${campaign.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Calendar}
              title="Nenhuma campanha criada"
              description="Crie sua primeira campanha de conteúdo e deixe a IA gerar um calendário editorial completo para suas redes sociais."
              action={{
                label: "Criar Campanha",
                onClick: () => setCreateDialogOpen(true),
              }}
            />
          </CardContent>
        </Card>
        <CreateCampaignDialog 
          open={createDialogOpen} 
          onOpenChange={setCreateDialogOpen}
          onSuccess={(campaign) => openCampaign(campaign)}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const status = statusLabels[campaign.status] || statusLabels.draft;
          return (
            <Card 
              key={campaign.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => openCampaign(campaign)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {campaign.prompt}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openCampaign(campaign); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver calendário
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setCampaignToDelete(campaign); 
                          setDeleteDialogOpen(true); 
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(campaign.start_date), "dd MMM", { locale: ptBR })} - {format(new Date(campaign.end_date), "dd MMM", { locale: ptBR })}
                    </span>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{campaign.items_count || 0} itens</span>
                  <span>{campaign.approved_count || 0} aprovados</span>
                  <span>{campaign.published_count || 0} publicados</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CreateCampaignDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onSuccess={(campaign) => openCampaign(campaign)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha "{campaignToDelete?.name}" e todos os seus itens serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
