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
import { QueryErrorState } from '@/components/ui/query-error-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, Pencil, Trash2, FileText, Eye, LayoutTemplate, AlertCircle, Sparkles,
  ChevronDown, Copy, Globe, ExternalLink, PackagePlus
} from 'lucide-react';
import { GenerateSeoButton } from '@/components/seo/GenerateSeoButton';
import { ImportPageWithAIDialog } from '@/components/import/ImportPageWithAIDialog';
import { LandingPagePreviewDialog } from '@/components/landing-pages/LandingPagePreviewDialog';
import { Wand2, Loader2 } from 'lucide-react';
import { showErrorToast } from '@/lib/error-toast';

// =============================================
// UNIFIED PAGE ITEM TYPE
// =============================================
interface UnifiedPageItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  source: 'institutional' | 'ai_landing' | 'builder_landing';
  // For editing institutional pages
  seo_title?: string | null;
  seo_description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  // For AI landing pages
  current_version?: number;
  reference_url?: string | null;
}

export default function Pages() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant, user } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  const { pages, isLoading: pagesLoading, error: pagesError, createPage, updatePage, deletePage, refetch } = useStorePages();
  const { templates, isLoading: templatesLoading, initializeDefaultTemplate, createTemplate } = usePageTemplates();

  // =============================================
  // STATE
  // =============================================
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; source: UnifiedPageItem['source'] } | null>(null);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [previewLPId, setPreviewLPId] = useState<string | null>(null);
  // AI Architect dialog state
  const [isAIArchitectOpen, setIsAIArchitectOpen] = useState(false);
  const [aiPageName, setAiPageName] = useState('');
  const [aiPageSlug, setAiPageSlug] = useState('');
  const [aiPagePrompt, setAiPagePrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  // Essential pages state
  const [isEssentialConfirmOpen, setIsEssentialConfirmOpen] = useState(false);
  const [isGeneratingEssential, setIsGeneratingEssential] = useState(false);
  const [essentialBusinessContext, setEssentialBusinessContext] = useState('');
  const [formData, setFormData] = useState({
    title: '', slug: '', seo_title: '', seo_description: '',
  });

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
  // QUERIES — AI Landing Pages
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
      return (data || []).map((p: any): UnifiedPageItem => ({
        id: p.id, name: p.name, slug: p.slug,
        status: p.is_published ? 'published' : p.status || 'draft',
        is_published: p.is_published || false,
        created_at: p.created_at, updated_at: p.updated_at,
        source: 'ai_landing',
        seo_title: p.seo_title, seo_description: p.seo_description,
        current_version: p.current_version || 0,
        reference_url: p.reference_url,
      }));
    },
    enabled: !!currentTenant?.id,
  });

  const { data: builderLandingPages, isLoading: builderLoading } = useQuery({
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
      return (data || []).map((p: any): UnifiedPageItem => ({
        id: p.id, name: p.title, slug: p.slug,
        status: p.is_published ? 'published' : (p.status || 'draft'),
        is_published: p.is_published || false,
        created_at: p.created_at, updated_at: p.updated_at,
        source: 'builder_landing',
        seo_title: p.seo_title, seo_description: p.seo_description,
      }));
    },
    enabled: !!currentTenant?.id,
  });

  // =============================================
  // UNIFIED PAGE LIST
  // =============================================
  const allPages: UnifiedPageItem[] = [
    ...(pages || []).map((p: any): UnifiedPageItem => ({
      id: p.id, name: p.title, slug: p.slug,
      status: p.is_published ? 'published' : (p.status || 'draft'),
      is_published: p.is_published || false,
      created_at: p.created_at, updated_at: p.updated_at,
      source: 'institutional',
      seo_title: p.seo_title || p.meta_title, seo_description: p.seo_description || p.meta_description,
      meta_title: p.meta_title, meta_description: p.meta_description,
    })),
    ...(aiPages || []),
    ...(builderLandingPages || []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isLoading = pagesLoading || aiLoading || builderLoading;

  // =============================================
  // HANDLERS
  // =============================================
  const resetForm = () => {
    setFormData({ title: '', slug: '', seo_title: '', seo_description: '' });
    setEditingPage(null);
  };

  const handleEdit = (page: UnifiedPageItem) => {
    if (page.source === 'institutional') {
      const originalPage = pages?.find(p => p.id === page.id);
      setEditingPage(originalPage || page);
      setFormData({
        title: page.name, slug: page.slug,
        seo_title: page.seo_title || page.meta_title || '',
        seo_description: page.seo_description || page.meta_description || '',
      });
      setIsDialogOpen(true);
    }
  };

  const handleSubmit = async () => {
    const slug = formData.slug || formData.title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slugValidation = validateSlug(slug);
    showErrorToast(err, { module: 'páginas', action: 'processar' });
    // Check against ALL pages (institutional + AI + builder LPs) to avoid DB constraint violations
    const isDuplicate = allPages.some(p => p.slug === slug && (!editingPage || p.id !== editingPage.id));
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

  const handleToggleStatus = async (page: UnifiedPageItem) => {
    if (page.source === 'institutional') {
      const newStatus = page.is_published ? 'draft' : 'published';
      await updatePage.mutateAsync({ id: page.id, status: newStatus, is_published: newStatus === 'published' });
    }
  };

  // AI Architect: generate page structure with AI
  const handleCreateWithAIArchitect = async () => {
    if (!aiPageName.trim() || !aiPagePrompt.trim() || !currentTenant?.id || !user?.id) return;

    const slug = aiPageSlug || generateSlug(aiPageName);
    const slugValidation = validateSlug(slug);
    if (!slugValidation.isValid) {
      showErrorToast(err, { module: 'páginas', action: 'processar' });
      return;
    }

    setIsGeneratingAI(true);
    try {
      const { data: aiResult, error: fnError } = await supabase.functions.invoke('ai-page-architect', {
        body: { prompt: aiPagePrompt, pageName: aiPageName.trim() },
      });

      if (fnError) throw new Error(fnError.message || 'Erro na geração com IA');
      if (!aiResult?.blocks?.length) throw new Error('IA não retornou blocos válidos');

      const { blockRegistry } = await import('@/lib/builder');
      const { generateBlockId } = await import('@/lib/builder/utils');

      const contentBlocks = aiResult.blocks
        .map((b: { type: string }) => blockRegistry.createDefaultNode(b.type))
        .filter(Boolean);

      const pageContent = {
        id: 'root',
        type: 'Page',
        props: {},
        children: [
          {
            id: generateBlockId('Header'),
            type: 'Header',
            props: { menuId: '', showSearch: true, showCart: true, sticky: true, noticeEnabled: false },
          },
          {
            id: generateBlockId('Section'),
            type: 'Section',
            props: { paddingY: 0, paddingX: 0, fullWidth: true, backgroundColor: 'transparent' },
            children: contentBlocks,
          },
          {
            id: generateBlockId('Footer'),
            type: 'Footer',
            props: { menuId: '', showSocial: true },
          },
        ],
      };

      const templateName = `Modelo - ${aiPageName.trim()}`;
      const uniqueSuffix = Date.now().toString(36);
      const newTemplate = await createTemplate.mutateAsync({
        name: templateName,
        slug: `modelo-lp-${slug}-${uniqueSuffix}`,
        is_default: false,
      });

      const { data: newPage, error: insertError } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: currentTenant.id,
          title: aiPageName.trim(),
          slug,
          content: pageContent as any,
          draft_content: pageContent as any,
          status: 'draft',
          is_published: false,
          type: 'landing_page',
          template_id: newTemplate.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setIsAIArchitectOpen(false);
      setAiPageName('');
      setAiPageSlug('');
      setAiPagePrompt('');
      queryClient.invalidateQueries({ queryKey: ['builder-landing-pages'] });
      refetch();
      toast.success('Página gerada com IA! Abrindo o editor...');
      navigate(`/pages/${newPage.id}/builder`);
    } catch (error: any) {
      console.error('Error creating AI architect page:', error);
      showErrorToast(err, { module: 'páginas', action: 'gerar' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Essential Pages: generate all essential institutional pages
  const handleGenerateEssentialPages = async () => {
    if (!currentTenant?.id) return;
    setIsGeneratingEssential(true);
    setIsEssentialConfirmOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke('ai-essential-pages', {
        body: { tenantId: currentTenant.id, businessContext: essentialBusinessContext || undefined },
      });
      if (error) throw new Error(error.message || 'Erro na geração');
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      
      const created = data.created || 0;
      const skipped = data.skipped || 0;
      
      if (created > 0) {
        toast.success(`${created} página(s) essencial(is) criada(s) com sucesso!${skipped > 0 ? ` (${skipped} já existiam)` : ''}`);
      } else {
        toast.info('Todas as páginas essenciais já existem na sua loja.');
      }
      
      refetch();
      queryClient.invalidateQueries({ queryKey: ['store-pages'] });
    } catch (error: any) {
      console.error('Error generating essential pages:', error);
      showErrorToast(err, { module: 'páginas', action: 'gerar' });
    } finally {
      setIsGeneratingEssential(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: UnifiedPageItem['source'] }) => {
      if (source === 'institutional') {
        await deletePage.mutateAsync(id);
      } else {
        const table = source === 'ai_landing' ? 'ai_landing_pages' : 'store_pages';
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['builder-landing-pages'] });
      refetch();
      toast.success('Página excluída');
      setDeleteTarget(null);
    },
    onError: () => { toast.error('Erro ao excluir página'); },
  });

  // =============================================
  // HELPERS
  // =============================================
  const getEditUrl = (page: UnifiedPageItem) => {
    if (page.source === 'ai_landing') return `/landing-pages/${page.id}`;
    if (page.source === 'builder_landing') return `/pages/${page.id}/builder`;
    return `/pages/${page.id}/builder`;
  };

  const getPreviewUrl = (page: UnifiedPageItem) => {
    if (page.source === 'institutional' && primaryOrigin) {
      return buildPublicStorefrontUrl(primaryOrigin, `/page/${page.slug}?preview=1`);
    }
    return null;
  };

  const getSourceLabel = (source: UnifiedPageItem['source']) => {
    switch (source) {
      case 'institutional': return null;
      case 'ai_landing': return <Badge variant="outline" className="text-[10px] px-1.5 py-0">IA</Badge>;
      case 'builder_landing': return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Landing</Badge>;
    }
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
        description="Gerencie todas as páginas da sua loja"
        actions={
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />Criar Página
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
                  <LayoutTemplate className="mr-2 h-4 w-4" />Criar manualmente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAIArchitectOpen(true)}>
                  <Wand2 className="mr-2 h-4 w-4" />Página de vendas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAIImportOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />Importar Página
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEssentialConfirmOpen(true)} disabled={isGeneratingEssential}>
                  <PackagePlus className="mr-2 h-4 w-4" />Páginas Essenciais IA
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {pagesError && (
        <QueryErrorState
          title="Erro ao carregar páginas"
          message="Não foi possível carregar as páginas. Tente novamente."
          onRetry={() => refetch()}
        />
      )}

      {/* =============================================
          UNIFIED TABLE
          ============================================= */}
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
              {allPages.map((page) => (
                <TableRow key={`${page.source}-${page.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {page.name}
                      {getSourceLabel(page.source)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">/{page.slug}</TableCell>
                  <TableCell>
                    <Badge
                      variant={page.is_published ? 'default' : 'secondary'}
                      className={page.source === 'institutional' ? 'cursor-pointer' : ''}
                      onClick={() => page.source === 'institutional' && handleToggleStatus(page)}
                    >
                      {page.is_published ? 'Publicado' : page.status === 'generating' ? 'Gerando...' : 'Rascunho'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {/* Preview */}
                      {page.source === 'ai_landing' ? (
                        <Button variant="outline" size="icon" title="Preview" onClick={() => setPreviewLPId(page.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : getPreviewUrl(page) ? (
                        <a href={getPreviewUrl(page)!} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="icon" title="Visualizar"><Eye className="h-4 w-4" /></Button>
                        </a>
                      ) : null}

                      {/* Edit in builder/editor */}
                      <Button variant="ghost" size="icon" onClick={() => navigate(getEditUrl(page))} title="Editar">
                        <LayoutTemplate className="h-4 w-4" />
                      </Button>

                      {/* Edit metadata (institutional only) */}
                      {page.source === 'institutional' && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(page)} title="Editar Metadados">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Delete */}
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: page.id, source: page.source })} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {allPages.length === 0 && (
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

      {/* =============================================
          DIALOGS
          ============================================= */}

      {/* Create/Edit Page Dialog (Builder) */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPage ? 'Editar Página' : 'Criar Nova Página'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    title: newTitle,
                    ...(!editingPage && (!prev.slug || prev.slug === generateSlug(prev.title))
                      ? { slug: generateSlug(newTitle) }
                      : {}),
                  }));
                }}
                placeholder="Ex: Sobre Nós, Promoção de Verão"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Slug (URL)</Label>
              <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="sobre-nos (gerado automaticamente)" className={!validateSlug(formData.slug).isValid && formData.slug ? 'border-destructive' : ''} />
              {!validateSlug(formData.slug).isValid && formData.slug ? (
                <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{validateSlug(formData.slug).error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">URL final: /page/{formData.slug || generateSlug(formData.title) || 'slug'}</p>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir página?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Architect Dialog */}
      <Dialog open={isAIArchitectOpen} onOpenChange={(open) => {
        setIsAIArchitectOpen(open);
        if (!open) { setAiPageName(''); setAiPageSlug(''); setAiPagePrompt(''); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Criar Página com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nome da Página *</Label>
              <Input
                placeholder="Ex: Black Friday 2026"
                value={aiPageName}
                onChange={(e) => {
                  setAiPageName(e.target.value);
                  if (!aiPageSlug || aiPageSlug === generateSlug(aiPageName)) {
                    setAiPageSlug(generateSlug(e.target.value));
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Slug (URL)</Label>
              <Input
                value={aiPageSlug}
                onChange={(e) => setAiPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder={aiPageName ? generateSlug(aiPageName) : 'slug-da-pagina'}
                className={!validateSlug(aiPageSlug).isValid && aiPageSlug ? 'border-destructive' : ''}
              />
              {!validateSlug(aiPageSlug).isValid && aiPageSlug ? (
                <p className="text-xs text-destructive">{validateSlug(aiPageSlug).error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  URL: /lp/{aiPageSlug || generateSlug(aiPageName) || 'slug'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Descreva sua página *</Label>
              <Textarea
                placeholder="Ex: Página promocional com contagem regressiva, produtos em destaque, depoimentos de clientes e formulário de newsletter"
                value={aiPagePrompt}
                onChange={(e) => setAiPagePrompt(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                A IA vai montar a estrutura de blocos com base na sua descrição. Você poderá editar tudo depois no Builder.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAIArchitectOpen(false)} disabled={isGeneratingAI}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateWithAIArchitect}
              disabled={!aiPageName.trim() || !aiPagePrompt.trim() || isGeneratingAI}
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando estrutura...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Gerar Página
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          targetType="landing_page"
          onSuccess={(result) => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
            queryClient.invalidateQueries({ queryKey: ['builder-landing-pages'] });
            setIsAIImportOpen(false);
            if (result?.pageId) {
              toast.success('Página importada! Abrindo editor...');
              navigate(`/landing-pages/${result.pageId}`);
            }
          }}
        />
      )}

      {/* Essential Pages Confirmation Dialog */}
      <Dialog open={isEssentialConfirmOpen} onOpenChange={(open) => { setIsEssentialConfirmOpen(open); if (!open) setEssentialBusinessContext(''); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              Páginas Essenciais IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">
                ⚡ O sistema vai gerar automaticamente 8 páginas institucionais para sua loja:
              </p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>• Quem Somos</span>
                <span>• Fale Conosco</span>
                <span>• Perguntas Frequentes</span>
                <span>• Como Comprar</span>
                <span>• Frete e Entrega</span>
                <span>• Trocas e Devoluções</span>
                <span>• Política de Privacidade</span>
                <span>• Termos de Uso</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Páginas já existentes <strong>não serão sobrescritas</strong>.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                ⚠️ Antes de gerar, verifique:
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Certifique-se de que os <strong>dados da loja</strong> estão preenchidos (nome, CNPJ, razão social, e-mail, WhatsApp, endereço, etc.). A IA usará esses dados para gerar páginas legais precisas. Dados ausentes aparecerão como "[informar ...]".
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="essential-context" className="text-sm font-medium">
                Contexto do negócio <span className="text-xs text-primary font-normal">(altamente recomendado)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Este campo personaliza as páginas <strong>"Quem Somos"</strong> e <strong>"FAQ"</strong>. Quanto mais detalhado, melhor o resultado. Informe:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-3">
                <li>📌 O que sua empresa vende e para quem</li>
                <li>📌 Quais problemas, dores ou desejos ela resolve</li>
                <li>📌 Diferenciais reais (tecnologia, atendimento, resultados)</li>
                <li>📌 Prova social (tempo de mercado, clientes atendidos, números)</li>
                <li>📌 Perguntas que os clientes fazem com frequência</li>
                <li>📌 Como a marca quer se posicionar / tom de voz</li>
              </ul>
              <Textarea
                id="essential-context"
                placeholder={"Exemplo: Somos uma marca de cosméticos masculinos focada no tratamento da calvície, pioneira no Brasil desde 2023. Já atendemos mais de 10 mil clientes. Nosso diferencial é o acompanhamento personalizado por especialistas e tratamentos adaptados ao grau de calvície.\n\nDúvidas mais comuns dos clientes:\n- O tratamento realmente funciona?\n- Não é golpe? Posso confiar?\n- Como faço para comprar?\n- Como vou receber meu pedido?\n- Quais são as formas de pagamento?\n- Em quanto tempo vejo resultado?"}
                value={essentialBusinessContext}
                onChange={(e) => setEssentialBusinessContext(e.target.value)}
                rows={7}
                className="resize-y text-sm"
              />
              <p className="text-xs text-muted-foreground italic">
                💡 Se deixar em branco, "Quem Somos" e "FAQ" ficarão genéricos. As demais páginas (legais) usam apenas os dados cadastrados.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEssentialConfirmOpen(false); setEssentialBusinessContext(''); }}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateEssentialPages}>
              <Sparkles className="mr-2 h-4 w-4" />
              Confirmar e Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Essential Pages Loading Toast */}
      {isGeneratingEssential && (
        <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg shadow-lg p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">Gerando páginas essenciais...</p>
            <p className="text-xs text-muted-foreground">Isso pode levar até 60 segundos</p>
          </div>
        </div>
      )}
    </div>
  );
}
