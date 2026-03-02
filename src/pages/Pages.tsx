import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStorePages } from '@/hooks/useStorePages';
import { usePageTemplates } from '@/hooks/usePageTemplates';
import { useAuth } from '@/hooks/useAuth';
import { useAILandingPageUrl } from '@/hooks/useAILandingPageUrl';
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';
import { supabase } from '@/integrations/supabase/client';
import { validateSlug, generateSlug } from '@/lib/slugValidation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, Pencil, Trash2, FileText, Eye, LayoutTemplate, AlertCircle, Sparkles,
  ChevronDown, Copy, Globe, Clock, Settings, ExternalLink
} from 'lucide-react';
import { GenerateSeoButton } from '@/components/seo/GenerateSeoButton';
import { ImportPageWithAIDialog } from '@/components/import/ImportPageWithAIDialog';
import { CreateLandingPageDialog } from '@/components/landing-pages/CreateLandingPageDialog';
import { LandingPagePreviewDialog } from '@/components/landing-pages/LandingPagePreviewDialog';

// =============================================
// LANDING PAGE ITEM TYPE
// =============================================
interface LandingPageItem {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'generating' | 'published' | 'archived';
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  current_version: number;
  reference_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  source: 'ai' | 'builder';
}

export default function Pages() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant, user } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  const { pages, isLoading: pagesLoading, createPage, updatePage, deletePage, refetch } = useStorePages();
  const { templates, isLoading: templatesLoading, initializeDefaultTemplate, createTemplate } = usePageTemplates();

  // =============================================
  // STATE — Institutional Pages
  // =============================================
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [aiImportTarget, setAIImportTarget] = useState<'page' | 'landing_page'>('page');
  const [formData, setFormData] = useState({
    title: '', slug: '', seo_title: '', seo_description: '',
  });

  // =============================================
  // STATE — Landing Pages
  // =============================================
  const [createLPDialogOpen, setCreateLPDialogOpen] = useState(false);
  const [deleteLPTarget, setDeleteLPTarget] = useState<{ id: string; source: 'ai' | 'builder' } | null>(null);
  const [previewLPId, setPreviewLPId] = useState<string | null>(null);
  const [isBuilderDialogOpen, setIsBuilderDialogOpen] = useState(false);
  const [builderPageName, setBuilderPageName] = useState('');
  const [builderPageSlug, setBuilderPageSlug] = useState('');
  const [isCreatingBuilderPage, setIsCreatingBuilderPage] = useState(false);

  // =============================================
  // TABS
  // =============================================
  const [activeTab, setActiveTab] = useState<string>('pages');

  // Get tenant's public URL for LPs
  const { baseUrl: tenantBaseUrl } = useAILandingPageUrl({
    tenantId: currentTenant?.id,
    tenantSlug: currentTenant?.slug,
  });

  // Initialize default template if none exists
  useEffect(() => {
    if (!templatesLoading && templates && templates.length === 0 && currentTenant?.id) {
      initializeDefaultTemplate.mutate();
    }
  }, [templatesLoading, templates, currentTenant?.id]);

  // =============================================
  // QUERIES — Landing Pages
  // =============================================
  const { data: aiPages, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-landing-pages', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('ai_landing_pages')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id, name: p.name, slug: p.slug,
        status: p.status as LandingPageItem['status'],
        is_published: p.is_published || false,
        published_at: p.published_at, created_at: p.created_at, updated_at: p.updated_at,
        current_version: p.current_version || 0,
        reference_url: p.reference_url, seo_title: p.seo_title, seo_description: p.seo_description,
        source: 'ai' as const,
      }));
    },
    enabled: !!currentTenant?.id,
  });

  const { data: builderPages, isLoading: builderLoading } = useQuery({
    queryKey: ['builder-landing-pages', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('store_pages')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('type', 'landing_page')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id, name: p.title, slug: p.slug,
        status: (p.status || 'draft') as LandingPageItem['status'],
        is_published: p.is_published || false,
        published_at: null, created_at: p.created_at, updated_at: p.updated_at,
        current_version: 0, reference_url: null,
        seo_title: p.seo_title, seo_description: p.seo_description,
        source: 'builder' as const,
      }));
    },
    enabled: !!currentTenant?.id,
  });

  const landingPages = [...(aiPages || []), ...(builderPages || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isLoading = pagesLoading || aiLoading || builderLoading;

  // =============================================
  // HANDLERS — Institutional Pages
  // =============================================
  const resetForm = () => {
    setFormData({ title: '', slug: '', seo_title: '', seo_description: '' });
    setEditingPage(null);
  };

  const handleEdit = (page: any) => {
    setEditingPage(page);
    setFormData({
      title: page.title, slug: page.slug,
      seo_title: page.seo_title || page.meta_title || '',
      seo_description: page.seo_description || page.meta_description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const slug = formData.slug || formData.title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slugValidation = validateSlug(slug);
    if (!slugValidation.isValid) { toast.error(slugValidation.error || 'Slug inválido'); return; }
    const isDuplicate = pages?.some(p => p.slug === slug && (!editingPage || p.id !== editingPage.id));
    if (isDuplicate) { toast.error('Já existe uma página com este slug'); return; }
    if (editingPage) {
      await updatePage.mutateAsync({
        id: editingPage.id, title: formData.title, slug,
        seo_title: formData.seo_title || null, seo_description: formData.seo_description || null,
        meta_title: formData.seo_title || null, meta_description: formData.seo_description || null,
      });
      setIsDialogOpen(false); resetForm();
    } else {
      setIsCreating(true);
      try {
        const templateName = `Modelo - ${formData.title}`;
        const uniqueSuffix = Date.now().toString(36);
        const newTemplate = await createTemplate.mutateAsync({
          name: templateName, slug: `modelo-${slug}-${uniqueSuffix}`, is_default: false,
        });
        const data = {
          title: formData.title, slug, content: null, status: 'draft' as const,
          is_published: false, type: 'institutional', template_id: newTemplate.id,
        };
        const newPage = await createPage.mutateAsync(data);
        setIsDialogOpen(false); resetForm();
        toast.success('Página criada! Abrindo o editor...');
        navigate(`/pages/${newPage.id}/builder`);
      } catch (error) {
        console.error('Error creating page:', error);
        toast.error('Erro ao criar página');
      } finally { setIsCreating(false); }
    }
  };

  const handleDelete = async () => {
    if (deleteId) { await deletePage.mutateAsync(deleteId); setDeleteId(null); }
  };

  const handleToggleStatus = async (page: any) => {
    const newStatus = page.status === 'published' ? 'draft' : 'published';
    await updatePage.mutateAsync({ id: page.id, status: newStatus, is_published: newStatus === 'published' });
  };

  // =============================================
  // HANDLERS — Landing Pages
  // =============================================
  const deleteLPMutation = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: 'ai' | 'builder' }) => {
      const table = source === 'ai' ? 'ai_landing_pages' : 'store_pages';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['builder-landing-pages'] });
      toast.success('Landing page excluída');
      setDeleteLPTarget(null);
    },
    onError: () => { toast.error('Erro ao excluir landing page'); },
  });

  const handleCreateBuilderPage = async () => {
    if (!builderPageName.trim() || !currentTenant?.id || !user?.id) return;
    const slug = builderPageSlug || generateSlug(builderPageName);
    const slugValidation = validateSlug(slug);
    if (!slugValidation.isValid) { toast.error(slugValidation.error || 'Slug inválido'); return; }
    setIsCreatingBuilderPage(true);
    try {
      const templateName = `Modelo - ${builderPageName.trim()}`;
      const uniqueSuffix = Date.now().toString(36);
      const newTemplate = await createTemplate.mutateAsync({
        name: templateName, slug: `modelo-lp-${slug}-${uniqueSuffix}`, is_default: false,
      });
      const { data: newPage, error } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: currentTenant.id, title: builderPageName.trim(), slug,
          content: null, status: 'draft', is_published: false,
          type: 'landing_page', template_id: newTemplate.id,
        })
        .select().single();
      if (error) throw error;
      setIsBuilderDialogOpen(false); setBuilderPageName(''); setBuilderPageSlug('');
      toast.success('Landing page criada! Abrindo o editor...');
      navigate(`/pages/${newPage.id}/builder`);
    } catch (error) {
      console.error('Error creating builder landing page:', error);
      toast.error('Erro ao criar landing page');
    } finally { setIsCreatingBuilderPage(false); }
  };

  const copyLPUrl = (slug: string, source: 'ai' | 'builder') => {
    const prefix = source === 'builder' ? '/lp/' : '/ai-lp/';
    const url = tenantBaseUrl ? `${tenantBaseUrl}${prefix}${slug}` : `${prefix}${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  const getStatusBadge = (page: LandingPageItem) => {
    if (page.status === 'generating') return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Gerando...</Badge>;
    if (page.is_published) return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Publicada</Badge>;
    return <Badge variant="secondary">Rascunho</Badge>;
  };

  // =============================================
  // LOADING
  // =============================================
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
        description="Gerencie páginas institucionais e landing pages da sua loja"
        actions={
          <div className="flex gap-2">
            {/* Criar Página (institucional) */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />Criar Página
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingPage ? 'Editar Página' : 'Criar Nova Página'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Título *</Label>
                    <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Sobre Nós, Política de Privacidade" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Slug (URL)</Label>
                    <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="sobre-nos (gerado automaticamente)" className={!validateSlug(formData.slug).isValid && formData.slug ? 'border-destructive' : ''} />
                    {!validateSlug(formData.slug).isValid && formData.slug ? (
                      <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{validateSlug(formData.slug).error}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">URL final: /page/{formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-') || 'slug'}</p>
                    )}
                  </div>
                  {editingPage && (
                    <div className="border-t pt-4 mt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Configurações SEO</h4>
                        <GenerateSeoButton input={{ type: 'page', name: formData.title }} onGenerated={(result) => setFormData({ ...formData, seo_title: result.seo_title, seo_description: result.seo_description })} disabled={!formData.title} />
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Título SEO</Label>
                          <Input value={formData.seo_title} onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })} placeholder={formData.title || 'Título para mecanismos de busca'} maxLength={60} />
                          <p className="text-xs text-muted-foreground">{formData.seo_title.length}/60 caracteres</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Descrição SEO</Label>
                          <Textarea value={formData.seo_description} onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })} placeholder="Descrição para mecanismos de busca" className="min-h-[60px] resize-none" maxLength={160} />
                          <p className="text-xs text-muted-foreground">{formData.seo_description.length}/160 caracteres</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {!editingPage && (
                    <div className="bg-muted/50 p-3 rounded-md border border-dashed">
                      <p className="text-sm text-muted-foreground">💡 Após criar, você será redirecionado ao editor visual para construir o conteúdo da página.</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="flex-1" type="button">Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={!formData.title || isCreating} className="flex-1">{isCreating ? 'Criando...' : editingPage ? 'Salvar Alterações' : 'Criar Página'}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Criar Landing Page (dropdown) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />Criar Landing Page
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsBuilderDialogOpen(true)}>
                  <LayoutTemplate className="mr-2 h-4 w-4" />No Builder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreateLPDialogOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />Com IA
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setAIImportTarget('landing_page'); setIsAIImportOpen(true); }}>
                  <Sparkles className="mr-2 h-4 w-4" />Importar com IA
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* =============================================
          TABS: Páginas | Landing Pages
          ============================================= */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pages">Páginas ({pages?.length || 0})</TabsTrigger>
          <TabsTrigger value="landing-pages">Landing Pages ({landingPages.length})</TabsTrigger>
        </TabsList>

        {/* =============================================
            TAB: Páginas Institucionais
            ============================================= */}
        <TabsContent value="pages">
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
                        <Badge variant={page.is_published ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => handleToggleStatus(page)}>
                          {page.is_published ? 'Publicado' : 'Rascunho'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {primaryOrigin && page.slug && (
                            <a href={buildPublicStorefrontUrl(primaryOrigin, `/page/${page.slug}?preview=1`)} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="icon" title="Visualizar"><Eye className="h-4 w-4" /></Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/pages/${page.id}/builder`)} title="Editar no Builder Visual"><LayoutTemplate className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(page)} title="Editar Metadados"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(page.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!pages || pages.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        Nenhuma página criada. Clique em "Criar Página" para começar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =============================================
            TAB: Landing Pages
            ============================================= */}
        <TabsContent value="landing-pages">
          {landingPages.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Nenhuma landing page</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-4">
                  Crie sua primeira landing page com IA ou no Builder.
                </p>
                <Button onClick={() => setCreateLPDialogOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />Criar com IA
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {landingPages.map(page => {
                const isBuilder = page.source === 'builder';
                const editUrl = isBuilder ? `/pages/${page.id}/builder` : `/landing-pages/${page.id}`;
                return (
                  <Card key={`${page.source}-${page.id}`} className="group hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate flex items-center gap-2">
                            {page.name}
                            {isBuilder && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Builder</Badge>}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <span className="truncate">{isBuilder ? '/lp/' : '/ai-lp/'}{page.slug}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => copyLPUrl(page.slug, page.source)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </CardDescription>
                        </div>
                        {getStatusBadge(page)}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(page.updated_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        {!isBuilder && page.current_version > 0 && (
                          <><span className="mx-1">•</span><span>v{page.current_version}</span></>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isBuilder && (
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreviewLPId(page.id)}>
                            <Eye className="h-4 w-4 mr-1" />Preview
                          </Button>
                        )}
                        <Button variant="default" size="sm" className="flex-1" onClick={() => navigate(editUrl)}>
                          <Settings className="h-4 w-4 mr-1" />Editar
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteLPTarget({ id: page.id, source: page.source })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {page.is_published && (
                        <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => {
                          const prefix = isBuilder ? '/lp/' : '/ai-lp/';
                          const url = tenantBaseUrl ? `${tenantBaseUrl}${prefix}${page.slug}` : `${prefix}${page.slug}`;
                          window.open(url, '_blank');
                        }}>
                          <Globe className="h-4 w-4 mr-1" />Ver Publicada<ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* =============================================
          DIALOGS
          ============================================= */}

      {/* Delete page (institutional) */}
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

      {/* Delete LP */}
      <AlertDialog open={!!deleteLPTarget} onOpenChange={(open) => !open && setDeleteLPTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Landing Page?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteLPTarget && deleteLPMutation.mutate(deleteLPTarget)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create LP with AI */}
      <CreateLandingPageDialog open={createLPDialogOpen} onOpenChange={setCreateLPDialogOpen} />

      {/* Preview LP */}
      {previewLPId && (
        <LandingPagePreviewDialog landingPageId={previewLPId} open={!!previewLPId} onOpenChange={(open) => !open && setPreviewLPId(null)} />
      )}

      {/* AI Import Dialog */}
      {currentTenant?.id && (
        <ImportPageWithAIDialog
          open={isAIImportOpen}
          onOpenChange={setIsAIImportOpen}
          tenantId={currentTenant.id}
          targetType={aiImportTarget}
          onSuccess={(result) => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
            queryClient.invalidateQueries({ queryKey: ['builder-landing-pages'] });
            setIsAIImportOpen(false);
            if (result?.pageId) {
              if (aiImportTarget === 'landing_page') {
                toast.success('Landing page importada! Abrindo editor...');
                navigate(`/landing-pages/${result.pageId}`);
              } else {
                toast.success('Página importada! Abrindo o editor...');
                navigate(`/pages/${result.pageId}/builder`);
              }
            }
          }}
        />
      )}

      {/* Builder Create Dialog */}
      <Dialog open={isBuilderDialogOpen} onOpenChange={(open) => { setIsBuilderDialogOpen(open); if (!open) { setBuilderPageName(''); setBuilderPageSlug(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Landing Page no Builder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nome *</Label>
              <Input
                placeholder="Ex: Promoção de Verão"
                value={builderPageName}
                onChange={(e) => {
                  setBuilderPageName(e.target.value);
                  if (!builderPageSlug || builderPageSlug === generateSlug(builderPageName)) {
                    setBuilderPageSlug(generateSlug(e.target.value));
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBuilderPage()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Slug (URL)</Label>
              <Input
                value={builderPageSlug}
                onChange={(e) => setBuilderPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder={builderPageName ? generateSlug(builderPageName) : 'slug-da-pagina'}
                className={!validateSlug(builderPageSlug).isValid && builderPageSlug ? 'border-destructive' : ''}
              />
              {!validateSlug(builderPageSlug).isValid && builderPageSlug ? (
                <p className="text-xs text-destructive flex items-center gap-1">{validateSlug(builderPageSlug).error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">URL final: /lp/{builderPageSlug || generateSlug(builderPageName) || 'slug'}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBuilderDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateBuilderPage} disabled={!builderPageName.trim() || isCreatingBuilderPage}>
              {isCreatingBuilderPage ? 'Criando...' : 'Criar Página'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
