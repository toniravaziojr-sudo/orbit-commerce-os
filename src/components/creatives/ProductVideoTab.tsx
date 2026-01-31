/**
 * Product Video Tab — Vídeos de Produto SEM pessoas (efeitos, reels)
 * 
 * SUBSTITUI: ShortVideoTab + TechProductTab
 * 
 * Pipeline: Kling I2V v2.6 Pro (start_image_url + end_image_url opcional)
 * Opcional: GPT Image 1.5 Edit para gerar cenário premium
 * 
 * IMPORTANTE: SEM campos de avatar/voz/pessoa
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CustomPipelineInfo } from './AIPipelineInfo';
import { Switch } from '@/components/ui/switch';
import { 
  Video, 
  Sparkles,
  Upload,
  Package,
  Loader2,
  RotateCw,
  Droplets,
  Zap,
  Focus,
  Moon,
  Sun,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { CREATIVE_MODELS, PRODUCT_VIDEO_STYLES, type AspectRatio, type KlingVideoDuration } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';
import { useProducts } from '@/hooks/useProducts';

const STYLE_ICONS: Record<string, React.ReactNode> = {
  rotation: <RotateCw className="h-4 w-4" />,
  floating: <Zap className="h-4 w-4" />,
  splash: <Droplets className="h-4 w-4" />,
  macro: <Focus className="h-4 w-4" />,
  'tech-premium-black': <Moon className="h-4 w-4" />,
  'clean-studio': <Sun className="h-4 w-4" />,
};

export function ProductVideoTab() {
  const [productId, setProductId] = useState<string>('');
  const [selectedProductImage, setSelectedProductImage] = useState<string>('');
  const [style, setStyle] = useState<string>('rotation');
  const [duration, setDuration] = useState<KlingVideoDuration>('5');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [promptAdditions, setPromptAdditions] = useState('');
  const [generatePremiumScene, setGeneratePremiumScene] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(false);
  
  // Start/End frames (opcional)
  const [useFrameControl, setUseFrameControl] = useState(false);

  const { data: jobs, isLoading } = useCreativeJobs('product_video');
  const createJob = useCreateCreativeJob();
  const { products } = useProducts();

  const models = CREATIVE_MODELS.product_video;
  const selectedStyle = PRODUCT_VIDEO_STYLES.find(s => s.id === style);

  // Produto selecionado
  const selectedProduct = products?.find(p => p.id === productId);

  const handleGenerate = async () => {
    if (!productId || !selectedProductImage) return;

    const styleConfig = PRODUCT_VIDEO_STYLES.find(s => s.id === style);
    const basePrompt = styleConfig?.prompt || '';
    const fullPrompt = promptAdditions 
      ? `${basePrompt}. ${promptAdditions}`
      : basePrompt;

    createJob.mutate({
      type: 'product_video',
      prompt: fullPrompt,
      product_id: productId,
      product_name: selectedProduct?.name,
      product_image_url: selectedProductImage,
      settings: {
        style,
        duration,
        aspect_ratio: aspectRatio,
        generate_premium_scene: generatePremiumScene,
        generate_audio: generateAudio,
        // Kling I2V usa start_image_url (será mapeado no backend)
        start_frame: selectedProductImage,
      },
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Novo Vídeo de Produto
          </CardTitle>
          <CardDescription>
            Vídeos cinematográficos SEM pessoas — efeitos, rotação, partículas, close-ups
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Produto (OBRIGATÓRIO) */}
          <div className="space-y-2">
            <Label>Produto do Catálogo *</Label>
            <Select value={productId} onValueChange={(v) => {
              setProductId(v);
              const product = products?.find(p => p.id === v) as any;
              // Use primeira imagem disponível do produto
              const imageUrl = product?.image_url || product?.images?.[0] || product?.thumbnail;
              if (imageUrl) {
                setSelectedProductImage(imageUrl);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products?.slice(0, 50).map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {product.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A imagem do produto será usada como frame inicial (start_image_url)
            </p>
          </div>

          {/* Preview da Imagem do Produto */}
          {selectedProductImage && (
            <div className="space-y-2">
              <Label>Imagem selecionada</Label>
              <div className="w-24 h-24 rounded-lg border overflow-hidden">
                <img 
                  src={selectedProductImage} 
                  alt="Produto" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Estilo Visual */}
          <div className="space-y-3">
            <Label>Estilo Visual</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCT_VIDEO_STYLES.map((s) => (
                <div
                  key={s.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    style === s.id 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setStyle(s.id)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {STYLE_ICONS[s.id]}
                    <span className="text-sm font-medium">{s.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Opções avançadas */}
          <div className="space-y-3">
            {/* Gerar Cenário Premium (opcional) */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="premium-scene" className="cursor-pointer">
                  Gerar Cenário Premium
                </Label>
                <p className="text-xs text-muted-foreground">
                  Usa IA para criar cenário sofisticado antes de animar
                </p>
              </div>
              <Switch
                id="premium-scene"
                checked={generatePremiumScene}
                onCheckedChange={setGeneratePremiumScene}
              />
            </div>
            
            {/* Gerar Áudio (opcional) */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="generate-audio" className="cursor-pointer">
                  Gerar Áudio Automático
                </Label>
                <p className="text-xs text-muted-foreground">
                  Áudio nativo gerado pela IA (inglês/chinês apenas)
                </p>
              </div>
              <Switch
                id="generate-audio"
                checked={generateAudio}
                onCheckedChange={setGenerateAudio}
              />
            </div>
          </div>

          {/* Duration & Aspect Ratio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duration} onValueChange={(v) => setDuration(v as KlingVideoDuration)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 segundos</SelectItem>
                  <SelectItem value="10">10 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proporção</Label>
              <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Instruções Adicionais */}
          <div className="space-y-2">
            <Label>Instruções Adicionais (opcional)</Label>
            <Textarea 
              value={promptAdditions}
              onChange={(e) => setPromptAdditions(e.target.value)}
              placeholder="Ex: 'foco no rótulo', 'movimento mais lento', 'reflexos dourados'..."
              rows={3}
            />
          </div>

          {/* Pipeline Info - Apenas para tenants especiais */}
          <CustomPipelineInfo 
            label="Pipeline:" 
            description={`Modelo: ${models.find(m => m.isDefault)?.name} • Custo estimado: ~R$ ${((models.find(m => m.isDefault)?.costEstimate || 60) / 100).toFixed(2)}`}
          >
            {generatePremiumScene && (
              <Badge variant="outline" className="text-xs">GPT Image (Cenário)</Badge>
            )}
            <Badge variant="default" className="text-xs bg-primary/90">
              Kling I2V v2.6 Pro
            </Badge>
          </CustomPipelineInfo>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!productId || !selectedProductImage || createJob.isPending}
            onClick={handleGenerate}
          >
            {createJob.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar Vídeo de Produto
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Acompanhe o status dos seus vídeos de produto</CardDescription>
        </CardHeader>
        <CardContent>
          <CreativeJobsList jobs={jobs || []} isLoading={isLoading} type="product_video" />
        </CardContent>
      </Card>
    </div>
  );
}
