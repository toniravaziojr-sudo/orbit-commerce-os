// =============================================
// BLOG CAMPAIGNS - Manage AI-generated blog campaigns
// =============================================

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Calendar, MoreVertical, Pencil, Trash2, BookOpen, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths, startOfMonth, endOfMonth, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMediaCampaigns, MediaCampaign } from "@/hooks/useMediaCampaigns";

// Generate available months for campaign selection
const getAvailableMonths = () => {
  const now = new Date();
  const months = [];
  
  for (let i = 0; i < 6; i++) {
    const monthDate = addMonths(now, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const start = i === 0 ? startOfDay(now) : monthStart;
    
    months.push({
      value: format(monthDate, "yyyy-MM"),
      label: format(monthDate, "MMMM", { locale: ptBR }),
      shortLabel: format(monthDate, "MMM", { locale: ptBR }),
      fullLabel: format(monthDate, "MMMM yyyy", { locale: ptBR }),
      start,
      end: monthEnd,
      isCurrent: i === 0,
    });
  }
  
  return months;
};

export default function BlogCampaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const { campaigns, isLoading, createCampaign, deleteCampaign, updateCampaign } = useMediaCampaigns();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<MediaCampaign | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    prompt: "",
    selectedMonth: "",
  });

  const availableMonths = getAvailableMonths();

  // Filter only blog campaigns
  const blogCampaigns = campaigns?.filter(c => c.target_channel === "blog") || [];

  const resetForm = () => {
    setFormData({ name: "", prompt: "", selectedMonth: availableMonths[0]?.value || "" });
    setEditingCampaign(null);
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditCampaign = (campaign: MediaCampaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      prompt: campaign.prompt || "",
      selectedMonth: format(new Date(campaign.start_date), "yyyy-MM"),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const monthData = availableMonths.find(m => m.value === formData.selectedMonth);
    if (!monthData) {
      toast.error("Selecione um mês");
      return;
    }

    try {
      if (editingCampaign) {
        await updateCampaign.mutateAsync({
          id: editingCampaign.id,
          name: formData.name,
          prompt: formData.prompt,
        });
        toast.success("Campanha atualizada");
      } else {
        const result = await createCampaign.mutateAsync({
          name: formData.name,
          prompt: formData.prompt,
          start_date: format(monthData.start, "yyyy-MM-dd"),
          end_date: format(monthData.end, "yyyy-MM-dd"),
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          target_channel: "blog",
        });
        toast.success("Campanha criada");
        navigate(`/blog/campaigns/${result.id}`);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar campanha");
    }
  };

  const handleDeleteCampaign = async () => {
    if (!deleteId) return;
    
    try {
      await deleteCampaign.mutateAsync(deleteId);
      toast.success("Campanha excluída");
      setDeleteId(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir campanha");
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Ativa";
      case "ready": return "Pronta";
      case "generating": return "Gerando";
      case "completed": return "Concluída";
      default: return "Rascunho";
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case "active": return "default";
      case "ready": return "default";
      case "generating": return "secondary";
      case "completed": return "outline";
      default: return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Campanhas de Blog"
        description="Crie campanhas de artigos e deixe a IA gerar seu calendário editorial"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/blog")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Blog
            </Button>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </div>
        }
      />

      {blogCampaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhuma campanha de blog</h3>
            <p className="text-muted-foreground max-w-sm mb-4">
              Crie sua primeira campanha e deixe a IA gerar um calendário completo de artigos para seu blog.
            </p>
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blogCampaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="group cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/blog/campaigns/${campaign.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {format(new Date(campaign.start_date), "MMM yyyy", { locale: ptBR })}
                    </CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/blog/campaigns/${campaign.id}`);
                    }}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Ver calendário
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleEditCampaign(campaign);
                    }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(campaign.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                {campaign.prompt && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {campaign.prompt}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <Badge variant={getStatusVariant(campaign.status)}>
                    {getStatusLabel(campaign.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {campaign.items_count || 0} artigos
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? "Editar Campanha" : "Nova Campanha de Blog"}
            </DialogTitle>
            <DialogDescription>
              {editingCampaign
                ? "Atualize os dados da campanha."
                : "Crie uma campanha e a IA vai gerar sugestões de artigos."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nome da campanha *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Conteúdo de Janeiro"
              />
            </div>

            <div>
              <Label>Direcionamento / Briefing *</Label>
              <Textarea
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="Descreva os temas, tom de voz, e objetivos dos artigos..."
                className="min-h-[100px]"
              />
            </div>

            {!editingCampaign && (
              <div>
                <Label>Mês da campanha *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {availableMonths.map((month) => (
                    <button
                      key={month.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, selectedMonth: month.value })}
                      className={cn(
                        "px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                        "hover:border-primary hover:bg-primary/5",
                        formData.selectedMonth === month.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border"
                      )}
                    >
                      {month.isCurrent ? "Este mês" : month.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.prompt || (!editingCampaign && !formData.selectedMonth)}
            >
              {editingCampaign ? "Salvar" : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os artigos gerados nesta campanha serão removidos.
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
