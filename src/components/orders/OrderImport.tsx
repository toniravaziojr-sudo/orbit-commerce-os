import { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface OrderImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ImportState = 'idle' | 'uploading' | 'success' | 'error';

export function OrderImport({ open, onOpenChange, onSuccess }: OrderImportProps) {
  const { currentTenant } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ImportState>('idle');
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    totalErrors: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setState('idle');
      setResult(null);
      setErrorMessage('');
    }
  };

  const handleImport = async () => {
    if (!file || !currentTenant?.id) return;

    setState('uploading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tenantId', currentTenant.id);

      const { data, error } = await supabase.functions.invoke('import-orders', {
        body: formData,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      setState('success');
      onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido');
      setState('error');
    }
  };

  const handleClose = () => {
    setFile(null);
    setState('idle');
    setResult(null);
    setErrorMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Pedidos
          </DialogTitle>
          <DialogDescription>
            Importe pedidos de um arquivo CSV exportado do Shopify.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {state === 'idle' && (
            <>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="order-file-upload"
                />
                <label htmlFor="order-file-upload" className="cursor-pointer">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {file ? (
                      <span className="text-foreground font-medium">{file.name}</span>
                    ) : (
                      'Clique para selecionar um arquivo CSV'
                    )}
                  </p>
                </label>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  O arquivo deve ser um export de pedidos do Shopify em formato CSV.
                  Pedidos já existentes serão ignorados.
                </AlertDescription>
              </Alert>
            </>
          )}

          {state === 'uploading' && (
            <div className="py-8 text-center space-y-4">
              <Progress value={50} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Importando pedidos... Isso pode levar alguns segundos.
              </p>
            </div>
          )}

          {state === 'success' && result && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Importação concluída!</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">Já existiam</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{result.totalErrors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Erros encontrados:</p>
                      {result.errors.slice(0, 5).map((err, i) => (
                        <p key={i} className="text-xs">{err}</p>
                      ))}
                      {result.totalErrors > 5 && (
                        <p className="text-xs">...e mais {result.totalErrors - 5} erros</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {state === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {state === 'success' ? 'Fechar' : 'Cancelar'}
          </Button>
          {state === 'idle' && (
            <Button onClick={handleImport} disabled={!file}>
              Importar
            </Button>
          )}
          {state === 'error' && (
            <Button onClick={() => setState('idle')}>
              Tentar novamente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
