// =============================================
// LANDING PAGE EDITOR - Edição via prompt de IA
// v2: Renders header/footer in admin preview
// =============================================

import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sanitizeAILandingPageHtml } from "@/lib/sanitizeAILandingPageHtml";
import { buildDocumentShell } from "@/lib/aiLandingPageShell";
import { LPSchemaRenderer } from "@/components/landing-pages/LPSchemaRenderer";
import type { LPSchema } from "@/lib/landing-page-schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BlockRenderer } from "@/components/builder/BlockRenderer";
import { BlockNode, BlockRenderContext } from "@/lib/builder/types";
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
import { GenerateSeoButton } from "@/components/seo/GenerateSeoButton";
import { LandingPageChatInput } from "@/components/landing-pages/LandingPageChatInput";
// Header/Footer are rendered only in the public page (StorefrontAILandingPage)
// In the editor, we show a clean iframe-only preview to avoid CSS conflicts
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
  FileText,
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
  generated_blocks: BlockNode | null;
  generated_schema: any | null;
  current_version: number;
  reference_url: string | null;
  initial_prompt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  product_ids: string[];
  created_at: string;
  updated_at: string;
  show_header?: boolean;
  show_footer?: boolean;
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
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  
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
      return data as unknown as LandingPageData;
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
      setShowHeader(landingPage.show_header ?? false);
      setShowFooter(landingPage.show_footer ?? false);
    }
  }, [landingPage]);

  // Check for generation status + auto-refetch for image enhancement
  useEffect(() => {
    if (landingPage?.status === 'generating') {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
    // After page loads, refetch periodically to pick up async image enhancement
    if (landingPage?.status === 'draft' && (landingPage?.generated_blocks || landingPage?.generated_html || landingPage?.generated_schema)) {
      const timer = setTimeout(() => refetch(), 30000);
      return () => clearTimeout(timer);
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

      // Use server-side intent classification — trigger enhance when intent is 'asset'
      // Also support legacy heuristic as fallback
      const shouldEnhance = data?.triggerEnhance === true || 
        /imagem|image|foto|photo|banner|visual|gerar.*imagem|trocar.*imagem|mudar.*imagem|renderiz|hero.*visual|composiç|cena|scene/.test(prompt.toLowerCase());

      if (shouldEnhance) {
        console.log(`[LP-Editor] Asset intent detected (server: ${data?.intent}), triggering enhance pipeline...`);
        const enhanceRecursive = async (startFromIndex = 0, stage = 1) => {
          try {
            const { data: enhData, error: enhErr } = await supabase.functions.invoke('ai-landing-page-enhance-images', {
              body: {
                landingPageId: id,
                tenantId: tenant!.id,
                userId: user!.id,
                startFromIndex,
                stage,
              },
            });
            if (enhErr) {
              console.warn('[LP-Editor] Enhance error:', enhErr);
              return;
            }
            console.log(`[LP-Editor] Enhance stage ${stage}: ${enhData?.enhanced || 0} sections, done: ${enhData?.done}`);
            queryClient.invalidateQueries({ queryKey: ['ai-landing-page', id] });
            if (enhData && !enhData.done && enhData.nextIndex != null) {
              await enhanceRecursive(enhData.nextIndex, enhData.nextStage || stage + 1);
            }
          } catch (err) {
            console.warn('[LP-Editor] Enhance error (non-blocking):', err);
          }
        };
        enhanceRecursive();
      }

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
          show_header: showHeader,
          show_footer: showFooter,
        } as any)
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

  // Auto-resize iframe
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ai-lp-resize' && typeof e.data.height === 'number') {
        setIframeHeight(e.data.height);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // V7/V5/V6: Check for schema, blocks, or HTML
  const hasSchema = !!landingPage?.generated_schema;
  const hasBlocks = landingPage?.generated_blocks && 
    (landingPage.generated_blocks as any)?.children?.length > 0;
  const hasHtml = !!landingPage?.generated_html;

  const renderPreview = () => {
    if (!hasSchema && !hasBlocks && !hasHtml) {
      const isGeneratingStatus = landingPage?.status === 'generating';
      return (
        <div className="flex items-center justify-center h-full bg-muted/30">
          <div className="text-center p-8 max-w-lg">
            {isGeneratingStatus ? (
              <>
                <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Gerando sua landing page...</h3>
                <p className="text-muted-foreground">
                  Aguarde enquanto a IA cria sua página. Isso pode levar alguns segundos.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wand2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Comece a criar sua página</h3>
                <p className="text-muted-foreground mb-6">
                  Use o <strong>Editor IA</strong> ao lado para descrever o que deseja. A IA vai gerar o conteúdo completo para você.
                </p>
                <div className="grid grid-cols-1 gap-2 text-left">
                  {[
                    'Crie uma landing page de promoção com banner, produtos e CTA',
                    'Faça uma página de captura de leads com formulário',
                    'Crie uma página de lançamento com countdown e benefícios',
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      className="text-sm text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => {
                        setActiveTab('editor');
                        setPromptInput(suggestion);
                      }}
                    >
                      <span className="text-muted-foreground mr-2">💡</span>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    // V7: Schema rendering (priority)
    if (hasSchema) {
      const schema = landingPage!.generated_schema as unknown as LPSchema;
      const isStillGenerating = landingPage?.status === 'generating';
      return (
        <div className="w-full h-full overflow-auto relative" style={{ background: schema.colorScheme?.bg || '#fff' }}>
          {isStillGenerating && (
            <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center p-8 max-w-md">
                <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Finalizando sua página...</h3>
                <p className="text-muted-foreground text-sm">
                  A IA está gerando as imagens e composições visuais. Isso pode levar de 1 a 3 minutos.
                </p>
                <div className="mt-4 w-48 mx-auto h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          )}
          {showHeader && (
            <div className="bg-muted/50 border-b px-4 py-2 text-center text-xs text-muted-foreground">
              ⬆ Cabeçalho da loja será exibido aqui na página pública
            </div>
          )}
          <LPSchemaRenderer schema={schema} />
          {showFooter && (
            <div className="bg-muted/50 border-t px-4 py-2 text-center text-xs text-muted-foreground">
              ⬇ Rodapé da loja será exibido aqui na página pública
            </div>
          )}
        </div>
      );
    }

    // V5.4: Prioritize HTML rendering (iframe) for maximum visual quality
    if (hasHtml) {
      const rawHtml = landingPage!.generated_html || '';
      const rawCss = landingPage!.generated_css || '';
      // Sanitize both HTML and CSS to fix animation issues
      const sanitizedHtml = sanitizeAILandingPageHtml(rawHtml);
      const sanitizedCss = sanitizeAILandingPageHtml(rawCss); // reuse same regex-based fixes
      const fullHtml = buildDocumentShell(sanitizedHtml, {
        extraCss: sanitizedCss || undefined,
      });

      return (
        <div className="w-full h-full overflow-auto" style={{ background: '#fff' }}>
          {showHeader && (
            <div className="bg-muted/50 border-b px-4 py-2 text-center text-xs text-muted-foreground">
              ⬆ Cabeçalho da loja será exibido aqui na página pública
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={fullHtml}
            className="w-full border-0"
            style={{ 
              height: iframeHeight ? `${iframeHeight}px` : '5000px',
              display: 'block',
            }}
            title="Landing Page Preview"
          />
          {showFooter && (
            <div className="bg-muted/50 border-t px-4 py-2 text-center text-xs text-muted-foreground">
              ⬇ Rodapé da loja será exibido aqui na página pública
            </div>
          )}
        </div>
      );
    }

    // Fallback: Render blocks via BlockRenderer (legacy V5 content)
    if (hasBlocks) {
      const blockContent = landingPage!.generated_blocks as BlockNode;
      const context: BlockRenderContext = {
        tenantSlug: tenant?.slug || '',
        isPreview: true,
        pageType: 'landing_page',
      };

      const contentChildren = (blockContent.children || []).filter(
        (node: BlockNode) => node.type !== 'Header' && node.type !== 'Footer'
      );

      const pageBg = (blockContent.props?.backgroundColor as string) || 'transparent';

      return (
        <div className="w-full h-full overflow-auto" style={{ background: pageBg === 'transparent' ? '#fff' : pageBg }}>
          {showHeader && (
            <div className="bg-muted/50 border-b px-4 py-2 text-center text-xs text-muted-foreground">
              ⬆ Cabeçalho da loja será exibido aqui na página pública
            </div>
          )}
          <div>
            {contentChildren.map((node: BlockNode) => (
              <BlockRenderer
                key={node.id}
                node={node}
                context={context}
                isEditing={false}
              />
            ))}
          </div>
          {showFooter && (
            <div className="bg-muted/50 border-t px-4 py-2 text-center text-xs text-muted-foreground">
              ⬇ Rodapé da loja será exibido aqui na página pública
            </div>
          )}
        </div>
      );
    }

    return null;
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/pages')}>
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
                disabled={publishMutation.isPending || (!landingPage.generated_html && !landingPage.generated_schema)}
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
            style={viewMode === 'desktop' ? { overflow: 'auto' } : undefined}
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
              <LandingPageChatInput
                onSend={(message, attachments) => {
                  let fullPrompt = message;
                  if (attachments && attachments.length > 0) {
                    const attachmentInfo = attachments.map(a => 
                      `[${a.type === 'image' ? 'Imagem' : 'Vídeo'}: ${a.url}]`
                    ).join('\n');
                    fullPrompt = `${message}\n\nMídias anexadas:\n${attachmentInfo}`;
                  }
                  sendPromptMutation.mutate(fullPrompt);
                }}
                isLoading={sendPromptMutation.isPending}
                placeholder="Descreva o ajuste que deseja fazer..."
              />
            </TabsContent>

            <TabsContent value="settings" className="flex-1 p-4 m-0">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">SEO</h3>
                    <GenerateSeoButton
                      input={{
                        type: 'page',
                        name: landingPage.name,
                        content: landingPage.generated_html || '',
                        storeName: tenant?.name,
                      }}
                      onGenerated={(result) => {
                        setSeoTitle(result.seo_title);
                        setSeoDescription(result.seo_description);
                        toast.success('SEO gerado! Clique em Salvar para aplicar.');
                      }}
                      disabled={!landingPage.generated_html}
                    />
                  </div>
                  {!landingPage.generated_html && (
                    <p className="text-xs text-muted-foreground">
                      Gere a página primeiro para habilitar o SEO com IA.
                    </p>
                  )}
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
                  <h3 className="font-medium">Exibição</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="show-header">Exibir Cabeçalho da Loja</Label>
                      <p className="text-xs text-muted-foreground">Mostra o header padrão da loja acima da landing page</p>
                    </div>
                    <Switch
                      id="show-header"
                      checked={showHeader}
                      onCheckedChange={setShowHeader}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="show-footer">Exibir Rodapé da Loja</Label>
                      <p className="text-xs text-muted-foreground">Mostra o footer padrão da loja abaixo da landing page</p>
                    </div>
                    <Switch
                      id="show-footer"
                      checked={showFooter}
                      onCheckedChange={setShowFooter}
                    />
                  </div>
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