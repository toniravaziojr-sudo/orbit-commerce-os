import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useImportData } from '@/hooks/useImportJobs';
import { parseCSV, consolidateShopifyCustomers, readFileWithEncoding } from '@/lib/import/utils';
import { normalizeData } from '@/lib/import/platforms';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

interface CustomerImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: number;
}

/**
 * CustomerImport — Individual customer import button (Clientes module).
 * 
 * Uses the SAME unified flow as the GuidedImportWizard:
 *   1. Parse CSV client-side (same utils)
 *   2. Normalize data (same adapters)
 *   3. Send via useImportData → canonical motor import-customers (same batching, same tracking)
 * 
 * NO direct fetch to edge functions. NO legacy paths.
 */
export function CustomerImport({ open, onOpenChange, onSuccess }: CustomerImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { importData } = useImportData();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Por favor, selecione um arquivo CSV');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      // 1. Read file content with encoding detection (same as wizard)
      const text = await readFileWithEncoding(file);
      setProgress(20);

      // 2. Parse CSV (same as wizard)
      const rawRows = parseCSV(text);
      if (rawRows.length === 0) {
        throw new Error('Nenhum registro encontrado no CSV');
      }
      setProgress(30);

      // 3. Consolidate if Shopify format (same as wizard)
      const hasShopify = rawRows.length > 0 && ('Email' in rawRows[0] || 'email' in rawRows[0]);
      const data = hasShopify ? consolidateShopifyCustomers(rawRows) : rawRows;
      setProgress(40);

      // 4. Normalize data (same as wizard — uses generic/shopify adapter)
      const hasShopifyData = data.length > 0 && ('Email' in data[0] || 'First Name' in data[0]);
      const effectivePlatform = hasShopifyData ? 'shopify' : 'unknown';
      const normalized = normalizeData(effectivePlatform as any, 'customer', data);
      setProgress(50);

      // 5. Send via useImportData — same batched flow as wizard
      //    Creates import_job, sends in 200-item batches to import-customers motor
      const importResult = await importData('csv', 'customers', normalized);
      setProgress(100);

      const r = importResult.results || { imported: 0, failed: 0, skipped: 0 };
      const imported = r.imported || 0;
      const skipped = r.skipped || 0;
      const failed = r.failed || 0;

      setResult({
        success: true,
        created: imported,
        updated: 0,
        unchanged: 0,
        skipped,
        errors: failed,
      });

      if (imported > 0) {
        toast.success(`${imported} clientes importados com sucesso!`);
        onSuccess();
      } else if (skipped > 0 && imported === 0) {
        toast.info(`${skipped} clientes já estavam atualizados`);
        onSuccess();
      }
    } catch (err) {
      console.error('[CustomerImport] Import error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      showErrorToast(err, { module: 'clientes', action: 'importar' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setFile(null);
      setResult(null);
      setError(null);
      setProgress(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Clientes
          </DialogTitle>
          <DialogDescription>
            Importe clientes a partir de um arquivo CSV exportado do Shopify ou similar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          {!result && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isImporting}
              />
              
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-10 w-10 text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Clique para selecionar arquivo</p>
                  <p className="text-sm text-muted-foreground">
                    Suporta CSV exportado do Shopify ou similar
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Importando clientes...</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4">
              <Alert variant={(result.created + result.updated) > 0 ? 'default' : 'destructive'}>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Importação Concluída</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1">
                    {result.created > 0 && (
                      <li>✅ {result.created} clientes criados</li>
                    )}
                    {result.updated > 0 && (
                      <li>🔄 {result.updated} clientes atualizados (Smart Merge)</li>
                    )}
                    {result.unchanged > 0 && (
                      <li>⏭️ {result.unchanged} sem alterações</li>
                    )}
                    {result.skipped > 0 && (
                      <li>⏭️ {result.skipped} ignorados</li>
                    )}
                    {result.errors > 0 && (
                      <li>❌ {result.errors} erros</li>
                    )}
                    {result.created === 0 && result.updated === 0 && result.unchanged === 0 && (
                      <li>ℹ️ Nenhum cliente processado</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || isImporting}>
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
