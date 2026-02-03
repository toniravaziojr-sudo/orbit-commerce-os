// =============================================
// LANDING PAGE EDITOR - Edição via prompt de IA
// =============================================

import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAILandingPageUrl } from "@/hooks/useAILandingPageUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Send,
  RefreshCw,
  Globe,
  Eye,
  Save,
  History,
  Loader2,
  Monitor,
  Smartphone,
  ExternalLink,
  Settings,
  Wand2,
} from "lucide-react";

interface LandingPageData {
  id: string;
  name: string;
  slug: string;
  status: string;
  is_published: boolean;
  published_at: string | null;
  generated_html: string | null;
  generated_css: string | null;
  current_version: number;
  reference_url: string | null;
  initial_prompt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  product_ids: string[];
  created_at: string;
  updated_at: string;
}

interface VersionHistory {
  id: string;
  version: number;
  prompt: string;
  prompt_type: string;
  created_at: string;
}

export default function LandingPageEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTenant: tenant } = useAuth();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [promptInput, setPromptInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'editor' | 'settings' | 'history'>('editor');

  // Form state
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  
  // Get tenant's public URL - MUST be at top level before any conditionals
  const { baseUrl: tenantBaseUrl } = useAILandingPageUrl({
    tenantId: tenant?.id,
    tenantSlug: tenant?.slug,
  });

  // Fetch landing page data
  const { data: landingPage, isLoading, refetch } = useQuery({
    queryKey: ['ai-landing-page', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('ai_landing_pages')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as LandingPageData;
    },
    enabled: !!id,
  });

  // Fetch version history
  const { data: versions } = useQuery({
    queryKey: ['ai-landing-page-versions', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('ai_landing_page_versions')
        .select('id, version, prompt, prompt_type, created_at')
        .eq('landing_page_id', id)
        .order('version', { ascending: false });
      
      if (error) throw error;
      return data as VersionHistory[];
    },
    enabled: !!id,
  });

  // Set form values when data loads
  useEffect(() => {
    if (landingPage) {
      setSeoTitle(landingPage.seo_title || "");
      setSeoDescription(landingPage.seo_description || "");
    }
  }, [landingPage]);

  // Check for generation status
  useEffect(() => {
    if (landingPage?.status === 'generating') {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [landingPage?.status, refetch]);

  // Send prompt mutation
  const sendPromptMutation = useMutation({
    mutationFn: async (prompt: string) => {
      if (!id || !tenant?.id || !user?.id) throw new Error('Missing data');
      
      const { data, error } = await supabase.functions.invoke('ai-landing-page-generate', {
        body: {
          landingPageId: id,
          tenantId: tenant.id,
          userId: user.id,
          prompt,
          promptType: 'adjustment',
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setPromptInput("");
      queryClient.invalidateQueries({ queryKey: ['ai-landing-page', id] });
      queryClient.invalidateQueries({ queryKey: ['ai-landing-page-versions', id] });
      toast.success('Ajuste aplicado com sucesso!');
    },
    onError: (error) => {
      console.error('Error sending prompt:', error);
      toast.error('Erro ao processar ajuste');
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing ID');
      
      const { error } = await supabase
        .from('ai_landing_pages')
        .update({
          is_published: true,
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-landing-page', id] });
      toast.success('Landing page publicada!');
    },
    onError: () => {
      toast.error('Erro ao publicar');
    },
  });

  // Unpublish mutation
  const unpublishMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing ID');
      
      const { error } = await supabase
        .from('ai_landing_pages')
        .update({
          is_published: false,
          status: 'draft',
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-landing-page', id] });
      toast.success('Landing page despublicada');
    },
    onError: () => {
      toast.error('Erro ao despublicar');
    },
  });

  // Save SEO settings mutation
  const saveSeoMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing ID');
      
      const { error } = await supabase
        .from('ai_landing_pages')
        .update({
          seo_title: seoTitle,
          seo_description: seoDescription,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-landing-page', id] });
      toast.success('Configurações salvas!');
    },
    onError: () => {
      toast.error('Erro ao salvar');
    },
  });

  const handleSendPrompt = () => {
    if (!promptInput.trim()) return;
    sendPromptMutation.mutate(promptInput.trim());
  };

  const renderPreview = () => {
    if (!landingPage?.generated_html) {
      return (
        <div className="flex items-center justify-center h-full bg-muted/50">
          <div className="text-center p-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Gerando sua landing page...</h3>
            <p className="text-muted-foreground">
              Aguarde enquanto a IA cria sua página
            </p>
          </div>
        </div>
      );
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; font-family: system-ui, sans-serif; }
            ${landingPage.generated_css || ''}
          </style>
        </head>
        <body>${landingPage.generated_html}</body>
      </html>
    `;

    return (
      <iframe
        ref={iframeRef}
        srcDoc={fullHtml}
        className="w-full h-full border-0"
        title="Landing Page Preview"
      />
    );
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="border-b p-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  if (!landingPage) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Landing page não encontrada</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/landing-pages')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="font-semibold">{landingPage.name}</h1>
              <p className="text-xs text-muted-foreground">
                {tenantBaseUrl ? `${tenantBaseUrl}/ai-lp/${landingPage.slug}` : `/ai-lp/${landingPage.slug}`}
              </p>
            </div>
            <Badge variant={landingPage.is_published ? "default" : "secondary"}>
              {landingPage.is_published ? "Publicada" : "Rascunho"}
            </Badge>
            {landingPage.status === 'generating' && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Gerando...
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>

            {landingPage.is_published ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = tenantBaseUrl ? `${tenantBaseUrl}/ai-lp/${landingPage.slug}` : `/ai-lp/${landingPage.slug}`;
                    window.open(url, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ver Publicada
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unpublishMutation.mutate()}
                  disabled={unpublishMutation.isPending}
                >
                  Despublicar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending || !landingPage.generated_html}
              >
                <Globe className="h-4 w-4 mr-1" />
                Publicar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview area */}
        <div className="flex-1 bg-muted/30 flex items-center justify-center p-4 overflow-auto">
          <div
            className={`bg-white shadow-lg overflow-hidden transition-all duration-300 ${
              viewMode === 'mobile'
                ? 'w-[375px] h-[667px] rounded-[40px] border-[12px] border-foreground/80'
                : 'w-full max-w-[1200px] h-full rounded-lg'
            }`}
          >
            {renderPreview()}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-[400px] border-l bg-card flex flex-col">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex flex-col h-full">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="editor" className="flex-1">
                <Wand2 className="h-4 w-4 mr-1" />
                Editor IA
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">
                <Settings className="h-4 w-4 mr-1" />
                Config
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                <History className="h-4 w-4 mr-1" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="flex-1 flex flex-col p-0 m-0">
              {/* Chat/Prompt area */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Ajuste sua Landing Page
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <p>
                        Descreva as alterações que deseja fazer na sua landing page.
                        A IA irá aplicar os ajustes automaticamente.
                      </p>
                      <p className="mt-2">Exemplos:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                        <li>"Mude a cor do botão principal para verde"</li>
                        <li>"Adicione mais depoimentos na seção de prova social"</li>
                        <li>"Destaque mais os benefícios do produto"</li>
                        <li>"Adicione um contador regressivo no topo"</li>
                      </ul>
                    </CardContent>
                  </Card>

                  {versions && versions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Últimos ajustes:</p>
                      {versions.slice(0, 3).map(v => (
                        <div key={v.id} className="text-xs p-2 bg-muted rounded-md">
                          <span className="text-muted-foreground">v{v.version}:</span>{" "}
                          {v.prompt.slice(0, 100)}
                          {v.prompt.length > 100 && '...'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input area */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Descreva o ajuste que deseja fazer..."
                    className="min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.metaKey) {
                        handleSendPrompt();
                      }
                    }}
                  />
                </div>
                <Button
                  className="w-full mt-2"
                  onClick={handleSendPrompt}
                  disabled={!promptInput.trim() || sendPromptMutation.isPending}
                >
                  {sendPromptMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Aplicar Ajuste
                </Button>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  ⌘ + Enter para enviar
                </p>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 p-4 m-0">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">SEO</h3>
                  <div className="space-y-2">
                    <Label htmlFor="seo-title">Título SEO</Label>
                    <Input
                      id="seo-title"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      placeholder="Título para mecanismos de busca"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seo-description">Descrição SEO</Label>
                    <Textarea
                      id="seo-description"
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      placeholder="Descrição para mecanismos de busca"
                      className="min-h-[80px]"
                    />
                  </div>
                  <Button 
                    onClick={() => saveSeoMutation.mutate()}
                    disabled={saveSeoMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Configurações
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Informações</h3>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Versão atual:</span>
                      <span>{landingPage.current_version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">URL:</span>
                      <span className="text-xs max-w-[200px] truncate" title={tenantBaseUrl ? `${tenantBaseUrl}/ai-lp/${landingPage.slug}` : `/ai-lp/${landingPage.slug}`}>
                        {tenantBaseUrl ? `${tenantBaseUrl}/ai-lp/${landingPage.slug}` : `/ai-lp/${landingPage.slug}`}
                      </span>
                    </div>
                    {landingPage.reference_url && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Referência:</span>
                        <a 
                          href={landingPage.reference_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="flex-1 p-4 m-0 overflow-auto">
              <div className="space-y-4">
                <h3 className="font-medium">Histórico de Versões</h3>
                {versions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma versão ainda</p>
                ) : (
                  <div className="space-y-3">
                    {versions?.map(v => (
                      <Card key={v.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline">v{v.version}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(v.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-sm">{v.prompt}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
