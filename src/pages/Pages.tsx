import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStorePages } from '@/hooks/useStorePages';
import { usePageTemplates } from '@/hooks/usePageTemplates';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, FileText, Eye, LayoutTemplate, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';
import { validateSlug } from '@/lib/slugValidation';
import { toast } from 'sonner';
import { ImportPageDialog } from '@/components/pages/ImportPageDialog';

export default function Pages() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  const { pages, isLoading, createPage, updatePage, deletePage, refetch } = useStorePages();
  const { templates, isLoading: templatesLoading, initializeDefaultTemplate, createTemplate } = usePageTemplates();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
  });

  // Initialize default template if none exists (hidden, serves as base)
  useEffect(() => {
    if (!templatesLoading && templates && templates.length === 0 && currentTenant?.id) {
      initializeDefaultTemplate.mutate();
    }
  }, [templatesLoading, templates, currentTenant?.id]);

  const resetForm = () => {
    setFormData({ title: '', slug: '' });
    setEditingPage(null);
  };

  const handleEdit = (page: any) => {
    setEditingPage(page);
    setFormData({
      title: page.title,
      slug: page.slug,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const slug = formData.slug || formData.title.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    if (editingPage) {
      // When editing, only update title and slug
      await updatePage.mutateAsync({
        id: editingPage.id,
        title: formData.title,
        slug,
      });
      setIsDialogOpen(false);
      resetForm();
    } else {
      // Create new page with auto-generated template
      setIsCreating(true);
      try {
        // 1. Create a dedicated template for this page with unique slug
        const templateName = `Modelo - ${formData.title}`;
        const uniqueSuffix = Date.now().toString(36);
        const newTemplate = await createTemplate.mutateAsync({
          name: templateName,
          slug: `modelo-${slug}-${uniqueSuffix}`,
          is_default: false,
        });

        // 2. Create the page linked to this template
        const data = {
          title: formData.title,
          slug,
          content: null,
          status: 'draft' as const,
          is_published: false,
          type: 'institutional',
          template_id: newTemplate.id,
        };
        const newPage = await createPage.mutateAsync(data);
        
        setIsDialogOpen(false);
        resetForm();
        
        // 3. Redirect to the page builder
        toast.success('Página criada! Abrindo o editor...');
        navigate(`/pages/${newPage.id}/builder`);
      } catch (error) {
        console.error('Error creating page:', error);
        toast.error('Erro ao criar página');
      } finally {
        setIsCreating(false);
      }
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
        title="Páginas da Loja"
        description="Crie e gerencie páginas como Sobre Nós, Política de Privacidade, Landing Pages, etc."
        actions={
          <div className="flex gap-2">
            {currentTenant?.id && (
              <ImportPageDialog 
                tenantId={currentTenant.id} 
                onSuccess={() => refetch()} 
              />
            )}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Nova Página</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingPage ? 'Editar Página' : 'Nova Página'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Título *</Label>
                    <Input 
                      value={formData.title} 
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                      placeholder="Ex: Sobre Nós"
                    />
                  </div>
                  <div>
                    <Label>Slug</Label>
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

                  {!editingPage && (
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      Após criar a página, você será redirecionado ao editor visual para construir o conteúdo.
                    </p>
                  )}

                  <Button 
                    onClick={handleSubmit} 
                    disabled={!formData.title || isCreating} 
                    className="w-full"
                  >
                    {isCreating ? 'Criando...' : editingPage ? 'Salvar' : 'Criar e Abrir Editor'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Slug</TableHead>
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
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
