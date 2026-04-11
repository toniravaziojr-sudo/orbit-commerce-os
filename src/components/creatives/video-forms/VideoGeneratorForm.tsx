/**
 * VideoGeneratorForm — Formulário unificado de geração de vídeo via fal.ai
 * Tiers: Premium (Kling v3) | Áudio Nativo (Veo 3.1) | Econômico (Wan 2.6)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Package, AlertCircle, Sparkles, Crown, Zap, Volume2 } from 'lucide-react';
import { useCreateVideoJob, useVideoJobs } from '@/hooks/useVideoCreatives';
import { useProductsWithImages } from '@/hooks/useProducts';
import { VideoJobsList } from '../VideoJobsList';
import { useIsSpecialTenant } from '@/hooks/useIsSpecialTenant';

type VideoTier = 'premium' | 'audio_native' | 'economic';

interface TierOption {
  id: VideoTier;
  label: string;
  desc: string;
  descPublic: string;
  icon: React.ElementType;
  badge?: string;
  cost: string;
}

const TIER_OPTIONS: TierOption[] = [
  { id: 'premium', label: 'Premium', desc: 'Kling v3 Pro — Melhor fidelidade de produto', descPublic: 'Melhor fidelidade de produto', icon: Crown, badge: 'Recomendado', cost: '~R$3,00/5s' },
  { id: 'audio_native', label: 'Com Áudio Nativo', desc: 'Veo 3.1 — Qualidade cinema com áudio gerado', descPublic: 'Qualidade cinema com áudio gerado', icon: Volume2, cost: '~R$5,50/8s' },
  { id: 'economic', label: 'Econômico', desc: 'Wan 2.6 — Custo reduzido para testes', descPublic: 'Custo reduzido para testes', icon: Zap, cost: '~R$1,50/5s' },
];

export function VideoGeneratorForm() {
  const { isSpecialTenant: isSpecial } = useIsSpecialTenant();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [tier, setTier] = useState<VideoTier>('premium');
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
      // @ts-ignore - tier is passed as extra field
      tier,
    });
  };

  const selectedTier = TIER_OPTIONS.find(t => t.id === tier)!;

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

      {/* Tier */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Qualidade do Vídeo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={tier} onValueChange={(v) => setTier(v as VideoTier)} className="space-y-3">
            {TIER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${tier === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <RadioGroupItem value={opt.id} className="mt-0.5" />
                  <Icon className="h-4 w-4 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{opt.label}</span>
                      {opt.badge && <Badge variant="secondary" className="text-[10px]">{opt.badge}</Badge>}
                      <span className="text-[10px] text-muted-foreground ml-auto">{opt.cost}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{isSpecial ? opt.desc : opt.descPublic}</p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
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
            <Label className="text-sm">Prompt (opcional)</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva o vídeo desejado... Ex: Produto girando suavemente com iluminação premium"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gerar */}
      {!selectedProduct && (
        <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Selecione um produto para gerar o vídeo.</AlertDescription></Alert>
      )}

      <Button onClick={handleGenerate} disabled={!selectedProduct || createJob.isPending} className="w-full" size="lg">
        {createJob.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Iniciando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Vídeo ({selectedTier.label})</>}
      </Button>

      {/* Jobs */}
      <VideoJobsList jobs={jobs || []} isLoading={loadingJobs} />
    </div>
  );
}
