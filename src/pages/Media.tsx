import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Image, Link, Facebook, Instagram, Youtube, Video, Plus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignsList } from "@/components/media/CampaignsList";
import { MediaVideoJobsList } from "@/components/media/MediaVideoJobsList";
import { ImageGenerationTabV3 } from "@/components/creatives/image-generation";
import { useYouTubeConnection } from "@/hooks/useYouTubeConnection";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useAdminModeSafe } from "@/contexts/AdminModeContext";
import { 
  useMediaCategoryProfiles, 
  useCreateMediaVideoJob 
} from "@/hooks/useMediaVideoCreatives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function Media() {
  const { isConnected: youtubeConnected } = useYouTubeConnection();
  const { isPlatformOperator } = usePlatformOperator();
  const { isStoreMode } = useAdminModeSafe();
  
  // YouTube is only visible for platform operators in store mode (following rollout protocol)
  const showYouTube = isPlatformOperator && isStoreMode;

  // Video generation state
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoNiche, setVideoNiche] = useState("social_product");
  const [videoDuration, setVideoDuration] = useState(6);
  const [videoProductUrl, setVideoProductUrl] = useState("");
  const [enableQa, setEnableQa] = useState(true);
  const [enableFallback, setEnableFallback] = useState(true);

  const { data: categoryProfiles } = useMediaCategoryProfiles();
  const createVideoJob = useCreateMediaVideoJob();

  const handleCreateVideo = async () => {
    if (!videoPrompt.trim()) return;

    await createVideoJob.mutateAsync({
      prompt: videoPrompt.trim(),
      niche: videoNiche,
      duration_seconds: videoDuration,
      product_image_url: videoProductUrl || undefined,
      enable_qa: enableQa,
      enable_fallback: enableFallback,
    });

    // Reset form
    setVideoPrompt("");
    setVideoProductUrl("");
    setVideoDialogOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Gestor de Mídias IA"
        description="Crie campanhas de conteúdo para Facebook, Instagram e YouTube com calendário editorial gerado por IA"
      />
      
      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-full">
          <Facebook className="h-3.5 w-3.5" />
          Facebook
        </div>
        <div className="flex items-center gap-1 px-3 py-1 bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 rounded-full">
          <Instagram className="h-3.5 w-3.5" />
          Instagram
        </div>
        {showYouTube && (
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
            youtubeConnected 
              ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400" 
              : "bg-muted text-muted-foreground"
          }`}>
            <Youtube className="h-3.5 w-3.5" />
            YouTube
            {!youtubeConnected && <span className="text-xs ml-1">(conectar)</span>}
          </div>
        )}
      </div>

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Calendar className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Imagens IA
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-2">
            <Video className="h-4 w-4" />
            Vídeos IA
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2" disabled>
            <Image className="h-4 w-4" />
            Biblioteca
          </TabsTrigger>
          <TabsTrigger value="connections" className="gap-2" disabled>
            <Link className="h-4 w-4" />
            Conexões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignsList />
        </TabsContent>

        <TabsContent value="images">
          <ImageGenerationTabV3 />
        </TabsContent>

        <TabsContent value="videos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Geração de Vídeos com IA</CardTitle>
              <Button onClick={() => setVideoDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Gerar Vídeo
              </Button>
            </CardHeader>
            <CardContent>
              <MediaVideoJobsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library">
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Biblioteca de Mídias</h3>
            <p>Em breve você poderá gerenciar todos os seus assets aqui.</p>
          </div>
        </TabsContent>

        <TabsContent value="connections">
          <div className="text-center py-12 text-muted-foreground">
            <Link className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Conexões com Redes Sociais</h3>
            <p>Em breve você poderá conectar suas redes para publicação automática.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Video Generation Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerar Vídeo com IA</DialogTitle>
            <DialogDescription>
              Descreva o vídeo que deseja criar. A IA vai gerar variações e selecionar a melhor automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="video-prompt">Descrição do vídeo *</Label>
              <Textarea
                id="video-prompt"
                placeholder="Ex: Vídeo mostrando o produto em uso, com foco nos detalhes e benefícios..."
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-product-url">URL da imagem do produto (opcional)</Label>
              <Input
                id="video-product-url"
                placeholder="https://..."
                value={videoProductUrl}
                onChange={(e) => setVideoProductUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Forneça uma imagem para garantir fidelidade visual do produto.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="video-niche">Estilo</Label>
                <Select value={videoNiche} onValueChange={setVideoNiche}>
                  <SelectTrigger id="video-niche">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryProfiles?.map((profile) => (
                      <SelectItem key={profile.niche} value={profile.niche}>
                        {profile.display_name}
                      </SelectItem>
                    )) || (
                      <>
                        <SelectItem value="social_product">Foco no Produto</SelectItem>
                        <SelectItem value="social_lifestyle">Lifestyle</SelectItem>
                        <SelectItem value="social_storytelling">Storytelling</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-duration">Duração</Label>
                <Select value={String(videoDuration)} onValueChange={(v) => setVideoDuration(Number(v))}>
                  <SelectTrigger id="video-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 segundos</SelectItem>
                    <SelectItem value="10">10 segundos</SelectItem>
                    <SelectItem value="15">15 segundos</SelectItem>
                    <SelectItem value="30">30 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enable-qa">Avaliação QA Automática</Label>
                  <p className="text-xs text-muted-foreground">
                    IA avalia qualidade e fidelidade do produto
                  </p>
                </div>
                <Switch
                  id="enable-qa"
                  checked={enableQa}
                  onCheckedChange={setEnableQa}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enable-fallback">Fallback por Composição</Label>
                  <p className="text-xs text-muted-foreground">
                    Compõe o produto sobre cenário se QA falhar
                  </p>
                </div>
                <Switch
                  id="enable-fallback"
                  checked={enableFallback}
                  onCheckedChange={setEnableFallback}
                  disabled={!enableQa}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateVideo} 
              disabled={!videoPrompt.trim() || createVideoJob.isPending}
            >
              {createVideoJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar Vídeo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
