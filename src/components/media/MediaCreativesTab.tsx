import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, FolderOpen, Image, Video, Plus, Loader2 } from "lucide-react";
import { MediaVideoJobsList } from "./MediaVideoJobsList";
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
import {
  useMediaCategoryProfiles,
  useCreateMediaVideoJob,
} from "@/hooks/useMediaVideoCreatives";

/**
 * Aba "Criativos" do Gestor de Mídias IA.
 * Interface PRÓPRIA — NÃO importa nada do módulo Gestão de Criativos.
 * Permite gerar imagem/vídeo para posts OU selecionar da galeria/drive.
 */
export function MediaCreativesTab() {
  const [subTab, setSubTab] = useState<"generate" | "gallery">("generate");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");

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
    setVideoPrompt("");
    setVideoProductUrl("");
    setVideoDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Sub-navegação: Gerar vs Galeria */}
      <div className="flex gap-2">
        <Button
          variant={subTab === "generate" ? "default" : "outline"}
          onClick={() => setSubTab("generate")}
          className="gap-2"
          size="sm"
        >
          <Sparkles className="h-4 w-4" />
          Gerar com IA
        </Button>
        <Button
          variant={subTab === "gallery" ? "default" : "outline"}
          onClick={() => setSubTab("gallery")}
          className="gap-2"
          size="sm"
        >
          <FolderOpen className="h-4 w-4" />
          Selecionar da Galeria
        </Button>
      </div>

      {subTab === "generate" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gerar Criativo para Post</CardTitle>
            <CardDescription>
              Crie uma imagem ou vídeo para usar nos seus posts de redes sociais
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Tipo de mídia */}
            <div className="flex gap-2 mb-6">
              <Button
                variant={mediaType === "image" ? "default" : "outline"}
                onClick={() => setMediaType("image")}
                className="gap-2"
                size="sm"
              >
                <Image className="h-4 w-4" />
                Imagem
              </Button>
              <Button
                variant={mediaType === "video" ? "default" : "outline"}
                onClick={() => setMediaType("video")}
                className="gap-2"
                size="sm"
              >
                <Video className="h-4 w-4" />
                Vídeo
              </Button>
            </div>

            {mediaType === "image" && (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Gerar Imagem para Post</h3>
                <p className="text-sm mb-4">
                  Descreva a imagem que deseja para o post da campanha.
                </p>
                <p className="text-xs text-muted-foreground">
                  Use o calendário na aba "Estratégia" → selecione um item → gere o criativo vinculado ao post.
                </p>
              </div>
            )}

            {mediaType === "video" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Vídeos gerados com IA para suas campanhas sociais
                  </p>
                  <Button onClick={() => setVideoDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Gerar Vídeo
                  </Button>
                </div>
                <MediaVideoJobsList />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {subTab === "gallery" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selecionar da Galeria</CardTitle>
            <CardDescription>
              Escolha um criativo existente do seu Drive ou da Gestão de Criativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Meu Drive</h3>
              <p className="text-sm mb-1">Selecione imagens ou vídeos já existentes para vincular ao post.</p>
              <p className="text-xs">Criativos gerados em "Gestão de Criativos" ficam salvos na pasta "Criativos com IA".</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Generation Dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerar Vídeo para Post</DialogTitle>
            <DialogDescription>
              Descreva o vídeo para sua campanha social. A IA vai gerar variações e selecionar a melhor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="media-video-prompt">Descrição do vídeo *</Label>
              <Textarea
                id="media-video-prompt"
                placeholder="Ex: Vídeo mostrando o produto em uso, com foco nos detalhes e benefícios..."
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="media-video-product-url">URL da imagem do produto (opcional)</Label>
              <Input
                id="media-video-product-url"
                placeholder="https://..."
                value={videoProductUrl}
                onChange={(e) => setVideoProductUrl(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estilo</Label>
                <Select value={videoNiche} onValueChange={setVideoNiche}>
                  <SelectTrigger>
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
                <Label>Duração</Label>
                <Select value={String(videoDuration)} onValueChange={(v) => setVideoDuration(Number(v))}>
                  <SelectTrigger>
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
                  <Label htmlFor="media-enable-qa">Avaliação QA Automática</Label>
                  <p className="text-xs text-muted-foreground">IA avalia qualidade e fidelidade</p>
                </div>
                <Switch id="media-enable-qa" checked={enableQa} onCheckedChange={setEnableQa} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="media-enable-fallback">Fallback por Composição</Label>
                  <p className="text-xs text-muted-foreground">Compõe produto sobre cenário se QA falhar</p>
                </div>
                <Switch id="media-enable-fallback" checked={enableFallback} onCheckedChange={setEnableFallback} disabled={!enableQa} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateVideo} disabled={!videoPrompt.trim() || createVideoJob.isPending}>
              {createVideoJob.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar Vídeo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
