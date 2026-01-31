/**
 * UGC AI Tab — Avatar/Ator 100% IA com Produto do Catálogo
 * 
 * Pipeline:
 * - Talking Head: Kling Avatar v2 (imagem + áudio)
 * - Em Cena com Produto: GPT Image Edit (keyframe) + Kling I2V (animar)
 * 
 * PRODUTO DO CATÁLOGO É OBRIGATÓRIO
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
  User, 
  Video,
  Sparkles,
  Upload,
  Loader2,
  Zap,
  Package,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { useProductsWithImages } from '@/hooks/useProducts';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

type GenerationMode = 'talking_head' | 'scene_with_product';

export function UGCAITab() {
  // Produto OBRIGATÓRIO
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Modo de geração
  const [mode, setMode] = useState<GenerationMode>('scene_with_product');
  
  // Conteúdo
  const [script, setScript] = useState('');
  const [cta, setCta] = useState('');
  
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

  // Validação
  const isValid = selectedProductId && script.trim().length > 0;

  const handleGenerate = async () => {
    if (!isValid) return;
    
    createJob.mutate({
      type: 'ugc_ai_video',
      prompt: script,
      product_id: selectedProductId,
      product_name: selectedProduct?.name,
      product_image_url: productImageUrl,
      settings: {
        mode,
        duration: parseInt(duration),
        aspect_ratio: aspectRatio,
        cta: cta || undefined,
        // Pipeline específico por modo
        ...(mode === 'scene_with_product' ? {
          input_fidelity: 'high', // Preservar rótulo do produto
        } : {}),
      },
    }, {
      onSuccess: () => {
        setScript('');
        setCta('');
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
            Crie vídeos com IA mostrando seu produto — selecione do catálogo
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
                    Imagem será usada como referência (input_fidelity: high)
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

          {/* Modo de Geração */}
          <div className="space-y-3">
            <Label>Modo de Geração</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as GenerationMode)}>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="scene_with_product" id="mode-scene" className="mt-1" />
                <div>
                  <Label htmlFor="mode-scene" className="flex items-center gap-2 cursor-pointer">
                    <Video className="h-4 w-4" />
                    Em Cena com Produto (Recomendado)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pessoa segurando/usando o produto — GPT Image (keyframe) + Kling I2V
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="talking_head" id="mode-avatar" className="mt-1" />
                <div>
                  <Label htmlFor="mode-avatar" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" />
                    Talking Head (Avatar Falando)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avatar olhando para câmera + produto como cutaway — Kling Avatar v2
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Script */}
          <div className="space-y-2">
            <Label>Script/Roteiro *</Label>
            <Textarea 
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Digite o texto que será falado/narrado...

Exemplo:
'Gente, vocês precisam conhecer esse produto! Eu estava com problema X e depois que comecei a usar, minha vida mudou completamente. Super recomendo!'"
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              {script.length} caracteres • Recomendado: 100-300 caracteres
            </p>
          </div>

          {/* CTA Opcional */}
          <div className="space-y-2">
            <Label>CTA Final (opcional)</Label>
            <Input 
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Ex: Compre agora com 20% de desconto!" 
            />
          </div>

          {/* Avatar Reference (para talking_head) */}
          {mode === 'talking_head' && (
            <div className="space-y-2">
              <Label>Referência do Avatar (opcional)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">
                <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Upload de foto para consistência visual (opcional)
                </p>
              </div>
            </div>
          )}

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
              <p className="text-xs text-muted-foreground">Kling I2V suporta 5s ou 10s</p>
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

          {/* Modelos - Apenas para tenants especiais */}
          <CustomPipelineInfo label="Pipeline recomendado:">
            {mode === 'scene_with_product' ? (
              <>
                <Badge variant="outline" className="text-xs">GPT Image 1.5 Edit</Badge>
                <Badge variant="outline" className="text-xs">→</Badge>
                <Badge variant="outline" className="text-xs">Kling I2V v2.6</Badge>
                <Badge variant="outline" className="text-xs">+ F5-TTS</Badge>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-xs">Kling Avatar v2</Badge>
                <Badge variant="outline" className="text-xs">+ F5-TTS</Badge>
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
