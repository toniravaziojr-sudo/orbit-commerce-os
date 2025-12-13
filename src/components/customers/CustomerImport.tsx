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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CustomerImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  imported: number;
  addresses: number;
  skipped: number;
  errors: number;
  details: {
    skippedEmails: string[];
    errorMessages: string[];
  };
}

export function CustomerImport({ open, onOpenChange, onSuccess }: CustomerImportProps) {
  const { currentTenant } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!file || !currentTenant?.id) return;

    setIsImporting(true);
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      // Read file content
      const csvContent = await file.text();
      setProgress(30);

      // Get session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado para importar clientes');
      }

      setProgress(50);

      // Call edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-customers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            csvContent,
            tenantId: currentTenant.id,
          }),
        }
      );

      setProgress(90);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao importar clientes');
      }

      setProgress(100);
      setResult(data);

      if (data.imported > 0) {
        toast.success(`${data.imported} clientes importados com sucesso!`);
        onSuccess();
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast.error('Erro ao importar clientes');
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
                    Suporta CSV exportado do Shopify
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
              <Alert variant={result.imported > 0 ? 'default' : 'destructive'}>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Importação Concluída</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1">
                    <li>✅ {result.imported} clientes importados</li>
                    <li>📍 {result.addresses} endereços importados</li>
                    {result.skipped > 0 && (
                      <li>⏭️ {result.skipped} ignorados (já existem)</li>
                    )}
                    {result.errors > 0 && (
                      <li>❌ {result.errors} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>

              {result.details.skippedEmails.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Emails ignorados (amostra):</p>
                  <p className="text-xs">{result.details.skippedEmails.join(', ')}</p>
                </div>
              )}

              {result.details.errorMessages.length > 0 && (
                <div className="text-sm text-destructive">
                  <p className="font-medium mb-1">Erros (amostra):</p>
                  <ul className="text-xs space-y-1">
                    {result.details.errorMessages.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
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
