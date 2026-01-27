// =============================================
// PLATFORM TUTORIALS MANAGEMENT
// Admin page for creating/managing module tutorial videos
// =============================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, PlayCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";

interface Tutorial {
  id: string;
  module_key: string;
  video_url: string;
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

// Available modules that can have tutorials
const availableModules = [
  { key: 'command-center', label: 'Central de Execuções' },
  { key: 'orders', label: 'Pedidos' },
  { key: 'abandoned-checkouts', label: 'Checkout Abandonado' },
  { key: 'products', label: 'Produtos' },
  { key: 'customers', label: 'Clientes' },
  { key: 'storefront', label: 'Loja Virtual' },
  { key: 'categories', label: 'Categorias' },
  { key: 'menus', label: 'Menus' },
  { key: 'pages', label: 'Páginas da Loja' },
  { key: 'blog', label: 'Blog' },
  { key: 'marketing', label: 'Integrações Marketing' },
  { key: 'email-marketing', label: 'Email Marketing' },
  { key: 'quizzes', label: 'Quizzes' },
  { key: 'discounts', label: 'Descontos' },
  { key: 'offers', label: 'Aumentar Ticket' },
  { key: 'reviews', label: 'Avaliações' },
  { key: 'media', label: 'Gestão de Mídias' },
  { key: 'campaigns', label: 'Criador de Campanhas' },
  { key: 'notifications', label: 'Notificações' },
  { key: 'support', label: 'Atendimento' },
  { key: 'emails', label: 'Emails' },
  { key: 'fiscal', label: 'Fiscal' },
  { key: 'finance', label: 'Financeiro' },
  { key: 'purchases', label: 'Compras' },
  { key: 'shipping', label: 'Logística' },
  { key: 'influencers', label: 'Influencers' },
  { key: 'affiliates', label: 'Afiliados' },
  { key: 'integrations', label: 'Integrações' },
  { key: 'import', label: 'Importar Dados' },
  { key: 'users', label: 'Usuários e Permissões' },
  { key: 'files', label: 'Meu Drive' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'support-center', label: 'Suporte' },
];

const defaultFormData = {
  module_key: '',
  video_url: '',
  thumbnail_url: '',
  title: '',
  description: '',
  is_active: true,
};

export default function PlatformTutorials() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  
  // Fetch tutorials
  const { data: tutorials, isLoading } = useQuery({
    queryKey: ['module-tutorials-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_tutorials')
        .select('*')
        .order('module_key', { ascending: true });
      
      if (error) throw error;
      return data as Tutorial[];
    },
  });
  
  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        module_key: data.module_key,
        video_url: data.video_url,
        thumbnail_url: data.thumbnail_url || null,
        title: data.title,
        description: data.description || null,
        is_active: data.is_active,
      };
      
      if (editingId) {
        const { error } = await supabase
          .from('module_tutorials')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('module_tutorials')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module-tutorials'] });
      toast.success(editingId ? 'Tutorial atualizado!' : 'Tutorial criado!');
      handleCloseDialog();
    },
    onError: (error: any) => {
      if (error.message?.includes('unique')) {
        toast.error('Já existe um tutorial para este módulo');
      } else {
        toast.error('Erro ao salvar tutorial');
      }
      console.error(error);
    },
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('module_tutorials')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['module-tutorials'] });
      toast.success('Tutorial removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover tutorial');
      console.error(error);
    },
  });
  
  // Get used module keys
  const usedModules = tutorials?.map(t => t.module_key) || [];
  const availableModulesFiltered = editingId 
    ? availableModules 
    : availableModules.filter(m => !usedModules.includes(m.key));
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
  };
  
  const handleEdit = (tutorial: Tutorial) => {
    setEditingId(tutorial.id);
    setFormData({
      module_key: tutorial.module_key,
      video_url: tutorial.video_url,
      thumbnail_url: tutorial.thumbnail_url || '',
      title: tutorial.title,
      description: tutorial.description || '',
      is_active: tutorial.is_active,
    });
    setIsDialogOpen(true);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.module_key || !formData.video_url || !formData.title) {
      toast.error('Módulo, URL do vídeo e título são obrigatórios');
      return;
    }
    saveMutation.mutate(formData);
  };
  
  const getModuleLabel = (key: string) => {
    return availableModules.find(m => m.key === key)?.label || key;
  };
  
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tutoriais por Módulo"
        description="Configure vídeos tutoriais que aparecem em cada módulo do sistema"
        actions={
          <Button 
            onClick={() => setIsDialogOpen(true)} 
            className="gap-2"
            disabled={availableModulesFiltered.length === 0}
          >
            <Plus className="h-4 w-4" />
            Novo Tutorial
          </Button>
        }
      />
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Tutoriais Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !tutorials?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum tutorial cadastrado. Clique em "Novo Tutorial" para criar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tutorials.map((tutorial) => (
                  <TableRow key={tutorial.id}>
                    <TableCell>
                      <span className="font-medium">{getModuleLabel(tutorial.module_key)}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tutorial.title}</p>
                        {tutorial.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {tutorial.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a 
                        href={tutorial.video_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <PlayCircle className="h-4 w-4" />
                        <span className="truncate max-w-32">Ver vídeo</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={tutorial.is_active ? "success" : "warning"}>
                        {tutorial.is_active ? "Ativo" : "Inativo"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(tutorial)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(tutorial.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Tutorial' : 'Novo Tutorial'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="module_key">Módulo *</Label>
              <Select
                value={formData.module_key}
                onValueChange={(value) => setFormData({ ...formData, module_key: value })}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o módulo" />
                </SelectTrigger>
                <SelectContent>
                  {(editingId ? availableModules : availableModulesFiltered).map((module) => (
                    <SelectItem key={module.key} value={module.key}>
                      {module.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Como gerenciar pedidos"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="video_url">URL do Vídeo *</Label>
              <Input
                id="video_url"
                type="url"
                value={formData.video_url}
                onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
              />
              <p className="text-xs text-muted-foreground">
                Suporta YouTube, Vimeo e Loom
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="thumbnail_url">URL da Thumbnail (opcional)</Label>
              <Input
                id="thumbnail_url"
                type="url"
                value={formData.thumbnail_url}
                onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição do que o tutorial ensina..."
                rows={2}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Ativo</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : (editingId ? 'Salvar' : 'Criar')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
