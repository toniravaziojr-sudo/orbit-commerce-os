// =============================================
// PLATFORM ANNOUNCEMENTS MANAGEMENT
// Admin page for creating/managing system-wide announcements
// =============================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  ExternalLink,
  Calendar,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Announcement {
  id: string;
  title: string;
  message: string;
  variant: 'info' | 'warning' | 'error' | 'success';
  link_url: string | null;
  link_text: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  created_by: string | null;
}

const variantConfig = {
  info: { label: 'Novidade (Verde)', icon: Info, color: 'text-success' },
  warning: { label: 'Alerta (Laranja)', icon: AlertTriangle, color: 'text-warning' },
  error: { label: 'Problema (Vermelho)', icon: AlertCircle, color: 'text-destructive' },
  success: { label: 'Sucesso (Verde)', icon: CheckCircle, color: 'text-success' },
};

const defaultFormData = {
  title: '',
  message: '',
  variant: 'info' as const,
  link_url: '',
  link_text: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
};

export default function PlatformAnnouncements() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  
  // Fetch announcements
  const { data: announcements, isLoading } = useQuery({
    queryKey: ['platform-announcements-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Announcement[];
    },
  });
  
  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title,
        message: data.message,
        variant: data.variant,
        link_url: data.link_url || null,
        link_text: data.link_text || null,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
        is_active: data.is_active,
      };
      
      if (editingId) {
        const { error } = await supabase
          .from('platform_announcements')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_announcements')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-announcements'] });
      toast.success(editingId ? 'Aviso atualizado!' : 'Aviso criado!');
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error('Erro ao salvar aviso');
      console.error(error);
    },
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_announcements')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-announcements'] });
      toast.success('Aviso removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover aviso');
      console.error(error);
    },
  });
  
  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('platform_announcements')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-announcements'] });
      toast.success('Status atualizado!');
    },
  });
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
  };
  
  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      variant: announcement.variant,
      link_url: announcement.link_url || '',
      link_text: announcement.link_text || '',
      starts_at: announcement.starts_at ? announcement.starts_at.split('T')[0] : '',
      ends_at: announcement.ends_at ? announcement.ends_at.split('T')[0] : '',
      is_active: announcement.is_active,
    });
    setIsDialogOpen(true);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      toast.error('Título e mensagem são obrigatórios');
      return;
    }
    saveMutation.mutate(formData);
  };
  
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Avisos da Plataforma"
        description="Gerencie avisos que aparecem para todos os clientes/tenants"
        actions={
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Aviso
          </Button>
        }
      />
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Avisos Ativos e Programados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !announcements?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum aviso cadastrado. Clique em "Novo Aviso" para criar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((announcement) => {
                  const config = variantConfig[announcement.variant];
                  const Icon = config.icon;
                  
                  return (
                    <TableRow key={announcement.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          <span className="text-sm">{config.label.split(' ')[0]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{announcement.title}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {announcement.message}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {announcement.starts_at ? (
                            <span>{format(new Date(announcement.starts_at), "dd/MM/yy", { locale: ptBR })}</span>
                          ) : (
                            <span className="text-muted-foreground">Sempre</span>
                          )}
                          {announcement.ends_at && (
                            <span> → {format(new Date(announcement.ends_at), "dd/MM/yy", { locale: ptBR })}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={announcement.is_active ? "success" : "warning"}>
                          {announcement.is_active ? "Ativo" : "Inativo"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActiveMutation.mutate({ 
                              id: announcement.id, 
                              is_active: !announcement.is_active 
                            })}
                          >
                            {announcement.is_active ? (
                              <ToggleRight className="h-4 w-4 text-success" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(announcement)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(announcement.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Aviso' : 'Novo Aviso'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Manutenção programada"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Descrição detalhada do aviso..."
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="variant">Tipo de Aviso</Label>
              <Select
                value={formData.variant}
                onValueChange={(value: typeof formData.variant) => 
                  setFormData({ ...formData, variant: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">🟢 Novidade (Verde)</SelectItem>
                  <SelectItem value="warning">🟠 Alerta (Laranja)</SelectItem>
                  <SelectItem value="error">🔴 Problema (Vermelho)</SelectItem>
                  <SelectItem value="info">🔵 Informação (Azul)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="link_url">Link (opcional)</Label>
                <Input
                  id="link_url"
                  type="url"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link_text">Texto do Link</Label>
                <Input
                  id="link_text"
                  value={formData.link_text}
                  onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                  placeholder="Saiba mais"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Data Início (opcional)</Label>
                <Input
                  id="starts_at"
                  type="date"
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends_at">Data Fim (opcional)</Label>
                <Input
                  id="ends_at"
                  type="date"
                  value={formData.ends_at}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                />
              </div>
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
