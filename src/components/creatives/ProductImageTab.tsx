/**
 * Product Image Tab — Imagens de pessoas segurando o produto
 * 
 * Pipeline v2.0: Lovable AI Gateway (Gemini Image)
 * 
 * PIPELINE COMPLETA:
 * 1. CUTOUT: Gerar recorte do produto
 * 2. GENERATION: Gerar N variações
 * 3. QA: Avaliar fidelidade (similarity + label)
 * 4. FALLBACK: Composição se QA falhar
 * 5. SELECTION: Escolher melhor variação
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AIPipelineInfo } from './AIPipelineInfo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Image as ImageIcon, 
  Sparkles,
  Package,
  Loader2,
  ShoppingBag,
  AlertCircle,
  Shield,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { useProductsWithImages } from '@/hooks/useProducts';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

const SCENE_OPTIONS = [
  { value: 'bathroom', label: 'Banheiro (luz natural)' },
  { value: 'lavabo', label: 'Lavabo (premium)' },
  { value: 'bedroom', label: 'Quarto (relaxante)' },
  { value: 'gym', label: 'Academia (fitness)' },
  { value: 'outdoor', label: 'Ar Livre (natural)' },
  { value: 'office', label: 'Escritório (profissional)' },
  { value: 'kitchen', label: 'Cozinha (lifestyle)' },
  { value: 'studio', label: 'Estúdio (fundo neutro)' },
];

const QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standard (Rápido)' },
  { value: 'high', label: 'Alta (Melhor qualidade)' },
];

const FIDELITY_OPTIONS = [
  { value: 'low', label: 'Baixa — Mais liberdade criativa' },
  { value: 'medium', label: 'Média — Balanceado' },
  { value: 'high', label: 'Alta — Preservar rótulo exatamente' },
];

export function ProductImageTab() {
  // Produto OBRIGATÓRIO
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Cenário e personagem
  const [scene, setScene] = useState<string>('bathroom');
  const [gender, setGender] = useState<string>('any');
  const [ageRange, setAgeRange] = useState<string>('middle');
  const [pose, setPose] = useState<string>('holding');
  
  // Configurações de pipeline
  const [quality, setQuality] = useState<string>('high');
  const [inputFidelity, setInputFidelity] = useState<string>('high');
  const [variations, setVariations] = useState<number[]>([4]);
  
  // Controles de QA e Fallback (novos!)
  const [enableQA, setEnableQA] = useState(true);
  const [enableFallback, setEnableFallback] = useState(true);
  
  // Instruções adicionais
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  // Hooks
  const { products, isLoading: productsLoading } = useProductsWithImages();
  const { data: jobs, isLoading } = useCreativeJobs('product_image');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.product_image;
  
  // Produto selecionado
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const productImageUrl = selectedProduct?.primary_image_url || 
                          (selectedProduct as any)?.images?.[0] || 
                          (selectedProduct as any)?.thumbnail;

  // Validação
  const isValid = !!selectedProductId;

  const handleGenerate = async () => {
    if (!isValid) return;
    
    createJob.mutate({
      type: 'product_image',
      prompt: additionalPrompt || 'Professional product photography',
      product_id: selectedProductId,
      product_name: selectedProduct?.name,
      product_image_url: productImageUrl,
      settings: {
        scene,
        gender,
        age_range: ageRange,
        pose,
        quality,
        input_fidelity: inputFidelity,
        variations: variations[0],
        enable_qa: enableQA,
        enable_fallback: enableFallback,
      },
    });
  };

  // Custo estimado
  const baseCost = variations[0] * 0.10; // R$ 0,10/imagem
  const qaCost = enableQA ? variations[0] * 0.05 : 0; // R$ 0,05/QA
  const fallbackCost = enableFallback ? 0.20 : 0; // Custo potencial do fallback
  const estimatedCost = baseCost + qaCost + (enableFallback ? 0.10 : 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Nova Imagem de Produto
          </CardTitle>
          <CardDescription>
            Pipeline v2.0 com QA automático e fallback inteligente
          </CardDescription>
        </CardHeader>
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
                    Rótulo e cores serão preservados
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

          {/* Cenário */}
          <div className="space-y-2">
            <Label>Cenário</Label>
            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENE_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Perfil da Pessoa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Feminino</SelectItem>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="any">Qualquer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Faixa Etária</Label>
              <Select value={ageRange} onValueChange={setAgeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="young">Jovem (20-35)</SelectItem>
                  <SelectItem value="middle">Meia Idade (35-50)</SelectItem>
                  <SelectItem value="mature">Maduro (50+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pose */}
          <div className="space-y-2">
            <Label>Pose/Interação</Label>
            <Select value={pose} onValueChange={setPose}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="holding">Segurando na mão</SelectItem>
                <SelectItem value="using">Usando o produto</SelectItem>
                <SelectItem value="displaying">Mostrando para câmera</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Configurações de Qualidade */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <Label className="text-sm font-medium">Qualidade e Fidelidade</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Qualidade</Label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map(q => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fidelidade do Rótulo</Label>
                <Select value={inputFidelity} onValueChange={setInputFidelity}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIDELITY_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <Label className="text-sm cursor-pointer" htmlFor="enable-qa">
                    QA Automático
                  </Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="text-xs">
                        Avalia cada imagem gerada quanto à fidelidade do rótulo e similaridade com o produto original. 
                        Imagens reprovadas são descartadas automaticamente.
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
              
              {/* Fallback por Composição */}
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
                        Se todas as variações falharem no QA, gera automaticamente uma composição 
                        com o produto real sobreposto na cena. Garante entrega com 100% de fidelidade.
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
                  Imagens serão avaliadas por similaridade e legibilidade do rótulo
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

          {/* Brief Adicional */}
          <div className="space-y-2">
            <Label>Instruções Adicionais (opcional)</Label>
            <Textarea 
              value={additionalPrompt}
              onChange={(e) => setAdditionalPrompt(e.target.value)}
              placeholder="Ex: 'Pessoa sorrindo, luz suave vindo da janela, estilo clean e moderno...'"
              rows={3}
            />
          </div>

          {/* Custo Estimado */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Custo estimado:</span>
              <span className="font-medium">~R$ {estimatedCost.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {variations[0]} variações × R$ 0,10 + QA{!enableQA && ' (desativado)'}
            </p>
          </div>

          {/* Modelo - Apenas para tenants especiais */}
          <AIPipelineInfo 
            label="Pipeline v2.0:" 
            models={models} 
            variant="default"
            description="Cutout → Geração → QA → Fallback → Seleção automática"
          />

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!isValid || createJob.isPending}
            onClick={handleGenerate}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {createJob.isPending ? 'Gerando...' : `Gerar ${variations[0]} ${variations[0] === 1 ? 'Imagem' : 'Imagens'}`}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Pipeline v2.0 com score de QA</CardDescription>
        </CardHeader>
        <CardContent>
          <CreativeJobsList jobs={jobs || []} isLoading={isLoading} type="product_image" />
        </CardContent>
      </Card>
    </div>
  );
}
