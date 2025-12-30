import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorePages } from '@/hooks/useStorePages';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, FileText, Eye, LayoutTemplate, Menu as MenuIcon, Search, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';
import { validateSlug, generateSlug } from '@/lib/slugValidation';
import type { Json } from '@/integrations/supabase/types';

export default function Pages() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  const { pages, isLoading, createPage, updatePage, deletePage } = useStorePages();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    status: 'draft' as 'draft' | 'published',
    seo_title: '',
    seo_description: '',
    show_in_menu: false,
    menu_label: '',
    // SEO fields
    meta_title: '',
    meta_description: '',
    meta_image_url: '',
    no_index: false,
    canonical_url: '',
  });

  const resetForm = () => {
    setFormData({
      title: '', slug: '', content: '', status: 'draft', seo_title: '', seo_description: '',
      show_in_menu: false, menu_label: '',
      meta_title: '', meta_description: '', meta_image_url: '', no_index: false, canonical_url: '',
    });
    setEditingPage(null);
  };

  const handleEdit = (page: any) => {
    setEditingPage(page);
    const contentText = typeof page.content === 'object' && page.content?.text 
      ? page.content.text 
      : (typeof page.content === 'string' ? page.content : '');
    
    setFormData({
      title: page.title,
      slug: page.slug,
      content: contentText,
      status: page.status || (page.is_published ? 'published' : 'draft'),
      seo_title: page.seo_title || '',
      seo_description: page.seo_description || '',
      show_in_menu: page.show_in_menu || false,
      menu_label: page.menu_label || '',
      // SEO fields
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
      meta_image_url: page.meta_image_url || '',
      no_index: page.no_index || false,
      canonical_url: page.canonical_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const slug = formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Get the neutral template content
    const { defaultNeutralPageTemplate } = await import('@/lib/builder/defaults');
    
    if (editingPage) {
      // When editing, don't overwrite content
      const updateData = {
        id: editingPage.id,
        title: formData.title,
        slug,
        status: formData.status,
        is_published: formData.status === 'published',
        seo_title: formData.seo_title || null,
        seo_description: formData.seo_description || null,
        show_in_menu: formData.show_in_menu,
        menu_label: formData.menu_label || null,
        // SEO fields
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        meta_image_url: formData.meta_image_url || null,
        no_index: formData.no_index,
        canonical_url: formData.canonical_url || null,
      };
      await updatePage.mutateAsync(updateData);
      setIsDialogOpen(false);
      resetForm();
    } else {
      const data = {
        title: formData.title,
        slug,
        content: defaultNeutralPageTemplate as unknown as Json,
        status: formData.status,
        is_published: formData.status === 'published',
        seo_title: formData.seo_title || null,
        seo_description: formData.seo_description || null,
        type: 'institutional',
      };
      const newPage = await createPage.mutateAsync(data);
      // Navigate to builder after creation
      if (newPage?.id) {
        navigate(`/pages/${newPage.id}/builder`);
        return;
      }
      setIsDialogOpen(false);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deletePage.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleStatus = async (page: any) => {
    const newStatus = page.status === 'published' ? 'draft' : 'published';
    await updatePage.mutateAsync({ 
      id: page.id, 
      status: newStatus,
      is_published: newStatus === 'published',
    });
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
        title="Páginas Institucionais"
        description="Crie e gerencie páginas como Sobre Nós, Política de Privacidade, etc."
        actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova Página</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPage ? 'Editar Metadados' : 'Nova Página Institucional'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Título *</Label>
                    <Input 
                      value={formData.title} 
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                      placeholder="Ex: Sobre Nós"
                    />
                  </div>
                  <div>
                    <Label>Slug *</Label>
                    <Input 
                      value={formData.slug} 
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} 
                      placeholder="sobre-nos (gerado automaticamente)"
                      className={!validateSlug(formData.slug).isValid && formData.slug ? 'border-destructive' : ''}
                    />
                    {!validateSlug(formData.slug).isValid && formData.slug ? (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {validateSlug(formData.slug).error}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Usado na URL: /page/{formData.slug || 'slug'}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <Collapsible defaultOpen={!!editingPage}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full">
                      <Search className="h-4 w-4" />
                      SEO
                      <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4 space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>Meta Título</Label>
                          <span className="text-xs text-muted-foreground">{formData.meta_title.length}/60</span>
                        </div>
                        <Input 
                          value={formData.meta_title} 
                          onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                          placeholder={formData.title ? `${formData.title} | Loja` : 'Título para mecanismos de busca'}
                        />
                        {formData.meta_title.length > 60 && (
                          <p className="text-xs text-yellow-600 mt-1">Recomendado: até 60 caracteres</p>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>Meta Descrição</Label>
                          <span className="text-xs text-muted-foreground">{formData.meta_description.length}/160</span>
                        </div>
                        <Textarea 
                          value={formData.meta_description} 
                          onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                          placeholder="Descrição para mecanismos de busca"
                          className="min-h-[80px]"
                        />
                        {formData.meta_description.length > 160 && (
                          <p className="text-xs text-yellow-600 mt-1">Recomendado: até 160 caracteres</p>
                        )}
                      </div>
                      <div>
                        <Label className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Imagem OG (Open Graph)
                        </Label>
                        <Input 
                          value={formData.meta_image_url} 
                          onChange={(e) => setFormData({ ...formData, meta_image_url: e.target.value })}
                          placeholder="https://..."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Imagem exibida ao compartilhar nas redes sociais
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm">Não indexar (noindex)</Label>
                          <p className="text-xs text-muted-foreground">Impede que buscadores indexem esta página</p>
                        </div>
                        <Switch
                          checked={formData.no_index}
                          onCheckedChange={(v) => setFormData({ ...formData, no_index: v })}
                        />
                      </div>
                      <div>
                        <Label>URL Canônica (opcional)</Label>
                        <Input 
                          value={formData.canonical_url} 
                          onChange={(e) => setFormData({ ...formData, canonical_url: e.target.value })}
                          placeholder="https://... (usa URL atual se vazio)"
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* Menu Section */}
                {editingPage && (
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
                          checked={formData.show_in_menu}
                          onCheckedChange={(v) => setFormData({ ...formData, show_in_menu: v })}
                        />
                      </div>
                      
                      {formData.show_in_menu && (
                        <div>
                          <Label>Título no menu (opcional)</Label>
                          <Input 
                            value={formData.menu_label} 
                            onChange={(e) => setFormData({ ...formData, menu_label: e.target.value })}
                            placeholder={formData.title || 'Usa o título da página'}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Se vazio, usa o título da página
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Button onClick={handleSubmit} disabled={!formData.title} className="w-full">
                  {editingPage ? 'Salvar Metadados' : 'Criar e Abrir Editor'}
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
                <TableHead>Título</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Menu</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages?.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {page.title}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">/{page.slug}</TableCell>
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
                    <Badge 
                      variant={page.is_published ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => handleToggleStatus(page)}
                    >
                      {page.is_published ? 'Publicado' : 'Rascunho'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {/* Preview button - always show if valid slug */}
                      {primaryOrigin && page.slug && (
                        <a 
                          href={buildPublicStorefrontUrl(primaryOrigin, `/page/${page.slug}?preview=1`)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Button variant="outline" size="icon" title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate(`/pages/${page.id}/builder`)}
                        title="Editar no Builder Visual"
                      >
                        <LayoutTemplate className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(page)} title="Editar Metadados">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(page.id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!pages || pages.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma página criada. Clique em "Nova Página" para começar.
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
            <AlertDialogTitle>Excluir página?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
