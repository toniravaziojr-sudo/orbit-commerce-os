// =============================================
// LANDING PAGES - Módulo de criação de LPs com IA
// Separado do builder, usa v0 Platform API
// =============================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Plus, 
  Sparkles, 
  ExternalLink, 
  Settings, 
  Trash2, 
  Copy,
  Eye,
  Globe,
  Clock,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreateLandingPageDialog } from "@/components/landing-pages/CreateLandingPageDialog";
import { LandingPagePreviewDialog } from "@/components/landing-pages/LandingPagePreviewDialog";
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

interface AILandingPage {
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
}

export default function LandingPages() {
  const { currentTenant: tenant } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  // Fetch landing pages
  const { data: landingPages, isLoading } = useQuery({
    queryKey: ['ai-landing-pages', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('ai_landing_pages')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AILandingPage[];
    },
    enabled: !!tenant?.id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_landing_pages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-landing-pages'] });
      toast.success('Landing page excluída');
      setDeleteId(null);
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

  const getStatusBadge = (page: AILandingPage) => {
    if (page.status === 'generating') {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Gerando...</Badge>;
    }
    if (page.is_published) {
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Publicada</Badge>;
    }
    return <Badge variant="secondary">Rascunho</Badge>;
  };

  const copySlug = (slug: string) => {
    const url = `${window.location.origin}/ai-lp/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
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
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Landing Page
        </Button>
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
              {filteredPages?.map(page => (
                <Card key={page.id} className="group hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{page.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <span className="truncate">/ai-lp/{page.slug}</span>
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
                      <span className="mx-1">•</span>
                      <span>v{page.current_version}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setPreviewId(page.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/landing-pages/${page.id}`)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(page.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {page.is_published && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => window.open(`/ai-lp/${page.slug}`, '_blank')}
                      >
                        <Globe className="h-4 w-4 mr-1" />
                        Ver Publicada
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
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
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Landing Page?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A landing page e todo seu histórico de versões serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
