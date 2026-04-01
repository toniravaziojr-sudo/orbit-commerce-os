import { useState, useCallback } from 'react';
import { Globe, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useImportJobs } from '@/hooks/useImportJobs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ImportModule = 'categories' | 'menus';

interface UrlImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: ImportModule;
  onSuccess?: () => void;
}

interface ImportResult {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: number;
  message?: string;
}

const MODULE_CONFIG: Record<ImportModule, { label: string; description: string; edgeFunction: string }> = {
  categories: {
    label: 'Categorias',
    description: 'Informe a URL da loja para detectar e importar categorias automaticamente via scraping.',
    edgeFunction: 'import-store-categories',
  },
  menus: {
    label: 'Menus',
    description: 'Informe a URL da loja para importar a estrutura de navegação (header e footer). Os menus existentes serão substituídos.',
    edgeFunction: 'import-menus',
  },
};

export function UrlImportDialog({ open, onOpenChange, module, onSuccess }: UrlImportDialogProps) {
  const { currentTenant } = useAuth();
  const { createJob } = useImportJobs();
  const [url, setUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = MODULE_CONFIG[module];

  const handleImport = useCallback(async () => {
    if (!url.trim() || !currentTenant?.id) return;

    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }

      if (module === 'categories') {
        // Categories require a job for tracking
        const job = await createJob.mutateAsync({
          platform: 'scraping',
          modules: ['categories'],
        });

        const { data, error: fnError } = await supabase.functions.invoke(config.edgeFunction, {
          body: {
            job_id: job.id,
            source_url: formattedUrl,
            platform: 'unknown',
          },
        });

        if (fnError) throw fnError;
        if (!data?.success) throw new Error(data?.error || 'Falha na importação');

        const r = data.results || {};
        setResult({
          created: r.created || data.stats?.created || 0,
          updated: r.updated || data.stats?.updated || 0,
          unchanged: r.unchanged || 0,
          skipped: r.skipped || data.stats?.skipped || 0,
          errors: r.errors || data.stats?.failed || 0,
          message: data.message,
        });
      } else {
        // Menus - direct call (replace behavior)
        const { data, error: fnError } = await supabase.functions.invoke(config.edgeFunction, {
          body: {
            tenantId: currentTenant.id,
            storeUrl: formattedUrl,
          },
        });

        if (fnError) throw fnError;
        if (!data?.success) throw new Error(data?.error || 'Falha na importação');

        const r = data.results || {};
        setResult({
          created: r.created || data.totalItems || 0,
          updated: r.updated || 0,
          unchanged: r.unchanged || 0,
          skipped: r.skipped || 0,
          errors: r.errors || 0,
          message: data.message,
        });
      }

      toast.success(`${config.label} importados com sucesso`);
      onSuccess?.();
    } catch (err: any) {
      console.error(`[UrlImportDialog] Error:`, err);
      setError(err.message || 'Erro desconhecido');
      toast.error(`Erro ao importar ${config.label.toLowerCase()}`);
    } finally {
      setIsImporting(false);
    }
  }, [url, currentTenant, module, config, createJob, onSuccess]);

  const handleClose = () => {
    if (!isImporting) {
      setUrl('');
      setResult(null);
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Importar {config.label}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!result && (
            <div className="space-y-2">
              <Label htmlFor="store-url">URL da Loja</Label>
              <Input
                id="store-url"
                placeholder="https://minhaloja.com.br"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isImporting}
              />
            </div>
          )}

          {isImporting && (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Analisando e importando {config.label.toLowerCase()}...</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert variant={result.created + result.updated > 0 ? 'default' : 'destructive'}>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Importação Concluída</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1">
                  {result.created > 0 && <li>✅ {result.created} criados</li>}
                  {result.updated > 0 && <li>🔄 {result.updated} atualizados</li>}
                  {result.unchanged > 0 && <li>⏸️ {result.unchanged} sem alteração</li>}
                  {result.skipped > 0 && <li>⏭️ {result.skipped} ignorados</li>}
                  {result.errors > 0 && <li>❌ {result.errors} erros</li>}
                </ul>
                {result.message && <p className="mt-2 text-xs text-muted-foreground">{result.message}</p>}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!url.trim() || isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                'Importar'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
