import { useState, useRef, useCallback } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { useImportData } from '@/hooks/useImportJobs';
import { parseCSV, consolidateShopifyProducts, consolidateShopifyCustomers, consolidateShopifyOrders, consolidateNuvemshopProducts, readFileWithEncoding } from '@/lib/import/utils';
import { normalizeData } from '@/lib/import/platforms';
import type { PlatformType } from '@/lib/import/types';
import { toast } from 'sonner';

type ImportModule = 'products' | 'customers' | 'orders';

interface FileImportDialogProps {
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
}

const MODULE_LABELS: Record<ImportModule, string> = {
  products: 'Produtos',
  customers: 'Clientes',
  orders: 'Pedidos',
};

export function FileImportDialog({ open, onOpenChange, module, onSuccess }: FileImportDialogProps) {
  const { currentTenant } = useAuth();
  const { importData } = useImportData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (ext !== 'csv' && ext !== 'json') {
        setError('Selecione um arquivo CSV ou JSON');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = useCallback(async () => {
    if (!file || !currentTenant?.id) return;

    setIsImporting(true);
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      // Read file with encoding detection for CSV
      const text = file.name.endsWith('.csv') ? await readFileWithEncoding(file) : await file.text();
      setProgress(20);

      let data: any[];

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        data = Array.isArray(parsed)
          ? parsed
          : parsed.products || parsed.customers || parsed.orders || [parsed];
      } else {
        const rawRows = parseCSV(text);

        // Platform-aware consolidation
        if (module === 'products') {
          const hasShopify = rawRows.length > 0 && ('Handle' in rawRows[0] || 'handle' in rawRows[0]);
          const hasNuvemshop = rawRows.length > 0 && (
            'Identificador URL' in rawRows[0] || 'Nome do produto' in rawRows[0] ||
            Object.keys(rawRows[0]).some(k => {
              const norm = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              return norm === 'identificador url' || norm === 'nome do produto';
            })
          );
          data = hasShopify ? consolidateShopifyProducts(rawRows)
               : hasNuvemshop ? consolidateNuvemshopProducts(rawRows)
               : rawRows;
        } else if (module === 'customers') {
          const hasShopify = rawRows.length > 0 && ('Email' in rawRows[0] || 'email' in rawRows[0]);
          data = hasShopify ? consolidateShopifyCustomers(rawRows) : rawRows;
        } else if (module === 'orders') {
          const hasShopify = rawRows.length > 0 && ('Name' in rawRows[0] || 'Order Number' in rawRows[0]);
          data = hasShopify ? consolidateShopifyOrders(rawRows) : rawRows;
        } else {
          data = rawRows;
        }
      }

      setProgress(40);

      // Detect effective platform for normalization
      const hasShopifyData = data.length > 0 && ('Handle' in data[0] || 'handle' in data[0] || 'Title' in data[0]);
      const effectivePlatform: PlatformType = hasShopifyData ? 'shopify' : 'unknown';

      const dataType = module === 'products' ? 'product' : module === 'customers' ? 'customer' : 'order';
      const normalized = normalizeData(effectivePlatform, dataType, data);

      setProgress(60);

      const importResult = await importData(effectivePlatform, module, normalized);

      setProgress(100);

      // Map result to standard envelope
      const resultData: ImportResult = {
        created: importResult.results?.created || 0,
        updated: importResult.results?.updated || 0,
        unchanged: importResult.results?.unchanged || 0,
        skipped: importResult.results?.skipped || 0,
        errors: importResult.results?.errors || importResult.results?.failed || 0,
      };

      setResult(resultData);

      const total = resultData.created + resultData.updated;
      if (total > 0) {
        toast.success(`${total} ${MODULE_LABELS[module].toLowerCase()} importados`);
        onSuccess?.();
      }
    } catch (err: any) {
      console.error('[FileImportDialog] Error:', err);
      setError(err.message || 'Erro desconhecido');
      toast.error(`Erro ao importar ${MODULE_LABELS[module].toLowerCase()}`);
    } finally {
      setIsImporting(false);
    }
  }, [file, currentTenant, module, importData, onSuccess]);

  const handleClose = () => {
    if (!isImporting) {
      setFile(null);
      setResult(null);
      setError(null);
      setProgress(0);
      onOpenChange(false);
    }
  };

  const label = MODULE_LABELS[module];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar {label}
          </DialogTitle>
          <DialogDescription>
            Importe {label.toLowerCase()} a partir de um arquivo CSV ou JSON exportado da sua plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!result && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
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
                  <p className="text-sm text-muted-foreground">CSV ou JSON</p>
                </div>
              )}
            </div>
          )}

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Importando {label.toLowerCase()}...</span>
              </div>
              <Progress value={progress} />
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
              </AlertDescription>
            </Alert>
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
