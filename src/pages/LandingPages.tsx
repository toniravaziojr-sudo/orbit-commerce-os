// =============================================
// LANDING PAGES - Management page for landing pages
// =============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorePages } from '@/hooks/useStorePages';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Rocket, Eye, LayoutTemplate, Copy, Menu as MenuIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useLandingPages } from '@/hooks/useLandingPages';

export default function LandingPages() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { landingPages, isLoading, createLandingPage, updateLandingPage, deleteLandingPage, duplicateLandingPage } = useLandingPages();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
  });
  const [editFormData, setEditFormData] = useState({
    title: '',
    slug: '',
    status: 'draft' as 'draft' | 'published',
    show_in_menu: false,
    menu_label: '',
  });

  const resetForm = () => {
    setFormData({ title: '', slug: '' });
  };

  const resetEditForm = () => {
    setEditFormData({ title: '', slug: '', status: 'draft', show_in_menu: false, menu_label: '' });
    setEditingPage(null);
  };

  const handleSubmit = async () => {
    const slug = formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const newPage = await createLandingPage.mutateAsync({ title: formData.title, slug });
    setIsDialogOpen(false);
    resetForm();
    // Navigate to builder after creation
    if (newPage?.id) {
      navigate(`/pages/${newPage.id}/builder`);
    }
  };

  const handleEdit = (page: any) => {
    setEditingPage(page);
    setEditFormData({
      title: page.title,
      slug: page.slug,
      status: page.status || (page.is_published ? 'published' : 'draft'),
      show_in_menu: page.show_in_menu || false,
      menu_label: page.menu_label || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingPage) return;
    const slug = editFormData.slug || editFormData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await updateLandingPage.mutateAsync({
      id: editingPage.id,
      title: editFormData.title,
      slug,
      status: editFormData.status,
      is_published: editFormData.status === 'published',
      show_in_menu: editFormData.show_in_menu,
      menu_label: editFormData.menu_label || null,
    });
    setIsEditDialogOpen(false);
    resetEditForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteLandingPage.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    await duplicateLandingPage.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Landing Pages"
        description="Crie páginas de destino personalizadas para campanhas e promoções."
        actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova Landing Page</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Landing Page</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Nome da Página *</Label>
                  <Input 
                    value={formData.title} 
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                    placeholder="Ex: Black Friday 2024"
                  />
                </div>
                <div>
                  <Label>Slug (URL)</Label>
                  <Input 
                    value={formData.slug} 
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })} 
                    placeholder="black-friday-2024 (gerado automaticamente)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A página ficará em: /store/{currentTenant?.slug}/lp/{formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'slug'}
                  </p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Será criada usando o template <strong>Página Neutra</strong>
                  </p>
                </div>
                <Button onClick={handleSubmit} disabled={!formData.title || createLandingPage.isPending} className="w-full">
                  {createLandingPage.isPending ? 'Criando...' : 'Criar Landing Page'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Menu</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {landingPages?.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-muted-foreground" />
                      {page.title}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">/lp/{page.slug}</TableCell>
                  <TableCell>
                    {page.show_in_menu ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <MenuIcon className="h-3 w-3 mr-1" />
                        No menu
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={page.is_published ? 'default' : 'secondary'}>
                      {page.is_published ? 'Publicado' : 'Rascunho'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => navigate(`/pages/${page.id}/builder`)}
                        title="Editar no Builder Visual"
                      >
                        <LayoutTemplate className="h-4 w-4" />
                      </Button>
                      {page.is_published && (
                        <a 
                          href={`/store/${currentTenant?.slug}/lp/${page.slug}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="icon" title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEdit(page)} 
                        title="Editar Metadados"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDuplicate(page.id)} 
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setDeleteId(page.id)} 
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!landingPages || landingPages.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhuma landing page criada. Clique em "Nova Landing Page" para começar.
                  </TableCell>
                </TableRow>
              )}
              {(!landingPages || landingPages.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma landing page criada. Clique em "Nova Landing Page" para começar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir landing page?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) resetEditForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Landing Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome *</Label>
              <Input 
                value={editFormData.title} 
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} 
                placeholder="Ex: Black Friday 2024"
              />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input 
                value={editFormData.slug} 
                onChange={(e) => setEditFormData({ ...editFormData, slug: e.target.value })} 
                placeholder="black-friday-2024"
              />
            </div>
            
            <div>
              <Label>Status</Label>
              <Select 
                value={editFormData.status} 
                onValueChange={(v: 'draft' | 'published') => setEditFormData({ ...editFormData, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Menu Section */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <MenuIcon className="h-4 w-4" />
                Menu
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Exibir no menu</Label>
                    <p className="text-xs text-muted-foreground">Permite adicionar esta página nos menus</p>
                  </div>
                  <Switch
                    checked={editFormData.show_in_menu}
                    onCheckedChange={(v) => setEditFormData({ ...editFormData, show_in_menu: v })}
                  />
                </div>
                
                {editFormData.show_in_menu && (
                  <div>
                    <Label>Título no menu (opcional)</Label>
                    <Input 
                      value={editFormData.menu_label} 
                      onChange={(e) => setEditFormData({ ...editFormData, menu_label: e.target.value })}
                      placeholder={editFormData.title || 'Usa o nome da página'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Se vazio, usa o nome da página
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Button onClick={handleEditSubmit} disabled={!editFormData.title || updateLandingPage.isPending} className="w-full">
              {updateLandingPage.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
