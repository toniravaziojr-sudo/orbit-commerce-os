/**
 * Product Video Tab — Vídeos de Produto com Pipeline v2.0
 * 
 * NOVO PIPELINE: OpenAI/Sora via Lovable AI Gateway
 * - Multi-nicho (Packaged Goods, Electronics, Fashion, Food, etc.)
 * - QA automático com scores (Similarity, OCR, Temporal Stability)
 * - Fallback por composição (100% fidelidade garantida)
 * 
 * SUBSTITUI: Pipeline anterior baseado em fal.ai/Kling
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
import { CustomPipelineInfo } from './AIPipelineInfo';
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
  Lightbulb,
  Camera,
  FileText,
} from 'lucide-react';
import { useVideoPresets, useVideoJobs, useCreateVideoJob } from '@/hooks/useVideoCreatives';
import { useProductsWithImages } from '@/hooks/useProducts';
import { VideoJobsList } from './VideoJobsList';

// Nichos de produto (alinhado com product_category_profiles do banco)
const PRODUCT_NICHES = [
  { value: 'packaged_goods', label: 'Embalados (Cosméticos, Food, Bebidas)', icon: '📦' },
  { value: 'electronics', label: 'Eletrônicos (Tech, Gadgets)', icon: '🔌' },
  { value: 'fashion', label: 'Moda (Roupas, Acessórios)', icon: '👗' },
  { value: 'food', label: 'Alimentos (Fresh, Prepared)', icon: '🍕' },
  { value: 'home', label: 'Casa & Decoração', icon: '🏠' },
  { value: 'automotive', label: 'Automotivo', icon: '🚗' },
  { value: 'digital', label: 'Digital (Apps, Software)', icon: '💻' },
];

// Durações disponíveis (tipo literal)
type DurationSeconds = 6 | 10 | 15;
const DURATION_OPTIONS: { value: DurationSeconds; label: string }[] = [
  { value: 6, label: '6 segundos (Story/Reel)' },
  { value: 10, label: '10 segundos (Padrão)' },
  { value: 15, label: '15 segundos (Extended)' },
];

// Aspect ratios (tipo literal)
type AspectRatioOption = '16:9' | '9:16' | '1:1';
const ASPECT_RATIO_OPTIONS: { value: AspectRatioOption; label: string }[] = [
  { value: '16:9', label: '16:9 (Horizontal)' },
  { value: '9:16', label: '9:16 (Vertical/Reels)' },
  { value: '1:1', label: '1:1 (Quadrado)' },
];

export function ProductVideoTab() {
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
  const { data: jobs, isLoading: jobsLoading } = useVideoJobs();
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

  // Custo estimado (baseado em duration e variations)
  const baseCostPerSecond = 0.05; // USD por segundo
  const estimatedCost = (duration * baseCostPerSecond * variations[0] * 1.5 * 5.5).toFixed(2); // Com markup e conversão BRL

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
            Novo Vídeo de Produto
          </CardTitle>
          <CardDescription>
            Pipeline v2.0 — Multi-nicho com QA automático e fallback inteligente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PRODUTO DO CATÁLOGO - OBRIGATÓRIO */}
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
                    Produto e rótulo serão preservados no vídeo
                  </p>
                </div>
              </div>
            )}
            
            {!selectedProductId && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Selecione um produto do catálogo para usar como referência
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
              setSelectedPresetId(''); // Reset preset quando muda nicho
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
            <p className="text-xs text-muted-foreground">
              Presets e regras de QA são otimizados por categoria
            </p>
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
            
            {/* Preview do preset selecionado */}
            {selectedPreset && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {selectedPreset.display_name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {selectedPreset.preset_key}
                  </span>
                </div>
                {selectedPreset.description && (
                  <p className="text-xs text-muted-foreground">
                    {selectedPreset.description}
                  </p>
                )}
                
                {/* Categorias aplicáveis */}
                {selectedPreset.category_applicability?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedPreset.category_applicability.slice(0, 3).map((cat, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px]">
                        {cat}
                      </Badge>
                    ))}
                    {selectedPreset.category_applicability.length > 3 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{selectedPreset.category_applicability.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
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

          {/* Controles de Pipeline (QA e Fallback) */}
          <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Controle de Qualidade</Label>
            </div>
            
            <div className="space-y-3">
              {/* QA Automático */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm cursor-pointer" htmlFor="enable-qa-video">
                    QA Automático
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="text-xs">
                        Avalia cada vídeo gerado quanto à fidelidade do rótulo, similaridade 
                        e estabilidade temporal. Vídeos reprovados são descartados.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  id="enable-qa-video"
                  checked={enableQA}
                  onCheckedChange={setEnableQA}
                />
              </div>
              
              {/* Fallback por Composição */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm cursor-pointer" htmlFor="enable-fallback-video">
                    Fallback Inteligente
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="text-xs">
                        Se todas as variações falharem no QA, gera automaticamente um vídeo 
                        composto com o produto real sobre a cena animada. Garante 100% de fidelidade.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  id="enable-fallback-video"
                  checked={enableFallback}
                  onCheckedChange={setEnableFallback}
                  disabled={!enableQA}
                />
              </div>
              
              {enableQA && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Vídeos avaliados por similaridade, OCR e estabilidade temporal
                </p>
              )}
            </div>
          </div>

          {/* Número de Variações */}
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mínimo: 1</span>
              <span>Recomendado: 4 (maior chance de sucesso)</span>
            </div>
          </div>

          {/* Instruções Adicionais */}
          <div className="space-y-2">
            <Label>Instruções Adicionais (opcional)</Label>
            <Textarea 
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="Ex: 'movimento mais lento', 'destaque no rótulo', 'reflexos dourados'..."
              rows={3}
            />
          </div>

          {/* Custo Estimado */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Custo estimado:</span>
              <span className="font-medium">~R$ {estimatedCost}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {variations[0]} variações × {duration}s × R$ 0,25/s + QA
            </p>
          </div>

          {/* Pipeline Info - Apenas para tenants especiais */}
          <CustomPipelineInfo 
            label="Pipeline v2.0:" 
            description="Preprocess → Rewrite → Generate → QA → Retry → Fallback"
          >
            <Badge variant="default" className="text-xs bg-primary/90">
              OpenAI Sora
            </Badge>
            {enableQA && (
              <Badge variant="outline" className="text-xs">QA Vision</Badge>
            )}
            {enableFallback && (
              <Badge variant="outline" className="text-xs">Composição</Badge>
            )}
          </CustomPipelineInfo>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!isValid || createJob.isPending}
            onClick={handleGenerate}
          >
            {createJob.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando job...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar {variations[0]} {variations[0] === 1 ? 'Vídeo' : 'Vídeos'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Pipeline v2.0 com scores de QA</CardDescription>
        </CardHeader>
        <CardContent>
          <VideoJobsList jobs={jobs || []} isLoading={jobsLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
