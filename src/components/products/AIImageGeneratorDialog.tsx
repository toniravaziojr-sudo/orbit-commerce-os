import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface AIImageGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  primaryImageUrl: string;
  currentImageCount: number;
  onImagesGenerated: () => void;
}


type JobPhase = 'idle' | 'submitting' | 'polling' | 'saving' | 'done' | 'error';

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_MS = 5 * 60 * 1000; // 5 min

export function AIImageGeneratorDialog({
  open, onOpenChange, productId, productName, primaryImageUrl, currentImageCount, onImagesGenerated,
}: AIImageGeneratorDialogProps) {
  const { currentTenant } = useAuth();
  const [quantity, setQuantity] = useState('1');
  const [style, setStyle] = useState('product_natural');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [jobPhase, setJobPhase] = useState<JobPhase>('idle');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);

  const maxImages = Math.max(0, Math.min(5, 10 - currentImageCount));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      abortRef.current = true;
    };
  }, []);

  /**
   * Poll creative_jobs until status is 'succeeded' or 'failed'.
   * Returns output_urls on success.
   */
  const pollJobStatus = useCallback((jobId: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let dots = 0;

      const check = async () => {
        if (abortRef.current) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          reject(new Error('Cancelado'));
          return;
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_POLL_MS) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          reject(new Error('Tempo limite excedido (5 min). Tente novamente.'));
          return;
        }

        dots = (dots + 1) % 4;
        const elapsedSec = Math.round(elapsed / 1000);
        setStatusMessage(`Gerando imagem com IA${'.'.repeat(dots + 1)} (${elapsedSec}s)`);
        setProgress(Math.min(90, Math.round((elapsed / MAX_POLL_MS) * 100)));

        try {
          const { data, error } = await supabase
            .from('creative_jobs' as any)
            .select('status, output_urls, error_message')
            .eq('id', jobId)
            .single();

          if (error) {
            console.warn('[AIImageGen] Poll query error:', error);
            return; // retry
          }

          const job = data as any;
          if (job.status === 'succeeded') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            resolve(job.output_urls || []);
          } else if (job.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            reject(new Error(job.error_message || 'Falha na geração'));
          }
        } catch (err) {
          console.warn('[AIImageGen] Poll exception:', err);
        }
      };

      check(); // immediate first check
      pollingRef.current = setInterval(check, POLL_INTERVAL_MS);
    });
  }, []);

  const handleGenerate = async () => {
    if (!currentTenant?.id) return;
    const count = parseInt(quantity);
    setIsGenerating(true);
    setProgress(0);
    setJobPhase('submitting');
    setStatusMessage('Iniciando geração...');
    abortRef.current = false;

    let successCount = 0;

    try {
      for (let i = 0; i < count; i++) {
        if (abortRef.current) break;

        setStatusMessage(`Enviando solicitação ${i + 1} de ${count}...`);
        setJobPhase('submitting');
        setProgress(0);

        try {
          // 1. Submit job
          const { data, error } = await supabase.functions.invoke('creative-image-generate', {
            body: {
              tenant_id: currentTenant.id,
              product_id: productId,
              product_name: productName,
              product_image_url: primaryImageUrl,
              prompt: customPrompt
                ? `${customPrompt}. Produto: "${productName}". Variação ${i + 1}.`
                : `Criar foto profissional do produto "${productName}" baseada fielmente na imagem de referência fornecida. O produto deve ser IDÊNTICO ao da referência (mesmas cores, rótulo, formato). Variação ${i + 1}.`,
              settings: {
                generation_style: style,
                format: '1:1',
                variations: 1,
                providers: ['gemini'],
              },
            },
          });

          if (error) {
            console.error(`[AIImageGen] Invoke error ${i + 1}:`, error);
            setStatusMessage(`Erro ao solicitar imagem ${i + 1}`);
            continue;
          }

          if (!data?.success) {
            console.error(`[AIImageGen] Logical failure ${i + 1}:`, data?.error);
            setStatusMessage(`Falha: ${data?.error || 'Erro desconhecido'}`);
            continue;
          }

          // 2. Extract job_id
          const jobId = data?.data?.job_id || data?.job_id;
          if (!jobId) {
            console.error(`[AIImageGen] No job_id for image ${i + 1}`, data);
            continue;
          }

          console.log(`[AIImageGen] Job ${jobId} submitted (image ${i + 1})`);
          setJobPhase('polling');

          // 3. Poll until complete
          const outputUrls = await pollJobStatus(jobId);

          if (outputUrls.length > 0) {
            setJobPhase('saving');
            setStatusMessage(`Salvando imagem ${i + 1}...`);
            setProgress(95);

            for (let j = 0; j < outputUrls.length; j++) {
              const url = outputUrls[j];
              if (!url) continue;

              const { error: insertError } = await supabase.from('product_images').insert({
                product_id: productId,
                url,
                alt_text: `${productName} - IA ${style} ${i + 1}`,
                is_primary: false,
                sort_order: currentImageCount + successCount + j + 1,
              });

              if (!insertError) {
                successCount++;
                console.log(`[AIImageGen] Image saved to product_images`);
              } else {
                console.error(`[AIImageGen] Insert error:`, insertError);
              }
            }
          }
        } catch (err: any) {
          console.error(`[AIImageGen] Error for image ${i + 1}:`, err);
          setStatusMessage(err?.message || 'Erro na geração');
        }
      }

      if (successCount > 0) {
        setJobPhase('done');
        setProgress(100);
        setStatusMessage(`${successCount} imagem(ns) gerada(s) com sucesso!`);
        toast.success(`${successCount} imagem(ns) gerada(s) com sucesso!`);
        onImagesGenerated();
        setTimeout(() => handleClose(), 1500);
      } else {
        setJobPhase('error');
        toast.error('Nenhuma imagem foi gerada. Tente novamente.');
        setStatusMessage('Nenhuma imagem gerada. Verifique os créditos ou tente outro estilo.');
      }
    } catch (error) {
      console.error('[AIImageGen] Fatal error:', error);
      setJobPhase('error');
      toast.error('Erro ao gerar imagens');
    } finally {
      setIsGenerating(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  };

  const handleClose = () => {
    if (isGenerating) abortRef.current = true;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setJobPhase('idle');
    setProgress(0);
    setStatusMessage('');
    onOpenChange(false);
  };

  const phaseIcon = () => {
    if (jobPhase === 'done') return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />;
    if (jobPhase === 'error') return <AlertCircle className="h-5 w-5 text-destructive shrink-0" />;
    return <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />;
  };

  const phaseHint = () => {
    switch (jobPhase) {
      case 'submitting': return 'Enviando para o motor de IA...';
      case 'polling': return 'A IA está processando — pode levar até 60 segundos';
      case 'saving': return 'Vinculando imagem ao produto...';
      case 'done': return 'Concluído!';
      case 'error': return 'Verifique e tente novamente';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Imagens com IA
          </DialogTitle>
          <DialogDescription>
            Crie variações da imagem principal usando inteligência artificial
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <img src={primaryImageUrl} alt={productName} className="w-16 h-16 rounded object-cover" />
            <div>
              <p className="font-medium text-sm">{productName}</p>
              <p className="text-xs text-muted-foreground">Imagem de referência</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estilo de geração</Label>
            <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <s.icon className="h-4 w-4" />
                      <span>{s.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {STYLES.find((s) => s.value === style)?.description}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Quantidade de imagens</Label>
            {maxImages <= 0 ? (
              <p className="text-sm text-destructive">Limite de 10 imagens atingido para este produto.</p>
            ) : (
              <Select value={quantity} onValueChange={setQuantity} disabled={isGenerating}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxImages }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'imagem' : 'imagens'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Direções criativas
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              placeholder="Ex: Foto para campanha de Dia dos Pais, fundo azul escuro, estilo premium..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isGenerating}
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          {isGenerating && (
            <div className="space-y-3 p-3 rounded-lg border bg-primary/5">
              <div className="flex items-center gap-3">
                {phaseIcon()}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{statusMessage}</p>
                  <p className="text-xs text-muted-foreground">{phaseHint()}</p>
                </div>
              </div>
              {(jobPhase === 'polling' || jobPhase === 'submitting') && (
                <Progress value={progress} className="h-1.5" />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={jobPhase === 'saving'}>
            {isGenerating ? 'Cancelar' : 'Fechar'}
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || maxImages === 0}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? 'Gerando...' : 'Gerar Imagens'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
