/**
 * VideoGeneratorForm — Formulário prompt-first de geração de vídeo
 * O motor decide automaticamente o melhor modelo pelo prompt.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Package, AlertCircle, Sparkles } from 'lucide-react';
import { useCreateVideoJob, useVideoJobs } from '@/hooks/useVideoCreatives';
import { useProductsWithImages } from '@/hooks/useProducts';
import { VideoJobsList } from '../VideoJobsList';

export function VideoGeneratorForm() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [duration, setDuration] = useState<'5' | '10'>('5');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [prompt, setPrompt] = useState('');

  const { products, isLoading: loadingProducts } = useProductsWithImages();
  const { data: jobs, isLoading: loadingJobs } = useVideoJobs();
  const createJob = useCreateVideoJob();

  const handleGenerate = () => {
    if (!selectedProduct) return;
    createJob.mutate({
      product_id: selectedProduct,
      video_type: 'product_video',
      aspect_ratio: aspectRatio,
      duration_seconds: parseInt(duration) as 6 | 10,
      user_prompt: prompt || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Produto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Produto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger>
              <SelectValue placeholder={loadingProducts ? "Carregando..." : "Selecione o produto"} />
            </SelectTrigger>
            <SelectContent>
              {(products || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    {p.image_url && <img src={p.image_url} alt="" className="h-6 w-6 rounded object-cover" />}
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Duração</Label>
              <Select value={duration} onValueChange={(v) => setDuration(v as '5' | '10')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 segundos</SelectItem>
                  <SelectItem value="10">10 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Formato</Label>
              <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Stories/Reels)</SelectItem>
                  <SelectItem value="16:9">16:9 (YouTube)</SelectItem>
                  <SelectItem value="1:1">1:1 (Feed)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Direções Criativas</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva o vídeo desejado... Ex: Produto girando suavemente com iluminação premium, pessoa segurando o produto, narração sobre benefícios..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              O sistema escolhe automaticamente o melhor modelo de IA com base na sua descrição.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gerar */}
      {!selectedProduct && (
        <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Selecione um produto para gerar o vídeo.</AlertDescription></Alert>
      )}

      <Button onClick={handleGenerate} disabled={!selectedProduct || createJob.isPending} className="w-full" size="lg">
        {createJob.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Iniciando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Vídeo</>}
      </Button>

      {/* Jobs */}
      <VideoJobsList jobs={jobs || []} isLoading={loadingJobs} />
    </div>
  );
}
