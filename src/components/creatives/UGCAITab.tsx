/**
 * UGC AI Tab — Pessoa 100% IA segurando/usando Produto
 * 
 * Pipeline: GPT Image Edit (keyframe) + Kling I2V (animar)
 * Áudio: Sem | Nativo (EN/ZH) | TTS PT-BR (F5-TTS + Sync)
 * 
 * PRODUTO DO CATÁLOGO É OBRIGATÓRIO
 * Foco: Pessoa com produto na mão / interagindo fisicamente
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CustomPipelineInfo } from './AIPipelineInfo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  Video,
  Sparkles,
  Loader2,
  Zap,
  Package,
  ShoppingBag,
  AlertCircle,
  Volume2,
  VolumeX,
  Languages,
  Mic,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { useProductsWithImages } from '@/hooks/useProducts';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';
import { VoiceSelector } from './VoiceSelector';

type AudioMode = 'none' | 'native' | 'tts_ptbr';

export function UGCAITab() {
  // Produto OBRIGATÓRIO
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Conteúdo
  const [script, setScript] = useState('');
  const [cta, setCta] = useState('');
  
  // Áudio
  const [audioMode, setAudioMode] = useState<AudioMode>('none');
  const [ttsScript, setTtsScript] = useState('');
  const [voicePresetId, setVoicePresetId] = useState<string>('');
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  
  // Configurações
  const [duration, setDuration] = useState<string>('10');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  
  // Estado
  const [justCreated, setJustCreated] = useState(false);
  
  // Hooks
  const { products, isLoading: productsLoading } = useProductsWithImages();
  const { data: jobs, isLoading, refetch } = useCreativeJobs('ugc_ai_video');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.ugc_ai_video;
  const activeJobs = jobs?.filter(j => j.status === 'queued' || j.status === 'running') || [];
  const hasActiveJobs = activeJobs.length > 0;
  
  // Produto selecionado
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const productImageUrl = selectedProduct?.primary_image_url || 
                          (selectedProduct as any)?.images?.[0] || 
                          (selectedProduct as any)?.thumbnail;

  // Validação - aceita voicePresetId OU customAudioUrl
  const hasVoice = voicePresetId || customAudioUrl;
  const isValid = selectedProductId && 
                  script.trim().length > 0 &&
                  (audioMode !== 'tts_ptbr' || (ttsScript.trim().length > 0 && hasVoice));

  const handleGenerate = async () => {
    if (!isValid) return;
    
    createJob.mutate({
      type: 'ugc_ai_video',
      prompt: script,
      product_id: selectedProductId,
      product_name: selectedProduct?.name,
      product_image_url: productImageUrl,
      settings: {
        mode: 'scene_with_product', // Único modo agora
        duration: parseInt(duration),
        aspect_ratio: aspectRatio,
        cta: cta || undefined,
        input_fidelity: 'high', // Preservar rótulo do produto
        // Áudio
        audio_mode: audioMode,
        generate_audio: audioMode === 'native',
        ...(audioMode === 'tts_ptbr' ? {
          tts_script: ttsScript,
          voice_preset_id: voicePresetId || undefined,
          custom_voice_url: customAudioUrl || undefined,
        } : {}),
      },
    }, {
      onSuccess: () => {
        setScript('');
        setCta('');
        setTtsScript('');
        setJustCreated(true);
        setTimeout(() => refetch(), 500);
        setTimeout(() => setJustCreated(false), 5000);
      }
    });
  };
  
  // Polling para jobs ativos
  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [hasActiveJobs, refetch]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Novo UGC 100% IA
          </CardTitle>
          <CardDescription>
            Pessoa segurando/usando o produto — gerada por IA
          </CardDescription>
        </CardHeader>
        
        {justCreated && (
          <div className="px-6">
            <Alert className="bg-primary/10 border-primary/30 animate-pulse">
              <Zap className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">
                <strong>Geração iniciada!</strong> Acompanhe o progresso no painel ao lado →
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        <CardContent className="space-y-6">
          {/* PRODUTO DO CATÁLOGO - OBRIGATÓRIO */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Produto do Catálogo *
              <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
            </Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className={!selectedProductId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione um produto..." />
              </SelectTrigger>
              <SelectContent>
                {productsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Carregando produtos...
                  </div>
                ) : products.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nenhum produto encontrado
                  </div>
                ) : (
                  products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{product.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            
            {/* Preview do produto selecionado */}
            {selectedProduct && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 mt-2">
                {productImageUrl ? (
                  <img 
                    src={productImageUrl} 
                    alt={selectedProduct.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{selectedProduct.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Imagem será usada como referência
                  </p>
                </div>
              </div>
            )}
            
            {!selectedProductId && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Selecione um produto do catálogo para garantir que ele apareça no vídeo
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Prompt/Descrição da Cena */}
          <div className="space-y-2">
            <Label>Descrição da Cena *</Label>
            <Textarea 
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Descreva a pessoa e a cena com o produto...

Exemplo:
'Uma mulher jovem, cabelos castanhos, segurando o produto nas mãos e mostrando para a câmera com expressão de surpresa positiva. Fundo de sala de estar moderna.'"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {script.length} caracteres • Descreva aparência, ação e cenário
            </p>
          </div>

          {/* ÁUDIO DO VÍDEO */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Áudio do Vídeo
            </Label>
            <RadioGroup value={audioMode} onValueChange={(v) => setAudioMode(v as AudioMode)}>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="none" id="audio-none" className="mt-0.5" />
                <div>
                  <Label htmlFor="audio-none" className="flex items-center gap-2 cursor-pointer">
                    <VolumeX className="h-4 w-4" />
                    Sem Áudio
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vídeo mudo — ideal para adicionar música depois
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="native" id="audio-native" className="mt-0.5" />
                <div>
                  <Label htmlFor="audio-native" className="flex items-center gap-2 cursor-pointer">
                    <Languages className="h-4 w-4" />
                    Áudio Nativo (EN/ZH)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gerado pelo modelo — apenas Inglês ou Chinês
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                <RadioGroupItem value="tts_ptbr" id="audio-tts" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="audio-tts" className="flex items-center gap-2 cursor-pointer">
                    <Mic className="h-4 w-4" />
                    Português (TTS)
                    <Badge variant="secondary" className="text-[10px]">Recomendado</Badge>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Narração em PT-BR via F5-TTS + sincronização
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Campos TTS PT-BR */}
          {audioMode === 'tts_ptbr' && (
            <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Script da Narração *
                  <Badge variant="outline" className="text-[10px]">PT-BR</Badge>
                </Label>
                <Textarea
                  value={ttsScript}
                  onChange={(e) => setTtsScript(e.target.value)}
                  placeholder="Digite o texto que será narrado em português...

Exemplo:
'Gente, vocês precisam conhecer esse produto! Eu estava com problema X e depois que comecei a usar, minha vida mudou!'"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {ttsScript.length} caracteres • Texto que será convertido em áudio
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Voz *</Label>
                <VoiceSelector
                  value={voicePresetId}
                  onChange={(presetId) => setVoicePresetId(presetId || '')}
                  customAudioUrl={customAudioUrl || undefined}
                  onCustomAudioChange={setCustomAudioUrl}
                />
              </div>
            </div>
          )}

          {/* CTA Opcional */}
          <div className="space-y-2">
            <Label>CTA Final (opcional)</Label>
            <Input 
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Ex: Compre agora com 20% de desconto!" 
            />
          </div>

          {/* Duration & Aspect Ratio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
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
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pipeline Info */}
          <CustomPipelineInfo label="Pipeline:">
            <Badge variant="outline" className="text-xs">GPT Image Edit</Badge>
            <Badge variant="outline" className="text-xs">→</Badge>
            <Badge variant="outline" className="text-xs">Kling I2V</Badge>
            {audioMode === 'tts_ptbr' && (
              <>
                <Badge variant="outline" className="text-xs">→</Badge>
                <Badge variant="outline" className="text-xs">F5-TTS</Badge>
                <Badge variant="outline" className="text-xs">→</Badge>
                <Badge variant="outline" className="text-xs">Sync</Badge>
              </>
            )}
          </CustomPipelineInfo>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!isValid || createJob.isPending}
            onClick={handleGenerate}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {createJob.isPending ? 'Gerando...' : 'Gerar UGC com IA'}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Jobs */}
      <Card className={hasActiveJobs ? 'ring-2 ring-primary/50 ring-offset-2' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {hasActiveJobs && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            Histórico de Gerações
            {hasActiveJobs && (
              <Badge variant="secondary" className="ml-auto animate-pulse">
                {activeJobs.length} em andamento
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {hasActiveJobs 
              ? 'Processando seus criativos... Atualizando automaticamente.'
              : 'Acompanhe o status dos seus criativos'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreativeJobsList 
            jobs={jobs || []} 
            isLoading={isLoading} 
            type="ugc_ai_video" 
            highlightNew={justCreated}
          />
        </CardContent>
      </Card>
    </div>
  );
}
