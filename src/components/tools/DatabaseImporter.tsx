import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Database, Loader2, CheckCircle2, AlertCircle, FileJson } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ImportResult {
  table: string;
  imported: number;
  total: number;
  errors: string[];
}

export function DatabaseImporter() {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState({ label: "", percent: 0 });
  const [filesLoaded, setFilesLoaded] = useState<Array<{ name: string; data: any }>>([]);
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
    const files = e.target.files;
    if (!files) return;

    const loaded: Array<{ name: string; data: any }> = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        loaded.push({ name: file.name, data: json });
      } catch (err) {
        toast.error(`Erro ao ler ${file.name}: arquivo JSON inválido`);
      }
    }

    setFilesLoaded(loaded);
    if (loaded.length > 0) {
      const totalTables = loaded.reduce((sum, f) => sum + Object.keys(f.data.tables || {}).length, 0);
      const totalRows = loaded.reduce((sum, f) => sum + (f.data.total_rows || 0), 0);
      toast.success(`${loaded.length} arquivo(s) carregado(s): ${totalTables} tabelas, ${totalRows} registros`);
    }
  };

  const startImport = async () => {
    if (filesLoaded.length === 0) return;

    setImporting(true);
    setResults([]);

    try {
      const headers = await getAuthHeaders();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/database-import`;

      // Obter ordem de importação
      const orderRes = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "get_import_order" }),
      });
      const orderData = await orderRes.json();
      if (!orderData.success) throw new Error(orderData.error);
      const importOrder: string[] = orderData.order;

      // Coletar todas as tabelas de todos os arquivos
      const allTables: Record<string, any[]> = {};
      for (const file of filesLoaded) {
        if (file.data.tables) {
          for (const [table, info] of Object.entries(file.data.tables as Record<string, { rows: any[] }>)) {
            if (info.rows && info.rows.length > 0) {
              allTables[table] = info.rows;
            }
          }
        }
      }

      // Ordenar tabelas conforme import order (foreign keys)
      const sortedTables = Object.keys(allTables).sort((a, b) => {
        const ai = importOrder.indexOf(a);
        const bi = importOrder.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

      const importResults: ImportResult[] = [];

      for (let i = 0; i < sortedTables.length; i++) {
        const table = sortedTables[i];
        const rows = allTables[table];

        setProgress({
          label: `Importando ${table} (${rows.length} registros)...`,
          percent: Math.round((i / sortedTables.length) * 100),
        });

        // Enviar em chunks de 500 para não exceder body limits
        const CHUNK_SIZE = 500;
        let totalImported = 0;
        const allErrors: string[] = [];

        for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
          const chunk = rows.slice(offset, offset + CHUNK_SIZE);

          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ action: "import_table", table, rows: chunk }),
          });
          const data = await res.json();

          if (data.success) {
            totalImported += data.imported;
            if (data.errors?.length > 0) {
              allErrors.push(...data.errors);
            }
          } else {
            allErrors.push(data.error || "Erro desconhecido");
          }
        }

        importResults.push({
          table,
          imported: totalImported,
          total: rows.length,
          errors: allErrors,
        });
      }

      setResults(importResults);
      setProgress({ label: "Concluído!", percent: 100 });

      const totalImported = importResults.reduce((s, r) => s + r.imported, 0);
      const totalErrors = importResults.reduce((s, r) => s + r.errors.length, 0);

      if (totalErrors === 0) {
        toast.success(`Importação concluída: ${totalImported} registros importados`);
      } else {
        toast.warning(`Importação concluída com ${totalErrors} erro(s): ${totalImported} registros importados`);
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
          Importar Banco de Dados
        </CardTitle>
        <CardDescription>
          Importe JSONs exportados pela ferramenta de exportação para popular o banco de dados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Select files */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Passo 1: Selecionar arquivos JSON</h4>
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

          {filesLoaded.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/30 rounded">
              {filesLoaded.map((f, i) => (
                <div key={i} className="flex justify-between">
                  <span className="font-mono">{f.name}</span>
                  <span>{f.data.total_rows || 0} registros</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Import */}
        {filesLoaded.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Passo 2: Importar dados</h4>
            <Button
              onClick={startImport}
              disabled={importing}
              className="gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {importing ? "Importando..." : "Iniciar Importação"}
            </Button>
          </div>
        )}

        {/* Progress */}
        {importing && progress.label && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{progress.label}</p>
            <Progress value={progress.percent} className="h-2" />
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Resultado</h4>
            <div className="space-y-1">
              {results.map((r) => (
                <div key={r.table} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <span className="font-mono">{r.table}</span>
                  <div className="flex items-center gap-2">
                    <span>{r.imported}/{r.total}</span>
                    {r.errors.length === 0 ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">📋 Como usar:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>No projeto <strong>antigo</strong>, exporte os módulos em <code>/platform-tools</code></li>
            <li>Baixe os arquivos JSON gerados</li>
            <li>No projeto <strong>novo</strong>, selecione os JSONs aqui</li>
            <li>Clique em <strong>"Iniciar Importação"</strong> — os dados serão inseridos respeitando a ordem das tabelas</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
