/**
 * UGC AI Tab — Avatar/Ator 100% IA
 * 
 * Pipeline: Kling AI Avatar v2 Pro / Veo 3.1 / Sora 2
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  User, 
  Video,
  Sparkles,
  Upload,
  Loader2,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';
import { toast } from 'sonner';

export function UGCAITab() {
  const [mode, setMode] = useState<'avatar' | 'full_video'>('avatar');
  const [script, setScript] = useState('');
  const [duration, setDuration] = useState<string>('15');
  const [aspectRatio, setAspectRatio] = useState<string>('9:16');
  const [voice, setVoice] = useState<string>('male-mature');
  const [cta, setCta] = useState('');

  const [justCreated, setJustCreated] = useState(false);
  
  const { data: jobs, isLoading, refetch } = useCreativeJobs('ugc_ai_video');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.ugc_ai_video;
  
  // Detectar jobs em processamento
  const activeJobs = jobs?.filter(j => j.status === 'queued' || j.status === 'running') || [];
  const hasActiveJobs = activeJobs.length > 0;

  const handleGenerate = async () => {
    if (!script.trim()) return;
    
    createJob.mutate({
      type: 'ugc_ai_video',
      prompt: script,
      settings: {
        mode,
        duration: parseInt(duration),
        aspect_ratio: aspectRatio,
        voice,
        cta: cta || undefined,
      },
    }, {
      onSuccess: () => {
        // Reset form e mostrar feedback
        setScript('');
        setCta('');
        setJustCreated(true);
        
        // Refetch para mostrar o novo job
        setTimeout(() => refetch(), 500);
        
        // Remover destaque após 5s
        setTimeout(() => setJustCreated(false), 5000);
      }
    });
  };
  
  // Polling mais frequente quando há jobs ativos
  useEffect(() => {
    if (!hasActiveJobs) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    
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
            Crie vídeos com avatares IA realistas falando como uma pessoa
          </CardDescription>
        </CardHeader>
        
        {/* Alerta de sucesso */}
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
          {/* Modo */}
          <div className="space-y-3">
            <Label>Modo de Geração</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'avatar' | 'full_video')}>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="avatar" id="mode-avatar" className="mt-1" />
                <div>
                  <Label htmlFor="mode-avatar" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" />
                    Avatar Falando (Talking Head)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Foco em realismo para UGC — avatar olhando para câmera
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <RadioGroupItem value="full_video" id="mode-full" className="mt-1" />
                <div>
                  <Label htmlFor="mode-full" className="flex items-center gap-2 cursor-pointer">
                    <Video className="h-4 w-4" />
                    UGC em Cena (Full Video)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pessoa em ambiente completo — mais cinematográfico
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
              placeholder="Digite o texto que o avatar vai falar...

Exemplo:
'Gente, vocês precisam conhecer esse produto! Eu estava com problema X e depois que comecei a usar, minha vida mudou completamente. Super recomendo!'"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              {script.length} caracteres • Recomendado: 150-400 caracteres para vídeos de 15-30s
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

          {/* Avatar Reference (optional) */}
          <div className="space-y-2">
            <Label>Referência do Avatar (opcional)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">
              <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Upload de foto para consistência visual (opcional)
              </p>
            </div>
          </div>

          {/* Voice Preset */}
          <div className="space-y-2">
            <Label>Voz</Label>
            <Select value={voice} onValueChange={setVoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female-young">Feminina Jovem (Entusiasta)</SelectItem>
                <SelectItem value="female-mature">Feminina Madura (Confiante)</SelectItem>
                <SelectItem value="male-young">Masculina Jovem (Casual)</SelectItem>
                <SelectItem value="male-mature">Masculina Madura (Profissional)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration & Aspect Ratio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 segundos</SelectItem>
                  <SelectItem value="15">15 segundos</SelectItem>
                  <SelectItem value="20">20 segundos</SelectItem>
                  <SelectItem value="25">25 segundos</SelectItem>
                  <SelectItem value="30">30 segundos</SelectItem>
                </SelectContent>
              </Select>
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

          {/* Modelos */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Modelo recomendado:</Label>
            <div className="flex flex-wrap gap-1">
              {models.filter(m => m.isDefault || (mode === 'full_video' && m.id.includes('veo'))).map(m => (
                <Badge key={m.id} variant="outline" className="text-xs">
                  {m.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button 
            className="w-full" 
            disabled={!script.trim() || createJob.isPending}
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
