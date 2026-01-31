/**
 * Product Image Tab — Imagens de pessoas segurando o produto
 * 
 * Pipeline: OpenAI GPT Image 1.5 Edit
 * 
 * ENUMS CORRIGIDOS conforme schema:
 * - size: 1024x1024 | 1024x1536 | 1536x1024 | auto
 * - quality: low | medium | high
 * - background: auto | opaque | transparent
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AIPipelineInfo } from './AIPipelineInfo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Image as ImageIcon, 
  Sparkles,
  Package,
  Loader2,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { useProductsWithImages } from '@/hooks/useProducts';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

// Enums corretos conforme schema GPT Image 1.5 Edit
const GPT_IMAGE_SIZES = [
  { value: '1024x1024', label: '1024x1024 (Quadrado)' },
  { value: '1024x1536', label: '1024x1536 (Vertical)' },
  { value: '1536x1024', label: '1536x1024 (Horizontal)' },
  { value: 'auto', label: 'Auto' },
] as const;

const GPT_IMAGE_QUALITY = [
  { value: 'low', label: 'Baixa (Rápido)' },
  { value: 'medium', label: 'Média (Balanceado)' },
  { value: 'high', label: 'Alta (Melhor qualidade)' },
] as const;

const GPT_IMAGE_BACKGROUND = [
  { value: 'auto', label: 'Auto' },
  { value: 'opaque', label: 'Opaco' },
  { value: 'transparent', label: 'Transparente' },
] as const;

const INPUT_FIDELITY = [
  { value: 'low', label: 'Baixa (Mais liberdade criativa)' },
  { value: 'medium', label: 'Média (Balanceado)' },
  { value: 'high', label: 'Alta (Preservar rótulo exatamente)' },
] as const;

export function ProductImageTab() {
  // Produto OBRIGATÓRIO
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Cenário e personagem
  const [scene, setScene] = useState<string>('bathroom');
  const [gender, setGender] = useState<string>('any');
  const [ageRange, setAgeRange] = useState<string>('middle');
  const [pose, setPose] = useState<string>('holding');
  
  // Configurações de saída (enums corretos)
  const [size, setSize] = useState<string>('1024x1024');
  const [quality, setQuality] = useState<string>('high');
  const [background, setBackground] = useState<string>('auto');
  const [inputFidelity, setInputFidelity] = useState<string>('high');
  const [variations, setVariations] = useState<number[]>([2]);
  
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
        size,
        quality,
        background,
        input_fidelity: inputFidelity,
        variations: variations[0],
      },
    });
  };

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
            Pessoas reais segurando o produto — ultra realismo com fidelidade de rótulo
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
                <SelectItem value="bathroom">Banheiro (luz natural)</SelectItem>
                <SelectItem value="bedroom">Quarto (ambiente relaxante)</SelectItem>
                <SelectItem value="gym">Academia (energia/fitness)</SelectItem>
                <SelectItem value="outdoor">Ar Livre (luz natural intensa)</SelectItem>
                <SelectItem value="office">Escritório (profissional)</SelectItem>
                <SelectItem value="kitchen">Cozinha (lifestyle)</SelectItem>
                <SelectItem value="studio">Estúdio (fundo neutro)</SelectItem>
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

          {/* Configurações de Saída (enums corretos) */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <Label className="text-sm font-medium">Configurações de Saída</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tamanho</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GPT_IMAGE_SIZES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Qualidade</Label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GPT_IMAGE_QUALITY.map(q => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Fundo</Label>
                <Select value={background} onValueChange={setBackground}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GPT_IMAGE_BACKGROUND.map(b => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
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
                    {INPUT_FIDELITY.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Número de Variações */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Número de Variações</Label>
              <span className="text-sm font-medium">{variations[0]}</span>
            </div>
            <Slider
              value={variations}
              onValueChange={setVariations}
              min={1}
              max={4}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Custo estimado: ~R$ {(variations[0] * 0.02 * 5).toFixed(2)} (R$ 0,10/imagem)
            </p>
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

          {/* Modelo - Apenas para tenants especiais */}
          <AIPipelineInfo 
            label="Modelo utilizado:" 
            models={models} 
            variant="default"
            description="Mantém fidelidade máxima ao rótulo e cores do produto original"
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
          <CardDescription>Acompanhe o status dos seus criativos</CardDescription>
        </CardHeader>
        <CardContent>
          <CreativeJobsList jobs={jobs || []} isLoading={isLoading} type="product_image" />
        </CardContent>
      </Card>
    </div>
  );
}
