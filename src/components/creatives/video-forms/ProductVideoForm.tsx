/**
 * Product Video Form — Vídeos promocionais de produto
 * 
 * Pipeline: Runway ML (video) + ElevenLabs (narration)
 * Sem pessoas — foco em efeitos visuais, rotação, cenários
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, 
  Sparkles,
  Package,
  Loader2,
  HelpCircle,
  Shield,
  CheckCircle2,
  AlertCircle,
  Play,
  Clapperboard,
} from 'lucide-react';
import { useVideoPresets, useVideoJobs, useCreateVideoJob } from '@/hooks/useVideoCreatives';
import { useProductsWithImages } from '@/hooks/useProducts';
import { VideoJobsList } from '../VideoJobsList';

// Nichos de produto
const PRODUCT_NICHES = [
  { value: 'packaged_goods', label: 'Embalados (Cosméticos, Food, Bebidas)', icon: '📦' },
  { value: 'electronics', label: 'Eletrônicos (Tech, Gadgets)', icon: '🔌' },
  { value: 'fashion', label: 'Moda (Roupas, Acessórios)', icon: '👗' },
  { value: 'food', label: 'Alimentos (Fresh, Prepared)', icon: '🍕' },
  { value: 'home', label: 'Casa & Decoração', icon: '🏠' },
];

type DurationSeconds = 6 | 10 | 15;
const DURATION_OPTIONS: { value: DurationSeconds; label: string }[] = [
  { value: 6, label: '6 segundos (Story)' },
  { value: 10, label: '10 segundos (Padrão)' },
  { value: 15, label: '15 segundos (Extended)' },
];

type AspectRatioOption = '16:9' | '9:16' | '1:1';
const ASPECT_RATIO_OPTIONS: { value: AspectRatioOption; label: string }[] = [
  { value: '9:16', label: '9:16 (Vertical/Reels)' },
  { value: '16:9', label: '16:9 (Horizontal)' },
  { value: '1:1', label: '1:1 (Quadrado)' },
];

export function ProductVideoForm() {
  // Produto OBRIGATÓRIO
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Configurações de preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [niche, setNiche] = useState<string>('packaged_goods');
  const [duration, setDuration] = useState<DurationSeconds>(10);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('9:16');
  
  // Controles de qualidade
  const [variations, setVariations] = useState<number[]>([4]);
  const [enableQA, setEnableQA] = useState(true);
  const [enableFallback, setEnableFallback] = useState(true);
  
  // Instruções adicionais
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  // Hooks
  const { products, isLoading: productsLoading } = useProductsWithImages();
  const { data: presets, isLoading: presetsLoading } = useVideoPresets(niche);
  const { data: jobs, isLoading: jobsLoading } = useVideoJobs('product_video');
  const createJob = useCreateVideoJob();

  // Produto selecionado
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const productImageUrl = selectedProduct?.primary_image_url || 
                          (selectedProduct as any)?.images?.[0] || 
                          (selectedProduct as any)?.thumbnail;

  // Preset selecionado
  const selectedPreset = presets?.find(p => p.id === selectedPresetId);

  // Validação
  const isValid = !!selectedProductId && !!selectedPresetId;

  // Custo estimado
  const baseCostPerSecond = 0.05;
  const estimatedCost = (duration * baseCostPerSecond * variations[0] * 1.5 * 5.5).toFixed(2);

  const handleGenerate = async () => {
    if (!isValid) return;
    
    createJob.mutate({
      product_id: selectedProductId,
      video_type: 'product_video',
      preset_id: selectedPresetId,
      duration_seconds: duration,
      aspect_ratio: aspectRatio,
      n_variations: variations[0],
      fidelity_mode: enableQA,
      hard_fidelity: enableFallback,
      user_prompt: additionalPrompt || undefined,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Vídeo de Produto
          </CardTitle>
          <CardDescription>
            Vídeos promocionais com efeitos visuais (sem pessoas)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PRODUTO DO CATÁLOGO */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
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
                    Rótulo será preservado no vídeo
                  </p>
                </div>
              </div>
            )}
            
            {!selectedProductId && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Selecione um produto do catálogo
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Nicho do Produto */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clapperboard className="h-4 w-4" />
              Categoria do Produto
            </Label>
            <Select value={niche} onValueChange={(v) => {
              setNiche(v);
              setSelectedPresetId('');
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_NICHES.map(n => (
                  <SelectItem key={n.value} value={n.value}>
                    <div className="flex items-center gap-2">
                      <span>{n.icon}</span>
                      <span>{n.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preset de Vídeo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Estilo de Vídeo *
              <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
            </Label>
            <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
              <SelectTrigger className={!selectedPresetId ? 'border-amber-500' : ''}>
                <SelectValue placeholder="Selecione um estilo..." />
              </SelectTrigger>
              <SelectContent>
                {presetsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Carregando presets...
                  </div>
                ) : !presets?.length ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nenhum preset para esta categoria
                  </div>
                ) : (
                  presets.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{preset.display_name}</span>
                        {preset.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {preset.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Duração e Aspect Ratio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v) as DurationSeconds)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(d => (
                    <SelectItem key={d.value} value={d.value.toString()}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proporção</Label>
              <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatioOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIO_OPTIONS.map(a => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Controles de QA */}
          <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Controle de Qualidade</Label>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm cursor-pointer" htmlFor="enable-qa">
                    QA Automático
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="text-xs">
                        Avalia fidelidade do rótulo, similaridade e estabilidade temporal.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  id="enable-qa"
                  checked={enableQA}
                  onCheckedChange={setEnableQA}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm cursor-pointer" htmlFor="enable-fallback">
                    Fallback Inteligente
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="text-xs">
                        Se falhar no QA, usa composição com produto real. Garante 100% fidelidade.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  id="enable-fallback"
                  checked={enableFallback}
                  onCheckedChange={setEnableFallback}
                  disabled={!enableQA}
                />
              </div>
              
              {enableQA && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Vídeos avaliados por similaridade, OCR e estabilidade
                </p>
              )}
            </div>
          </div>

          {/* Variações */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Número de Variações</Label>
              <Badge variant="outline">{variations[0]}</Badge>
            </div>
            <Slider
              value={variations}
              onValueChange={setVariations}
              min={1}
              max={4}
              step={1}
              className="w-full"
            />
          </div>

          {/* Prompt adicional */}
          <div className="space-y-2">
            <Label>Instruções Adicionais (opcional)</Label>
            <Textarea
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="Descreva detalhes específicos para o vídeo..."
              rows={2}
            />
          </div>

          {/* Custo estimado */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm">Custo estimado:</span>
            <Badge variant="secondary">~R$ {estimatedCost}</Badge>
          </div>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!isValid || createJob.isPending}
            onClick={handleGenerate}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {createJob.isPending ? 'Gerando...' : 'Gerar Vídeo'}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Acompanhe o status dos seus vídeos</CardDescription>
        </CardHeader>
        <CardContent>
          <VideoJobsList 
            jobs={jobs || []} 
            isLoading={jobsLoading} 
          />
        </CardContent>
      </Card>
    </div>
  );
}
