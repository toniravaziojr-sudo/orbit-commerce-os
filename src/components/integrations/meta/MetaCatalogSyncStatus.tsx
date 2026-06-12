import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useMetaCatalog } from "@/hooks/useMetaCatalog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  selectedAssets: any;
}

/**
 * Botão "Atualizar catálogo agora" + indicador do último sync.
 * Aparece no card 'Catálogos' em Integrações Meta quando ativo.
 */
export function MetaCatalogSyncStatus({ selectedAssets }: Props) {
  const { catalogItems, isLoadingItems, syncProducts, isSyncing } = useMetaCatalog();

  const catalogId: string | null =
    selectedAssets?.catalog?.id ||
    selectedAssets?.catalog_id ||
    selectedAssets?.catalogs?.[0]?.id ||
    null;

  const stats = useMemo(() => {
    if (!catalogId) return { total: 0, synced: 0, errors: 0, lastSync: null as string | null };
    const items = catalogItems.filter((i) => i.catalog_id === catalogId);
    const synced = items.filter((i) => i.status === "synced").length;
    const errors = items.filter((i) => i.status === "error").length;
    const lastSync = items
      .map((i) => i.last_synced_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;
    return { total: items.length, synced, errors, lastSync };
  }, [catalogItems, catalogId]);

  if (!catalogId) return null;

  const handleSync = () => syncProducts({ catalogId });

  return (
    <div className="mt-2 ml-7 pl-3 border-l-2 border-primary/20 py-2 flex items-center justify-between gap-3 flex-wrap">
      <div className="text-xs text-muted-foreground space-y-0.5">
        {isLoadingItems ? (
          <span>Carregando status do catálogo...</span>
        ) : stats.total === 0 ? (
          <span>Nenhum produto sincronizado ainda neste catálogo.</span>
        ) : (
          <>
            <div>
              {stats.synced} sincronizado(s)
              {stats.errors > 0 && <span className="text-amber-600"> · {stats.errors} com erro</span>}
            </div>
            {stats.lastSync && (
              <div>
                Último envio {formatDistanceToNow(new Date(stats.lastSync), { addSuffix: true, locale: ptBR })}
              </div>
            )}
          </>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing} className="gap-1.5">
        {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Atualizar agora
      </Button>
    </div>
  );
}
