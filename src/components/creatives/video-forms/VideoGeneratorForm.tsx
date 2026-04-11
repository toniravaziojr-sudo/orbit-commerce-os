/**
 * VideoGeneratorForm — Formulário unificado para geração de vídeos via fal.ai
 * 
 * Tiers:
 * - Premium (Kling v3 Pro I2V): Melhor fidelidade de produto
 * - Com áudio nativo (Veo 3.1): Qualidade cinema + áudio
 * - Econômico (Wan 2.6 I2V): Custo reduzido para escala
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Video, 
  Sparkles, 
  Clock, 
  Ratio, 
  Mic, 
  Loader2, 
  Crown, 
  Zap, 
  DollarSign,
  Info,
} from 'lucide-react';
import { useCreateVideoJob } from '@/hooks/useVideoCreatives';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// ==================== TYPES ====================

type VideoTier = 'premium' | 'audio_native' | 'economic';

interface TierOption {
  id: VideoTier;
  label: string;
  description: string;
  icon: React.ElementType;
  models: string;
  costEstimate: string;
  badge?: string;
}

const VIDEO_TIERS: TierOption[] = [
  {
    id: 'premium',
    label: 'Premium',
    description: 'Melhor fidelidade de produto. Ideal para e-commerce.',
    icon: Crown,
    models: 'Kling v3 Pro I2V',
    costEstimate: '~$0.42/5s',
    badge: 'Recomendado',
  },
  {
    id: 'audio_native',
    label: 'Com Áudio Nativo',
    description: 'Qualidade cinema com áudio gerado nativamente.',
    icon: Mic,
    models: 'Veo 3.1',
    costEstimate: '~$0.75/5s',
  },
  {
    id: 'economic',
    label: 'Econômico',
    description: 'Custo reduzido. Ideal para testes A/B e escala.',
    icon: DollarSign,
    models: 'Wan 2.6 I2V',
    costEstimate: '~$0.15/5s',
  },
];

export function VideoGeneratorForm() {
  const { currentTenant } = useAuth();
  const createVideoJob = useCreateVideoJob();

  const [productId, setProductId] = useState('');
  const [tier, setTier] = useState<VideoTier>('premium');
  const [duration, setDuration] = useState('5');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [prompt, setPrompt] = useState('');
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const [narrationText, setNarrationText] = useState('');

  // Fetch products for selector
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-video', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active')
        .order('name')
        .limit(100);
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  const selectedTier = VIDEO_TIERS.find(t => t.id === tier)!;
  const canSubmit = !!productId && !createVideoJob.isPending;

  const handleSubmit = () => {
    if (!productId) return;

    createVideoJob.mutate({
      product_id: productId,
      video_type: 'product_video',
      aspect_ratio: aspectRatio as any,
      duration_seconds: parseInt(duration) as any,
      user_prompt: prompt || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Produto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Produto</CardTitle>
          <CardDescription>Selecione o produto para o vídeo</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um produto..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tier de Vídeo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Qualidade do Vídeo</CardTitle>
          <CardDescription>Escolha o nível de qualidade e custo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {VIDEO_TIERS.map((t) => {
            const Icon = t.icon;
            const isSelected = tier === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTier(t.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.label}</span>
                    {t.badge && (
                      <Badge variant="secondary" className="text-[10px]">{t.badge}</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] ml-auto">{t.costEstimate}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{t.models}</p>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Configurações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Duração e Formato */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Duração
              </Label>
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
              <Label className="text-sm flex items-center gap-1.5">
                <Ratio className="h-3.5 w-3.5" /> Formato
              </Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Stories/Reels)</SelectItem>
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label className="text-sm">Prompt (opcional)</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva o vídeo desejado... (ex: 'Produto flutuando com partículas brilhantes em fundo escuro premium')"
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Narração */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" /> Narração PT-BR
              </Label>
              <Switch checked={narrationEnabled} onCheckedChange={setNarrationEnabled} />
            </div>
            {narrationEnabled && (
              <div className="space-y-2">
                <Textarea
                  value={narrationText}
                  onChange={(e) => setNarrationText(e.target.value)}
                  placeholder="Texto da narração em português..."
                  className="min-h-[60px] resize-none"
                />
                <Alert className="bg-muted/50">
                  <Info className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    A narração será gerada via ElevenLabs e sincronizada com lipsync via Kling.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Botão */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full h-12"
        size="lg"
      >
        {createVideoJob.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Gerando vídeo...
          </>
        ) : (
          <>
            <Video className="h-4 w-4 mr-2" />
            Gerar Vídeo com IA
          </>
        )}
      </Button>
    </div>
  );
}
