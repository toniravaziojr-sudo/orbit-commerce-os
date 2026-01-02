import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Loader2, Globe, CheckCircle, AlertCircle, Sparkles, Target, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface ImportPageDialogProps {
  tenantId: string;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  page?: { id: string; title: string; slug: string };
  strategicPlan?: {
    productType: string;
    framework: string;
    confidence: number;
    mainPromise: string;
  };
  optimization?: {
    qualityScore: number;
    frameworkCompliance: number;
    suggestions: string[];
  };
  stats?: {
    blocksCreated: number;
    aiCallsCount: number;
    processingTimeMs: number;
  };
  error?: string;
}

type ImportStep = 'idle' | 'fetching' | 'analyzing' | 'extracting' | 'optimizing' | 'saving' | 'done' | 'error';

const STEP_LABELS: Record<ImportStep, string> = {
  idle: 'Aguardando',
  fetching: 'Buscando página...',
  analyzing: 'Analisando estratégia...',
  extracting: 'Extraindo conteúdo...',
  optimizing: 'Otimizando para conversão...',
  saving: 'Salvando página...',
  done: 'Concluído!',
  error: 'Erro na importação',
};

const STEP_PROGRESS: Record<ImportStep, number> = {
  idle: 0,
  fetching: 15,
  analyzing: 35,
  extracting: 60,
  optimizing: 80,
  saving: 95,
  done: 100,
  error: 0,
};

export function ImportPageDialog({ tenantId, onSuccess }: ImportPageDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [currentStep, setCurrentStep] = useState<ImportStep>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);

  const isValidUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const cleanUrl = (urlString: string): string => {
    try {
      const url = new URL(urlString);
      const paramsToRemove = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
        'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'
      ];
      paramsToRemove.forEach(param => url.searchParams.delete(param));
      return url.toString();
    } catch {
      return urlString;
    }
  };

  const handleImport = async () => {
    if (!isValidUrl(url)) {
      toast.error('URL inválida. Insira uma URL válida começando com http:// ou https://');
      return;
    }

    setIsImporting(true);
    setResult(null);
    setCurrentStep('fetching');

    // Simular progresso dos passos
    const stepTimers: NodeJS.Timeout[] = [];
    stepTimers.push(setTimeout(() => setCurrentStep('analyzing'), 2000));
    stepTimers.push(setTimeout(() => setCurrentStep('extracting'), 5000));
    stepTimers.push(setTimeout(() => setCurrentStep('optimizing'), 10000));
    stepTimers.push(setTimeout(() => setCurrentStep('saving'), 15000));

    try {
      const cleanedUrl = cleanUrl(url);

      const { data, error } = await supabase.functions.invoke('import-page-v5', {
        body: { tenantId, url: cleanedUrl },
      });

      // Limpar timers
      stepTimers.forEach(t => clearTimeout(t));

      if (error) {
        throw new Error(error.message);
      }

      if (data?.success) {
        setCurrentStep('done');
        setResult(data);
        toast.success('Página importada com sucesso!');
        onSuccess();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      stepTimers.forEach(t => clearTimeout(t));
      console.error('Error importing page:', error);
      setCurrentStep('error');
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao importar página',
      });
      toast.error('Erro ao importar página');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setUrl('');
    setResult(null);
    setCurrentStep('idle');
  };

  const frameworkLabels: Record<string, string> = {
    AIDA: 'AIDA (Atenção, Interesse, Desejo, Ação)',
    PAS: 'PAS (Problema, Agitação, Solução)',
    BAB: 'BAB (Antes, Depois, Ponte)',
    PASTOR: 'PASTOR (Problema, Amplificar, Solução, Testemunhos, Oferta, Resposta)',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      else setIsOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Importar Página
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar Página com IA
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Nossa IA analisa a página, identifica a melhor estratégia de marketing e extrai o conteúdo otimizado para conversão.
          </p>

          <div className="space-y-2">
            <Label htmlFor="page-url">URL da Página</Label>
            <Input
              id="page-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://exemplo.com.br/produto"
              disabled={isImporting}
            />
            {url && !isValidUrl(url) && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                URL inválida
              </p>
            )}
          </div>

          {/* Progress durante importação */}
          {isImporting && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">{STEP_LABELS[currentStep]}</span>
              </div>
              <Progress value={STEP_PROGRESS[currentStep]} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {currentStep === 'analyzing' && 'Identificando tipo de produto e framework de marketing...'}
                {currentStep === 'extracting' && 'Extraindo blocos nativos com conteúdo real...'}
                {currentStep === 'optimizing' && 'Aplicando otimizações para máxima conversão...'}
              </p>
            </div>
          )}

          {/* Resultado da importação */}
          {result && result.success && (
            <div className="space-y-4">
              {/* Sucesso */}
              <div className="p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 flex items-start gap-2">
                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Página importada com sucesso!</p>
                  <p className="text-xs mt-1 opacity-80">{result.page?.title}</p>
                </div>
              </div>

              {/* Análise Estratégica */}
              {result.strategicPlan && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4 text-primary" />
                    Análise Estratégica
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Framework:</span>
                      <p className="font-medium">{result.strategicPlan.framework}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confiança:</span>
                      <p className="font-medium">{Math.round(result.strategicPlan.confidence * 100)}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Score de Qualidade */}
              {result.optimization && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BarChart3 className="h-4 w-4" />
                    Score de Qualidade: {result.optimization.qualityScore}/100
                  </div>
                  <Progress value={result.optimization.qualityScore} className="h-2" />
                  {result.optimization.suggestions?.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <p className="font-medium mb-1">Sugestões de melhoria:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {result.optimization.suggestions.slice(0, 3).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              {result.stats && (
                <p className="text-xs text-muted-foreground text-center">
                  {result.stats.blocksCreated} blocos criados • {result.stats.aiCallsCount} chamadas de IA • {(result.stats.processingTimeMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          )}

          {/* Erro */}
          {result && !result.success && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Erro na importação</p>
                <p className="text-xs mt-1 opacity-80">{result.error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={handleClose} 
              className="flex-1"
              disabled={isImporting}
            >
              {result?.success ? 'Fechar' : 'Cancelar'}
            </Button>
            {!result?.success && (
              <Button 
                onClick={handleImport} 
                disabled={!url || !isValidUrl(url) || isImporting}
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Importar com IA
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
