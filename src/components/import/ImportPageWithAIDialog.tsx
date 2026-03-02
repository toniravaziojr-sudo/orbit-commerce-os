import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Globe, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportPageWithAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  pageId?: string; // If provided, saves directly to this page
  targetType?: 'page' | 'landing_page'; // Defaults to 'page'
  onSuccess?: (result: ImportResult) => void;
}

export interface ImportResult {
  content: any;
  sectionsCount: number;
  sourceUrl: string;
  sourceTitle: string;
  pageId?: string;
}

type ImportStatus = 'idle' | 'scraping' | 'analyzing' | 'saving' | 'completed' | 'error';

const STATUS_LABELS: Record<ImportStatus, string> = {
  idle: '',
  scraping: 'Acessando e extraindo conteúdo da página...',
  analyzing: 'IA analisando e convertendo em blocos nativos...',
  saving: 'Salvando blocos na página...',
  completed: 'Importação concluída com sucesso!',
  error: 'Ocorreu um erro na importação.',
};

const STATUS_PROGRESS: Record<ImportStatus, number> = {
  idle: 0,
  scraping: 25,
  analyzing: 60,
  saving: 90,
  completed: 100,
  error: 0,
};

export function ImportPageWithAIDialog({ 
  open, 
  onOpenChange, 
  tenantId, 
  pageId,
  targetType = 'page',
  onSuccess 
}: ImportPageWithAIDialogProps) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    if (!url.trim()) {
      toast.error('Informe a URL da página');
      return;
    }

    setStatus('scraping');
    setErrorMessage('');
    setResult(null);

    try {
      // Simulate progress steps
      setTimeout(() => setStatus('analyzing'), 3000);

      const { data, error } = await supabase.functions.invoke('ai-import-page', {
        body: {
          url: url.trim(),
          tenantId,
          pageId,
          targetType,
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro na importação');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido');
      }

      if (pageId) {
        setStatus('saving');
        await new Promise(r => setTimeout(r, 500));
      }

      setStatus('completed');
      setResult(data.data);
      toast.success(`Importados ${data.data.sectionsCount} blocos nativos!`);
      onSuccess?.(data.data);
    } catch (err: any) {
      console.error('Import error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Erro desconhecido');
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleClose = () => {
    if (status !== 'scraping' && status !== 'analyzing' && status !== 'saving') {
      setUrl('');
      setStatus('idle');
      setErrorMessage('');
      setResult(null);
      onOpenChange(false);
    }
  };

  const isProcessing = status === 'scraping' || status === 'analyzing' || status === 'saving';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar com IA
          </DialogTitle>
          <DialogDescription>
            Cole a URL de qualquer página e a IA converterá automaticamente em blocos nativos editáveis no builder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* URL Input */}
          {status === 'idle' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="import-url">URL da página</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="import-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://exemplo.com/pagina"
                      className="pl-9"
                      onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Funciona com qualquer site: Shopify, Nuvemshop, WordPress, etc.
                </p>
              </div>

              <Button onClick={handleImport} className="w-full" disabled={!url.trim()}>
                <Sparkles className="h-4 w-4 mr-2" />
                Importar com IA
              </Button>
            </>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
              </div>
              <Progress value={STATUS_PROGRESS[status]} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Este processo pode levar de 15 a 60 segundos dependendo da complexidade da página.
              </p>
            </div>
          )}

          {/* Success */}
          {status === 'completed' && result && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Importação concluída!</span>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Blocos criados</span>
                  <Badge variant="secondary">{result.sectionsCount}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fonte</span>
                  <span className="text-xs truncate max-w-[200px]">{result.sourceUrl}</span>
                </div>
                {result.sourceTitle && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Título</span>
                    <span className="text-xs truncate max-w-[200px]">{result.sourceTitle}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleClose} className="flex-1">
                  {pageId ? 'Abrir no Builder' : 'Fechar'}
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Erro na importação</span>
              </div>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Fechar
                </Button>
                <Button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="flex-1">
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
