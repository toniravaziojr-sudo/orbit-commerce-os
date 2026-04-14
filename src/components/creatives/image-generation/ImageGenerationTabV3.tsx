/**
 * Tab de Geração de Imagens — Prompt-Only (v10.0)
 * 
 * Alinhado ao motor único visual-engine.ts.
 * Sem seletores de estilo/provedor — tudo dirigido pelo prompt.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Image as ImageIcon, 
  Loader2,
  Package,
  Sparkles,
} from 'lucide-react';
import { useProductsWithImages } from '@/hooks/useProducts';
import { useCreateCreativeJob, useCreativeJobs } from '@/hooks/useCreatives';
import { CreativeJobsList } from '../CreativeJobsList';
import { IMAGE_FORMAT_CONFIG, type ImageFormat } from './types';

export function ImageGenerationTabV3() {
  const [productId, setProductId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<ImageFormat>('1:1');
  const [variations, setVariations] = useState<number[]>([2]);

  const { products, isLoading: productsLoading } = useProductsWithImages();
  const { data: jobs } = useCreativeJobs('product_image');
  const createJob = useCreateCreativeJob();

  const selectedProduct = products.find(p => p.id === productId);
  const productImageUrl = selectedProduct?.primary_image_url || 
                          (selectedProduct as any)?.images?.[0] || 
                          (selectedProduct as any)?.thumbnail;

  const isValid = !!productId;

  const handleGenerate = async () => {
    if (!isValid) return;

    createJob.mutate({
      type: 'product_image',
      prompt,
      product_id: productId,
      product_name: selectedProduct?.name,
      product_image_url: productImageUrl,
      settings: {
        format,
        variations: variations[0],
        enable_qa: true,
        enable_fallback: true,
        label_lock: true,
        pipeline_version: '10.0',
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
          </CardTitle>
          <CardDescription>
            Descreva o que deseja e o sistema escolhe o melhor modelo automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          {/* DIREÇÕES CRIATIVAS */}
          <div className="space-y-2">
            <Label>Direções Criativas</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva o que você quer ver na imagem... Ex: Produto em cenário de praia, pessoa segurando com sorriso natural, fundo premium com iluminação dourada..."
              rows={3}
              disabled={createJob.isPending}
            />
            <p className="text-xs text-muted-foreground">
              O sistema escolhe automaticamente o melhor modelo de IA com base na sua descrição.
            </p>
          </div>

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
