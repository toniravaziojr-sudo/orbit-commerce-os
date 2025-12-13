import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Edit, Trash2, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StorePage {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  content: any;
  is_homepage: boolean;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

interface StorePagesTabProps {
  tenantId: string;
}

export function StorePagesTab({ tenantId }: StorePagesTabProps) {
  const [pages, setPages] = useState<StorePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<StorePage | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    is_homepage: false,
    is_published: true,
    seo_title: "",
    seo_description: "",
  });

  useEffect(() => {
    if (tenantId) {
      fetchPages();
    }
  }, [tenantId]);

  const fetchPages = async () => {
    try {
      const { data, error } = await supabase
        .from("store_pages")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error("Error fetching pages:", error);
      toast.error("Erro ao carregar páginas");
    } finally {
      setLoading(false);
    }
  };

  const openNewDialog = () => {
    setEditingPage(null);
    setFormData({
      title: "",
      slug: "",
      is_homepage: false,
      is_published: true,
      seo_title: "",
      seo_description: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (page: StorePage) => {
    setEditingPage(page);
    setFormData({
      title: page.title,
      slug: page.slug,
      is_homepage: page.is_homepage,
      is_published: page.is_published,
      seo_title: page.seo_title || "",
      seo_description: page.seo_description || "",
    });
    setDialogOpen(true);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: editingPage ? prev.slug : generateSlug(title),
    }));
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) {
      toast.error("Título e slug são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      if (editingPage) {
        const { error } = await supabase
          .from("store_pages")
          .update({
            title: formData.title,
            slug: formData.slug,
            is_homepage: formData.is_homepage,
            is_published: formData.is_published,
            seo_title: formData.seo_title || null,
            seo_description: formData.seo_description || null,
          })
          .eq("id", editingPage.id);

        if (error) throw error;
        toast.success("Página atualizada");
      } else {
        const { error } = await supabase.from("store_pages").insert({
          tenant_id: tenantId,
          title: formData.title,
          slug: formData.slug,
          is_homepage: formData.is_homepage,
          is_published: formData.is_published,
          seo_title: formData.seo_title || null,
          seo_description: formData.seo_description || null,
          content: [],
        });

        if (error) throw error;
        toast.success("Página criada");
      }

      setDialogOpen(false);
      fetchPages();
    } catch (error: any) {
      console.error("Error saving page:", error);
      if (error.code === "23505") {
        toast.error("Já existe uma página com esse slug");
      } else {
        toast.error("Erro ao salvar página");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (page: StorePage) => {
    if (!confirm(`Deseja excluir a página "${page.title}"?`)) return;

    try {
      const { error } = await supabase
        .from("store_pages")
        .delete()
        .eq("id", page.id);

      if (error) throw error;
      toast.success("Página excluída");
      fetchPages();
    } catch (error) {
      console.error("Error deleting page:", error);
      toast.error("Erro ao excluir página");
    }
  };

  const togglePublished = async (page: StorePage) => {
    try {
      const { error } = await supabase
        .from("store_pages")
        .update({ is_published: !page.is_published })
        .eq("id", page.id);

      if (error) throw error;
      fetchPages();
    } catch (error) {
      console.error("Error updating page:", error);
      toast.error("Erro ao atualizar página");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Páginas da Loja
            </CardTitle>
            <CardDescription>
              Gerencie as páginas da sua loja
            </CardDescription>
          </div>
          <Button onClick={openNewDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Página
          </Button>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Nenhuma página criada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie páginas personalizadas para sua loja
              </p>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Página
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {page.is_homepage && (
                          <Home className="h-4 w-4 text-primary" />
                        )}
                        {page.title}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      /{page.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant={page.is_published ? "default" : "secondary"}>
                        {page.is_published ? "Publicada" : "Rascunho"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={page.is_published}
                          onCheckedChange={() => togglePublished(page)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(page)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(page)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPage ? "Editar Página" : "Nova Página"}
            </DialogTitle>
            <DialogDescription>
              {editingPage
                ? "Atualize as informações da página"
                : "Crie uma nova página para sua loja"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Sobre Nós"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="sobre-nos"
              />
              <p className="text-xs text-muted-foreground">
                URL: /store/sua-loja/{formData.slug || "slug"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seo_title">Título SEO</Label>
              <Input
                id="seo_title"
                value={formData.seo_title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, seo_title: e.target.value }))
                }
                placeholder="Título para buscadores"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_homepage">Página Inicial</Label>
                <p className="text-xs text-muted-foreground">
                  Definir como homepage da loja
                </p>
              </div>
              <Switch
                id="is_homepage"
                checked={formData.is_homepage}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_homepage: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_published">Publicada</Label>
                <p className="text-xs text-muted-foreground">
                  Tornar visível no site
                </p>
              </div>
              <Switch
                id="is_published"
                checked={formData.is_published}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_published: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : editingPage ? (
                "Salvar"
              ) : (
                "Criar Página"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
