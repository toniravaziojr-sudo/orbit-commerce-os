/**
 * Nova Tab de Geração de Imagens v3.0
 * 
 * Features:
 * - Dual Provider (OpenAI + Gemini)
 * - 3 Estilos de Geração
 * - Campos dinâmicos por estilo
 * - Scoring por realismo
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Image as ImageIcon, 
  Loader2,
  Package,
  Sparkles,
} from 'lucide-react';
import { useProductsWithImages } from '@/hooks/useProducts';
import { useCreateCreativeJob, useCreativeJobs } from '@/hooks/useCreatives';
import { CreativeJobsList } from '../CreativeJobsList';
import { ProviderSelector } from './ProviderSelector';
import { StyleSelector } from './StyleSelector';
import { StyleFields } from './StyleFields';
import { CostEstimate } from './CostEstimate';
import { 
  ImageProvider, 
  ImageStyle, 
  ImageFormat,
  ProductNaturalSettings,
  PersonInteractingSettings,
  PromotionalSettings,
  IMAGE_FORMAT_CONFIG,
  DEFAULT_IMAGE_FORM,
} from './types';

export function ImageGenerationTabV3() {
  // Provedores (multi-select)
  const [providers, setProviders] = useState<ImageProvider[]>(DEFAULT_IMAGE_FORM.providers);
  
  // Estilo (single-select)
  const [style, setStyle] = useState<ImageStyle>(DEFAULT_IMAGE_FORM.style);
  
  // Campos comuns
  const [productId, setProductId] = useState('');
  const [contextBrief, setContextBrief] = useState('');
  const [format, setFormat] = useState<ImageFormat>('1:1');
  const [variations, setVariations] = useState<number[]>([2]);
  
  // Campos por estilo
  const [productNatural, setProductNatural] = useState<ProductNaturalSettings>({
    environment: 'studio',
    lighting: 'natural',
    mood: 'clean',
  });
  const [personInteracting, setPersonInteracting] = useState<PersonInteractingSettings>({
    action: 'holding',
    personProfile: '',
    tone: 'lifestyle',
  });
  const [promotional, setPromotional] = useState<PromotionalSettings>({
    effectsIntensity: 'medium',
    visualElements: [],
    overlayText: '',
  });

  // Hooks
  const { products, isLoading: productsLoading } = useProductsWithImages();
  const { data: jobs } = useCreativeJobs('product_image');
  const createJob = useCreateCreativeJob();

  // Produto selecionado
  const selectedProduct = products.find(p => p.id === productId);
  const productImageUrl = selectedProduct?.primary_image_url || 
                          (selectedProduct as any)?.images?.[0] || 
                          (selectedProduct as any)?.thumbnail;

  // Validação
  const isValid = productId && providers.length > 0;

  const handleGenerate = async () => {
    if (!isValid) return;

    // Montar settings baseado no estilo
    let styleSettings = {};
    if (style === 'product_natural') {
      styleSettings = { style_config: productNatural };
    } else if (style === 'person_interacting') {
      styleSettings = { style_config: personInteracting };
    } else if (style === 'promotional') {
      styleSettings = { style_config: promotional };
    }

    createJob.mutate({
      type: 'product_image',
      prompt: contextBrief,
      product_id: productId,
      product_name: selectedProduct?.name,
      product_image_url: productImageUrl,
      settings: {
        // Nova config v3.0
        providers,
        generation_style: style,
        format,
        variations: variations[0],
        ...styleSettings,
        // Compatibilidade com v2.x
        enable_qa: true,
        enable_fallback: true,
        label_lock: true,
        pipeline_version: '3.0.0',
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
            Gerar Imagens com IA
            <Badge variant="secondary" className="text-[10px]">v3.0</Badge>
          </CardTitle>
          <CardDescription>
            Escolha provedores, estilo e gere imagens profissionais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PROVEDORES */}
          <ProviderSelector
            value={providers}
            onChange={setProviders}
            disabled={createJob.isPending}
          />

          <Separator />

          {/* ESTILO */}
          <StyleSelector
            value={style}
            onChange={setStyle}
            disabled={createJob.isPending}
          />

          <Separator />

          {/* PRODUTO */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produto *
            </Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className={!productId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione um produto..." />
              </SelectTrigger>
              <SelectContent>
                {productsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Carregando...
                  </div>
                ) : products.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nenhum produto encontrado
                  </div>
                ) : (
                  products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* Preview do produto */}
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
                    Rótulo será preservado fielmente
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CONTEXTO/BRIEF */}
          <div className="space-y-2">
            <Label>Contexto/Brief (opcional)</Label>
            <Textarea
              value={contextBrief}
              onChange={(e) => setContextBrief(e.target.value)}
              placeholder="Descreva o que você quer ver na imagem..."
              rows={2}
              disabled={createJob.isPending}
            />
          </div>

          {/* CAMPOS DINÂMICOS POR ESTILO */}
          <StyleFields
            style={style}
            productNatural={productNatural}
            personInteracting={personInteracting}
            promotional={promotional}
            onProductNaturalChange={setProductNatural}
            onPersonInteractingChange={setPersonInteracting}
            onPromotionalChange={setPromotional}
            disabled={createJob.isPending}
          />

          {/* FORMATO E VARIAÇÕES */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ImageFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IMAGE_FORMAT_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Variações: {variations[0]}</Label>
              <Slider
                value={variations}
                onValueChange={setVariations}
                min={1}
                max={4}
                step={1}
                disabled={createJob.isPending}
              />
            </div>
          </div>

          {/* ESTIMATIVA DE CUSTO */}
          <CostEstimate
            providers={providers}
            variations={variations[0]}
          />

          {/* BOTÃO GERAR */}
          <Button
            onClick={handleGenerate}
            disabled={!isValid || createJob.isPending}
            className="w-full"
            size="lg"
          >
            {createJob.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar {variations[0]} {variations[0] === 1 ? 'Imagem' : 'Imagens'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Jobs/Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>
            Acompanhe o progresso e visualize resultados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreativeJobsList jobs={jobs || []} isLoading={false} type="product_image" />
        </CardContent>
      </Card>
    </div>
  );
}
