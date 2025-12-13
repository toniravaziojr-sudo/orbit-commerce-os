import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface ImportResult {
  message: string;
  totalParsed: number;
  success: number;
  failed: number;
  errors: string[];
}

interface ShopifyImportDialogProps {
  onSuccess: () => void;
}

export function ShopifyImportDialog({ onSuccess }: ShopifyImportDialogProps) {
  const { currentTenant } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Por favor, selecione um arquivo CSV');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file || !currentTenant?.id) {
      toast.error('Selecione um arquivo CSV');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Read file content
      const csvContent = await file.text();
      
      console.log('Sending CSV to import function...');
      console.log('Tenant ID:', currentTenant.id);
      console.log('CSV length:', csvContent.length);

      // Call edge function
      const { data, error } = await supabase.functions.invoke('import-shopify-products', {
        body: {
          csvContent,
          tenantId: currentTenant.id,
        },
      });

      if (error) {
        console.error('Import error:', error);
        toast.error('Erro na importação: ' + error.message);
        return;
      }

      setResult(data as ImportResult);
      
      if (data.success > 0) {
        toast.success(`${data.success} produtos importados com sucesso!`);
        onSuccess();
      }

      if (data.failed > 0) {
        toast.warning(`${data.failed} produtos falharam na importação`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao processar arquivo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFile(null);
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar Shopify
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Produtos do Shopify</DialogTitle>
          <DialogDescription>
            Faça upload do arquivo CSV exportado do Shopify para importar seus produtos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!result ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="csv-file">Arquivo CSV do Shopify</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={isLoading}
                    className="flex-1"
                  />
                </div>
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>{file.name}</span>
                    <span className="text-xs">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-muted p-4 text-sm">
                <h4 className="font-medium mb-2">Como exportar do Shopify:</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Acesse Produtos no painel do Shopify</li>
                  <li>Clique em Exportar</li>
                  <li>Selecione &quot;Todos os produtos&quot;</li>
                  <li>Escolha formato CSV</li>
                  <li>Faça upload aqui</li>
                </ol>
              </div>

              {isLoading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importando produtos...</span>
                  </div>
                  <Progress value={undefined} className="w-full" />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{result.totalParsed}</div>
                  <div className="text-xs text-muted-foreground">Encontrados</div>
                </div>
                <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950">
                  <div className="text-2xl font-bold text-green-600">
                    {result.success}
                  </div>
                  <div className="text-xs text-muted-foreground">Importados</div>
                </div>
                <div className="rounded-lg border p-4 bg-red-50 dark:bg-red-950">
                  <div className="text-2xl font-bold text-red-600">
                    {result.failed}
                  </div>
                  <div className="text-xs text-muted-foreground">Falharam</div>
                </div>
              </div>

              {result.success > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span>Importação concluída com sucesso!</span>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-4 max-h-40 overflow-auto">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">Erros:</span>
                  </div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {result.errors.slice(0, 10).map((error, i) => (
                      <li key={i} className="truncate">
                        {error}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-muted-foreground">
                        ... e mais {result.errors.length - 10} erros
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={!file || isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar Produtos
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
