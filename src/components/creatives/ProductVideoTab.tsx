/**
 * Product Video Tab — Vídeos de Produto SEM pessoas (efeitos, reels)
 * 
 * SUBSTITUI: ShortVideoTab + TechProductTab
 * 
 * Pipeline: Kling I2V v2.6 Pro (start_image_url + end_image_url opcional)
 * Opcional: GPT Image 1.5 Edit para gerar cenário premium
 * 
 * ÁUDIO:
 * - Sem áudio (padrão)
 * - Nativo (EN/ZH - gerado pelo modelo)
 * - PT-BR (TTS) - F5-TTS + mux de áudio
 * 
 * IMPORTANTE: SEM campos de avatar/voz/pessoa (é vídeo de produto)
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, 
  Sparkles,
  Package,
  Loader2,
  RotateCw,
  Droplets,
  Zap,
  Focus,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Languages,
  AlertCircle,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { useAvailableVoicePresets } from '@/hooks/useVoicePresets';
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

// Tipos de áudio disponíveis
type AudioMode = 'none' | 'native' | 'tts_ptbr';

export function ProductVideoTab() {
  const [productId, setProductId] = useState<string>('');
  const [selectedProductImage, setSelectedProductImage] = useState<string>('');
  const [style, setStyle] = useState<string>('rotation');
  const [duration, setDuration] = useState<KlingVideoDuration>('5');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [promptAdditions, setPromptAdditions] = useState('');
  const [generatePremiumScene, setGeneratePremiumScene] = useState(false);
  
  // NOVO: Sistema de áudio com 3 opções
  const [audioMode, setAudioMode] = useState<AudioMode>('none');
  const [voiceScript, setVoiceScript] = useState('');
  const [voicePresetId, setVoicePresetId] = useState('');

  const { data: jobs, isLoading } = useCreativeJobs('product_video');
  const createJob = useCreateCreativeJob();
  const { products } = useProducts();
  const { data: voicePresets, allPresets } = useAvailableVoicePresets();

  const models = CREATIVE_MODELS.product_video;
  const selectedStyle = PRODUCT_VIDEO_STYLES.find(s => s.id === style);

  // Produto selecionado
  const selectedProduct = products?.find(p => p.id === productId);
  
  // Preset selecionado
  const selectedPreset = allPresets.find(p => p.id === voicePresetId);
  const presetHasAudio = selectedPreset?.ref_audio_url;

  // Validação: TTS requer script e preset com áudio configurado
  const canSubmitTTS = audioMode !== 'tts_ptbr' || (voiceScript.trim().length > 0 && presetHasAudio);

  const handleGenerate = async () => {
    if (!productId || !selectedProductImage) return;
    if (!canSubmitTTS) return;

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
        // NOVO: Sistema de áudio
        audio_mode: audioMode,
        generate_audio: audioMode === 'native', // Para compatibilidade com Kling I2V
        // TTS PT-BR settings
        ...(audioMode === 'tts_ptbr' && {
          voice_script: voiceScript,
          voice_preset_id: voicePresetId,
        }),
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
            
          </div>

          {/* NOVO: Sistema de Áudio com 3 opções */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Áudio do Vídeo
            </Label>
            <Select value={audioMode} onValueChange={(v) => setAudioMode(v as AudioMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <VolumeX className="h-4 w-4" />
                    Sem áudio
                  </div>
                </SelectItem>
                <SelectItem value="native">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Nativo (EN/ZH)
                  </div>
                </SelectItem>
                <SelectItem value="tts_ptbr">
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4" />
                    Narração PT-BR (TTS)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {audioMode === 'none' && 'Vídeo será gerado sem trilha sonora'}
              {audioMode === 'native' && 'Áudio gerado pelo modelo (apenas inglês/chinês suportados)'}
              {audioMode === 'tts_ptbr' && 'Narração em português gerada via F5-TTS e combinada com o vídeo'}
            </p>
          </div>

          {/* Campos TTS PT-BR (aparecem apenas quando selecionado) */}
          {audioMode === 'tts_ptbr' && (
            <div className="space-y-4 p-4 border rounded-lg bg-primary/5">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Languages className="h-4 w-4" />
                Configuração da Narração PT-BR
              </div>
              
              {/* Script obrigatório */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Script em Português *
                  <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                </Label>
                <Textarea 
                  value={voiceScript}
                  onChange={(e) => setVoiceScript(e.target.value)}
                  placeholder="Digite o texto que será narrado no vídeo..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {voiceScript.length} caracteres • Este texto será sintetizado via F5-TTS
                </p>
              </div>

              {/* Preset de Voz */}
              <div className="space-y-2">
                <Label>Voz (Preset)</Label>
                <Select value={voicePresetId} onValueChange={setVoicePresetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma voz" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPresets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id} disabled={!preset.ref_audio_url}>
                        <div className="flex items-center gap-2">
                          <span>{preset.name}</span>
                          {!preset.ref_audio_url && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              não configurado
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {voicePresets.length === 0 && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Nenhum preset de voz está configurado. Configure os áudios de referência em Configurações → Vozes.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

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
            {audioMode === 'tts_ptbr' && (
              <>
                <Badge variant="outline" className="text-xs">F5-TTS (PT-BR)</Badge>
                <Badge variant="outline" className="text-xs">Mux Áudio</Badge>
              </>
            )}
          </CustomPipelineInfo>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!productId || !selectedProductImage || createJob.isPending || !canSubmitTTS}
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
