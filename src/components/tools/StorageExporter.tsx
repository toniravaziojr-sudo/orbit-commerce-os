import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, FolderOpen, Loader2, CheckCircle2, HardDrive } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BucketInfo {
  id: string;
  name: string;
  public: boolean;
}

interface ExportedFile {
  path: string;
  size: number;
  mimetype: string;
  url: string;
}

export function StorageExporter() {
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [exported, setExported] = useState<Set<string>>(new Set());

  const loadBuckets = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      const res = await supabase.functions.invoke("storage-export", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: null,
        method: "GET",
      });

      // Use query params via direct fetch
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-export?action=list_buckets`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setBuckets(data.buckets || []);
      toast.success(`${data.buckets?.length || 0} buckets encontrados`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao listar buckets");
    } finally {
      setLoading(false);
    }
  };

  const exportBucket = async (bucketId: string) => {
    setExporting(bucketId);
    setProgress({ current: 0, total: 0, label: `Listando ${bucketId}...` });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const allFiles: ExportedFile[] = [];
      const foldersToScan = [""];

      while (foldersToScan.length > 0) {
        const prefix = foldersToScan.shift()!;
        setProgress(p => ({ ...p, label: `Escaneando ${bucketId}/${prefix || "(raiz)"}...` }));

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-export?action=list_files&bucket=${encodeURIComponent(bucketId)}&prefix=${encodeURIComponent(prefix)}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        if (data.files) {
          allFiles.push(...data.files);
          setProgress({ current: allFiles.length, total: allFiles.length, label: `${allFiles.length} arquivos encontrados...` });
        }

        if (data.subfolders) {
          foldersToScan.push(...data.subfolders);
        }
      }

      // Download as JSON
      const exportData = {
        bucket: bucketId,
        exported_at: new Date().toISOString(),
        total_files: allFiles.length,
        files: allFiles,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `storage-export-${bucketId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);

      setExported(prev => new Set(prev).add(bucketId));
      toast.success(`${allFiles.length} arquivos exportados de "${bucketId}"`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar bucket");
    } finally {
      setExporting(null);
      setProgress({ current: 0, total: 0, label: "" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Exportar Storage (Mídias)
        </CardTitle>
        <CardDescription>
          Exporte todos os arquivos do storage para migração. Cada bucket gera um JSON com URLs para download.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Passo 1: Listar Buckets</h4>
          <Button onClick={loadBuckets} disabled={loading} variant="outline" className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            {loading ? "Carregando..." : "Listar Buckets"}
          </Button>
        </div>

        {/* Buckets list */}
        {buckets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Passo 2: Exportar cada bucket</h4>
            <div className="space-y-2">
              {buckets.map(bucket => (
                <div
                  key={bucket.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{bucket.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({bucket.public ? "público" : "privado"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {exported.has(bucket.id) && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={exporting !== null}
                      onClick={() => exportBucket(bucket.id)}
                    >
                      {exporting === bucket.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      {exporting === bucket.id ? "Exportando..." : "Exportar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {exporting && progress.label && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{progress.label}</p>
            {progress.total > 0 && (
              <Progress value={100} className="h-2" />
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">📋 Passo a passo para migrar:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Clique em <strong>"Listar Buckets"</strong> para ver todos os buckets</li>
            <li>Clique em <strong>"Exportar"</strong> em cada bucket — será baixado um JSON com URLs</li>
            <li>As URLs dos arquivos privados têm <strong>validade de 7 dias</strong></li>
            <li>No novo projeto, faça re-upload dos arquivos usando as URLs do JSON</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
