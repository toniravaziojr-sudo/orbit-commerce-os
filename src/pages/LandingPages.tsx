// =============================================
// LANDING PAGES - Módulo de criação de LPs com IA
// Separado do builder, usa v0 Platform API
// =============================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAILandingPageUrl } from "@/hooks/useAILandingPageUrl";
import { usePageTemplates } from "@/hooks/usePageTemplates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
   
  Sparkles, 
  ExternalLink, 
  Settings, 
  Trash2, 
  Copy,
  Eye,
  Globe,
  Clock,
  FileText,
  LayoutTemplate
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateLandingPageDialog } from "@/components/landing-pages/CreateLandingPageDialog";
import { validateSlug, generateSlug } from '@/lib/slugValidation';
import { LandingPagePreviewDialog } from "@/components/landing-pages/LandingPagePreviewDialog";
import { ImportPageWithAIDialog } from "@/components/import/ImportPageWithAIDialog";
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
  source: 'ai' | 'builder'; // Which module owns this page
}

export default function LandingPages() {
  const { currentTenant: tenant, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { createTemplate } = usePageTemplates();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; source: 'ai' | 'builder' } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [isBuilderDialogOpen, setIsBuilderDialogOpen] = useState(false);
  const [builderPageName, setBuilderPageName] = useState('');
  const [builderPageSlug, setBuilderPageSlug] = useState('');
  const [isCreatingBuilderPage, setIsCreatingBuilderPage] = useState(false);


  // Get tenant's public URL
  const { baseUrl: tenantBaseUrl } = useAILandingPageUrl({
    tenantId: tenant?.id,
    tenantSlug: tenant?.slug,
  });

  // Fetch AI landing pages
  const { data: aiPages, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-landing-pages', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('ai_landing_pages')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status as LandingPageItem['status'],
        is_published: p.is_published || false,
        published_at: p.published_at,
        created_at: p.created_at,
        updated_at: p.updated_at,
        current_version: p.current_version || 0,
        reference_url: p.reference_url,
        seo_title: p.seo_title,
        seo_description: p.seo_description,
        source: 'ai' as const,
      }));
    },
    enabled: !!tenant?.id,
  });

  // Fetch Builder landing pages (store_pages with type = 'landing_page')
  const { data: builderPages, isLoading: builderLoading } = useQuery({
    queryKey: ['builder-landing-pages', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('store_pages')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('type', 'landing_page')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.title,
        slug: p.slug,
        status: (p.status || 'draft') as LandingPageItem['status'],
        is_published: p.is_published || false,
        published_at: null,
        created_at: p.created_at,
        updated_at: p.updated_at,
        current_version: 0,
        reference_url: null,
        seo_title: p.seo_title,
        seo_description: p.seo_description,
        source: 'builder' as const,
      }));
    },
    enabled: !!tenant?.id,
  });

  const isLoading = aiLoading || builderLoading;

  // Merge both sources sorted by created_at desc
  const landingPages = [...(aiPages || []), ...(builderPages || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Delete mutation - handles both sources
  const deleteMutation = useMutation({
    mutationFn: async ({ id, source }: { id: string; source: 'ai' | 'builder' }) => {
      const table = source === 'ai' ? 'ai_landing_pages' : 'store_pages';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
      queryClient.invalidateQueries({ queryKey: ['builder-landing-pages'] });
      toast.success('Landing page excluída');
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Erro ao excluir landing page');
    },
  });

  // Filter pages by tab
  const filteredPages = landingPages?.filter(page => {
    if (activeTab === 'all') return true;
    if (activeTab === 'published') return page.is_published;
    if (activeTab === 'draft') return !page.is_published;
    return true;
  });

  const getStatusBadge = (page: LandingPageItem) => {
    if (page.status === 'generating') {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Gerando...</Badge>;
    }
    if (page.is_published) {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Publicada</Badge>;
    }
    return <Badge variant="secondary">Rascunho</Badge>;
  };

  const handleCreateBuilderPage = async () => {
    if (!builderPageName.trim() || !tenant?.id || !user?.id) return;
    
    const slug = builderPageSlug || generateSlug(builderPageName);
    
    // Validate slug
    const slugValidation = validateSlug(slug);
    if (!slugValidation.isValid) {
      toast.error(slugValidation.error || 'Slug inválido');
      return;
    }
    
    setIsCreatingBuilderPage(true);
    try {
      // 1. Create a dedicated template for this landing page
      const templateName = `Modelo - ${builderPageName.trim()}`;
      const uniqueSuffix = Date.now().toString(36);
      const newTemplate = await createTemplate.mutateAsync({
        name: templateName,
        slug: `modelo-lp-${slug}-${uniqueSuffix}`,
        is_default: false,
      });

      // 2. Create in store_pages with type = 'landing_page' (same as Pages module)
      const { data: newPage, error } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: tenant.id,
          title: builderPageName.trim(),
          slug,
          content: null,
          status: 'draft',
          is_published: false,
          type: 'landing_page',
          template_id: newTemplate.id,
        })
        .select()
        .single();

      if (error) throw error;

      setIsBuilderDialogOpen(false);
      setBuilderPageName('');
      setBuilderPageSlug('');
      toast.success('Landing page criada! Abrindo o editor...');
      navigate(`/pages/${newPage.id}/builder`);
    } catch (error) {
      console.error('Error creating builder landing page:', error);
      toast.error('Erro ao criar landing page');
    } finally {
      setIsCreatingBuilderPage(false);
    }
  };

  const copySlug = (slug: string) => {
    const url = tenantBaseUrl ? `${tenantBaseUrl}/ai-lp/${slug}` : `/ai-lp/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };
  
  const openPublishedPage = (slug: string) => {
    const url = tenantBaseUrl ? `${tenantBaseUrl}/ai-lp/${slug}` : `/ai-lp/${slug}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Landing Pages IA
          </h1>
          <p className="text-muted-foreground">
            Crie landing pages de alta conversão com inteligência artificial
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setIsBuilderDialogOpen(true)}>
            <LayoutTemplate className="h-4 w-4 mr-2" />
            Criar no Builder
          </Button>
          <Button variant="outline" onClick={() => setIsAIImportOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Importar com IA
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Criar com IA
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            Todas ({landingPages?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="published">
            Publicadas ({landingPages?.filter(p => p.is_published).length || 0})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Rascunhos ({landingPages?.filter(p => !p.is_published).length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredPages?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Nenhuma landing page</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-4">
                  Crie sua primeira landing page com IA em poucos minutos.
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Criar Landing Page
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPages?.map(page => {
                const isBuilder = page.source === 'builder';
                const urlPrefix = isBuilder ? '/lp/' : '/ai-lp/';
                const editUrl = isBuilder ? `/pages/${page.id}/builder` : `/landing-pages/${page.id}`;
                
                return (
                <Card key={`${page.source}-${page.id}`} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate flex items-center gap-2">
                          {page.name}
                          {isBuilder && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Builder</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <span className="truncate">{urlPrefix}{page.slug}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copySlug(page.slug)}
                          >
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
                      <span>
                        {format(new Date(page.updated_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {!isBuilder && page.current_version > 0 && (
                        <>
                          <span className="mx-1">•</span>
                          <span>v{page.current_version}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isBuilder && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setPreviewId(page.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(editUrl)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: page.id, source: page.source })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {page.is_published && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => openPublishedPage(page.slug)}
                      >
                        <Globe className="h-4 w-4 mr-1" />
                        Ver Publicada
                        <ExternalLink className="h-3 w-3 ml-1" />
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

      {/* Create Dialog */}
      <CreateLandingPageDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />

      {/* Preview Dialog */}
      {previewId && (
        <LandingPagePreviewDialog
          landingPageId={previewId}
          open={!!previewId}
          onOpenChange={(open) => !open && setPreviewId(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Landing Page?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A landing page será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Import Dialog */}
      {tenant?.id && (
        <ImportPageWithAIDialog
          open={isAIImportOpen}
          onOpenChange={setIsAIImportOpen}
          tenantId={tenant.id}
          targetType="landing_page"
          onSuccess={(result) => {
            queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
            setIsAIImportOpen(false);
            if (result?.pageId) {
              toast.success('Landing page importada! Abrindo editor...');
              navigate(`/landing-pages/${result.pageId}`);
            }
          }}
        />
      )}

      {/* Builder Create Dialog */}
      <Dialog open={isBuilderDialogOpen} onOpenChange={(open) => {
        setIsBuilderDialogOpen(open);
        if (!open) { setBuilderPageName(''); setBuilderPageSlug(''); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Landing Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Título */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nome *</Label>
              <Input
                placeholder="Ex: Promoção de Verão"
                value={builderPageName}
                onChange={(e) => {
                  setBuilderPageName(e.target.value);
                  // Auto-generate slug if user hasn't manually edited it
                  if (!builderPageSlug || builderPageSlug === generateSlug(builderPageName)) {
                    setBuilderPageSlug(generateSlug(e.target.value));
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBuilderPage()}
                autoFocus
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Slug (URL)</Label>
              <Input
                value={builderPageSlug}
                onChange={(e) => setBuilderPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder={builderPageName ? generateSlug(builderPageName) : 'slug-da-pagina'}
                className={!validateSlug(builderPageSlug).isValid && builderPageSlug ? 'border-destructive' : ''}
              />
              {!validateSlug(builderPageSlug).isValid && builderPageSlug ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  {validateSlug(builderPageSlug).error}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  URL final: /ai-lp/{builderPageSlug || generateSlug(builderPageName) || 'slug'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBuilderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateBuilderPage} 
              disabled={!builderPageName.trim() || isCreatingBuilderPage}
            >
              {isCreatingBuilderPage ? 'Criando...' : 'Criar Página'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
