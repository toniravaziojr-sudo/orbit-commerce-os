import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, HardDrive, Loader2, CheckCircle2, AlertCircle, FileJson } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface FileEntry {
  bucket: string;
  path: string;
  url: string;
}

interface ImportResult {
  path: string;
  success: boolean;
  error?: string;
}

export function StorageImporter() {
  const [importing, setImporting] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState({ label: "", percent: 0, imported: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");
    return {
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (!inputFiles) return;

    const allFiles: FileEntry[] = [];
    for (const file of Array.from(inputFiles)) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        
        // O JSON exportado pelo StorageExporter tem formato:
        // { bucket, files: [{ name, path, url, ... }] }
        if (json.bucket && json.files) {
          for (const f of json.files) {
            if (f.url) {
              allFiles.push({
                bucket: json.bucket,
                path: f.path || f.name,
                url: f.url,
              });
            }
          }
        }
      } catch (err) {
        toast.error(`Erro ao ler ${file.name}: arquivo JSON inválido`);
      }
    }

    setFiles(allFiles);
    if (allFiles.length > 0) {
      const buckets = [...new Set(allFiles.map(f => f.bucket))];
      toast.success(`${allFiles.length} arquivo(s) encontrado(s) em ${buckets.length} bucket(s)`);
    }
  };

  const startImport = async () => {
    if (files.length === 0) return;

    setImporting(true);
    setResults([]);

    try {
      const headers = await getAuthHeaders();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-import`;

      const allResults: ImportResult[] = [];
      const BATCH_SIZE = 5;

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        
        setProgress({
          label: `Importando ${batch[0]?.path}...`,
          percent: Math.round((i / files.length) * 100),
          imported: allResults.filter(r => r.success).length,
          total: files.length,
        });

        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "import_batch", files: batch }),
        });
        const data = await res.json();

        if (data.results) {
          allResults.push(...data.results);
        }
      }

      setResults(allResults);
      setProgress({
        label: "Concluído!",
        percent: 100,
        imported: allResults.filter(r => r.success).length,
        total: files.length,
      });

      const imported = allResults.filter(r => r.success).length;
      const failed = allResults.filter(r => !r.success).length;

      if (failed === 0) {
        toast.success(`${imported} arquivo(s) importado(s) com sucesso`);
      } else {
        toast.warning(`${imported} importado(s), ${failed} falha(s)`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Mídias (Storage)
        </CardTitle>
        <CardDescription>
          Importe arquivos do storage usando os JSONs exportados (URLs assinadas válidas por 7 dias).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Passo 1: Selecionar JSONs de exportação do storage</h4>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <FileJson className="h-4 w-4" />
            Selecionar arquivos de exportação
          </Button>

          {files.length > 0 && (
            <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
              <p>{files.length} arquivo(s) para importar</p>
              <p className="text-[10px]">Buckets: {[...new Set(files.map(f => f.bucket))].join(", ")}</p>
            </div>
          )}
        </div>

        {/* Step 2 */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Passo 2: Importar arquivos</h4>
            <Button
              onClick={startImport}
              disabled={importing}
              className="gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
              {importing ? "Importando..." : "Iniciar Importação"}
            </Button>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {progress.label} ({progress.imported}/{progress.total})
            </p>
            <Progress value={progress.percent} className="h-2" />
          </div>
        )}

        {/* Results summary */}
        {results.length > 0 && !importing && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Resultado</h4>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {results.filter(r => r.success).length} importados
              </div>
              {results.filter(r => !r.success).length > 0 && (
                <div className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  {results.filter(r => !r.success).length} falhas
                </div>
              )}
            </div>

            {results.filter(r => !r.success).length > 0 && (
              <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                {results.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="p-1 bg-destructive/10 rounded text-destructive">
                    {r.path}: {r.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">⚠️ Importante:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>As URLs assinadas expiram em <strong>7 dias</strong> após a exportação</li>
            <li>Execute a importação dentro desse prazo</li>
            <li>Os arquivos serão salvos nos mesmos caminhos do storage original</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
