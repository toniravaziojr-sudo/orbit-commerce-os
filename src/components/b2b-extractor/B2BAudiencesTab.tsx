// =============================================
// B2B AUDIENCES TAB - Gerenciamento de públicos
// =============================================

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, Trash2, Edit2, Download, Loader2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface B2BAudience {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  total_entities: number;
  entities_with_email: number;
  entities_with_phone: number;
  entities_with_consent: number;
  is_active: boolean;
  created_at: string;
}

export default function B2BAudiencesTab() {
  const { currentTenant, user } = useAuth();
  const [audiences, setAudiences] = useState<B2BAudience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTags, setFormTags] = useState("");

  useEffect(() => {
    if (currentTenant?.id) {
      loadAudiences();
    }
  }, [currentTenant?.id]);

  const loadAudiences = async () => {
    if (!currentTenant?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("b2b_audiences")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAudiences(data || []);
    } catch (err: any) {
      console.error("Load audiences error:", err);
      toast.error("Erro ao carregar públicos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!currentTenant?.id || !user?.id) {
      toast.error("Erro de autenticação");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("b2b_audiences").insert({
        tenant_id: currentTenant.id,
        created_by: user.id,
        name: formName.trim(),
        description: formDescription.trim() || null,
        tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
      });

      if (error) throw error;

      toast.success("Público criado!");
      setIsDialogOpen(false);
      resetForm();
      loadAudiences();
    } catch (err: any) {
      console.error("Create audience error:", err);
      toast.error("Erro ao criar público");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este público?")) return;

    try {
      const { error } = await supabase
        .from("b2b_audiences")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setAudiences((prev) => prev.filter((a) => a.id !== id));
      toast.success("Público excluído");
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error("Erro ao excluir");
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormTags("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Públicos Salvos</h2>
          <p className="text-sm text-muted-foreground">
            Organize suas empresas em listas para campanhas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Público
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Público</DialogTitle>
              <DialogDescription>
                Crie uma lista para agrupar empresas e exportar contatos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Restaurantes SP"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descrição opcional..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="tags"
                  placeholder="Ex: gastronomia, são paulo, prospecção"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Audiences Grid */}
      {audiences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhum público criado</p>
            <p className="text-sm text-muted-foreground">
              Crie públicos para organizar suas empresas e exportar listas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {audiences.map((audience) => (
            <Card key={audience.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{audience.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(audience.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {audience.description && (
                  <CardDescription className="line-clamp-2">
                    {audience.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-muted rounded">
                    <p className="font-semibold">{audience.total_entities}</p>
                    <p className="text-muted-foreground">Empresas</p>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded">
                    <p className="font-semibold text-blue-600">{audience.entities_with_email}</p>
                    <p className="text-muted-foreground">E-mails</p>
                  </div>
                  <div className="p-2 bg-green-500/10 rounded">
                    <p className="font-semibold text-green-600">{audience.entities_with_phone}</p>
                    <p className="text-muted-foreground">Telefones</p>
                  </div>
                </div>

                {/* Tags */}
                {audience.tags && audience.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {audience.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {audience.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{audience.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-1" />
                    Exportar
                  </Button>
                </div>

                {/* Created Date */}
                <p className="text-xs text-muted-foreground">
                  Criado em {format(new Date(audience.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
