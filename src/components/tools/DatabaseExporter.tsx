import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Database, Loader2, CheckCircle2, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GroupInfo {
  tables: string[];
  description: string;
}

interface TableCount {
  [table: string]: number;
}

export function DatabaseExporter() {
  const [groups, setGroups] = useState<Record<string, GroupInfo> | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [tableCounts, setTableCounts] = useState<Record<string, TableCount>>({});
  const [loadingGroup, setLoadingGroup] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exported, setExported] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ label: "", percent: 0 });

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");
    return {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  };

  const apiFetch = async (params: string) => {
    const headers = await getAuthHeaders();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/database-export?${params}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Erro desconhecido");
    return data;
  };

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("action=list_groups");
      setGroups(data.groups);
      toast.success(`${Object.keys(data.groups).length} grupos de tabelas disponíveis`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupCounts = async (groupKey: string) => {
    if (expandedGroup === groupKey) {
      setExpandedGroup(null);
      return;
    }
    setExpandedGroup(groupKey);

    if (tableCounts[groupKey]) return;

    setLoadingGroup(groupKey);
    try {
      const data = await apiFetch(`action=export_group&group=${groupKey}`);
      setTableCounts(prev => ({ ...prev, [groupKey]: data.tables }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingGroup(null);
    }
  };

  const exportGroup = async (groupKey: string) => {
    if (!groups) return;
    const tables = groups[groupKey].tables;
    setExporting(groupKey);
    setProgress({ label: "Iniciando...", percent: 0 });

    try {
      const allData: Record<string, any[]> = {};

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setProgress({
          label: `Exportando ${table}...`,
          percent: Math.round((i / tables.length) * 100),
        });

        let allRows: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const data = await apiFetch(`action=export_table&table=${table}&offset=${offset}&limit=1000`);
          allRows = [...allRows, ...data.rows];
          hasMore = data.has_more;
          offset = data.next_offset || 0;
        }

        if (allRows.length > 0) {
          allData[table] = allRows;
        }
      }

      setProgress({ label: "Gerando arquivo...", percent: 95 });

      const exportPayload = {
        exported_at: new Date().toISOString(),
        group: groupKey,
        tables: Object.fromEntries(
          Object.entries(allData).map(([t, rows]) => [t, { count: rows.length, rows }])
        ),
        total_rows: Object.values(allData).reduce((sum, rows) => sum + rows.length, 0),
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `db-export-${groupKey}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);

      setExported(prev => new Set(prev).add(groupKey));
      toast.success(`Grupo "${groupKey}" exportado: ${exportPayload.total_rows} registros`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(null);
      setProgress({ label: "", percent: 0 });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Exportar Banco de Dados
        </CardTitle>
        <CardDescription>
          Exporte tabelas do banco de dados em JSON para migração. Os dados são agrupados por módulo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1 */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Passo 1: Listar Módulos</h4>
          <Button onClick={loadGroups} disabled={loading} variant="outline" className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            {loading ? "Carregando..." : "Listar Módulos"}
          </Button>
        </div>

        {/* Groups list */}
        {groups && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Passo 2: Exportar cada módulo</h4>
            <div className="space-y-2">
              {Object.entries(groups).map(([key, info]) => (
                <div key={key} className="border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => loadGroupCounts(key)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedGroup === key ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-sm">{key}</span>
                      <span className="text-xs text-muted-foreground">— {info.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {exported.has(key) && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={exporting !== null}
                        onClick={(e) => {
                          e.stopPropagation();
                          exportGroup(key);
                        }}
                      >
                        {exporting === key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        {exporting === key ? "Exportando..." : "Exportar"}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded table details */}
                  {expandedGroup === key && (
                    <div className="border-t px-3 py-2 bg-muted/30">
                      {loadingGroup === key ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Contando registros...
                        </div>
                      ) : tableCounts[key] ? (
                        <div className="space-y-1">
                          {Object.entries(tableCounts[key]).map(([table, count]) => (
                            <div key={table} className="flex justify-between text-xs">
                              <span className="text-muted-foreground font-mono">{table}</span>
                              <span className="font-medium">{count >= 0 ? `${count} registros` : "erro"}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhum dado disponível</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {exporting && progress.label && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{progress.label}</p>
            <Progress value={progress.percent} className="h-2" />
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">📋 Passo a passo:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Clique em <strong>"Listar Módulos"</strong> para ver os grupos de tabelas</li>
            <li>Expanda cada grupo para ver quantos registros existem</li>
            <li>Clique em <strong>"Exportar"</strong> em cada grupo — será baixado um JSON</li>
            <li>No novo projeto, os JSONs serão usados para importar os dados</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
