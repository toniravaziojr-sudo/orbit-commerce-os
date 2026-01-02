import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Loader2, Globe, CheckCircle, AlertCircle, Sparkles, Target, BarChart3, Wand2 } from 'lucide-react';
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
  };
  creation?: {
    creationQuality: number;
    copyStyle: string;
    warnings: string[];
  };
  stats?: {
    blocksCreated: number;
    aiCallsCount: number;
    processingTimeMs: number;
  };
  error?: string;
}

type ImportStep = 'idle' | 'fetching' | 'analyzing' | 'creating' | 'saving' | 'done' | 'error';

const STEP_LABELS: Record<ImportStep, string> = {
  idle: 'Aguardando',
  fetching: 'Buscando página...',
  analyzing: 'Categorizando produto...',
  creating: 'Criando página original com IA...',
  saving: 'Salvando página...',
  done: 'Concluído!',
  error: 'Erro na criação',
};

const STEP_PROGRESS: Record<ImportStep, number> = {
  idle: 0,
  fetching: 15,
  analyzing: 30,
  creating: 65,
  saving: 90,
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
    stepTimers.push(setTimeout(() => setCurrentStep('creating'), 5000));
    stepTimers.push(setTimeout(() => setCurrentStep('saving'), 18000));

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
        toast.success('Página criada com sucesso!');
        onSuccess();
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error) {
      stepTimers.forEach(t => clearTimeout(t));
      console.error('Error creating page:', error);
      setCurrentStep('error');
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar página',
      });
      toast.error('Erro ao criar página');
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      else setIsOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Criar Página com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Criar Página Original com IA
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Nossa IA analisa a referência e <strong>cria uma página completamente original</strong> - cada importação gera conteúdo único e persuasivo.
          </p>

          <div className="space-y-2">
            <Label htmlFor="page-url">URL de Referência</Label>
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

          {/* Progress durante criação */}
          {isImporting && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">{STEP_LABELS[currentStep]}</span>
              </div>
              <Progress value={STEP_PROGRESS[currentStep]} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {currentStep === 'analyzing' && 'Identificando categoria do produto e público-alvo...'}
                {currentStep === 'creating' && 'Gerando headlines, textos e depoimentos originais...'}
                {currentStep === 'saving' && 'Finalizando página...'}
              </p>
            </div>
          )}

          {/* Resultado da criação */}
          {result && result.success && (
            <div className="space-y-4">
              {/* Sucesso */}
              <div className="p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 flex items-start gap-2">
                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Página criada com sucesso!</p>
                  <p className="text-xs mt-1 opacity-80">{result.page?.title}</p>
                </div>
              </div>

              {/* Análise Estratégica */}
              {result.strategicPlan && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4 text-primary" />
                    Análise de Contexto
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Framework:</span>
                      <p className="font-medium">{result.strategicPlan.framework}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{result.strategicPlan.productType}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Qualidade da Criação */}
              {result.creation && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BarChart3 className="h-4 w-4" />
                    Qualidade: {result.creation.creationQuality}/100
                  </div>
                  <Progress value={result.creation.creationQuality} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Estilo: {result.creation.copyStyle}
                  </p>
                  {result.creation.warnings?.length > 0 && (
                    <div className="text-xs text-amber-600 mt-2">
                      {result.creation.warnings.slice(0, 2).map((w, i) => (
                        <p key={i}>• {w}</p>
                      ))}
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
                <p className="text-sm font-medium">Erro na criação</p>
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
                    Criando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Criar com IA
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
