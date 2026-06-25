import { useState, useMemo, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMeliConnection } from "@/hooks/useMeliConnection";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Package,
  Plus,
  CheckCircle2,
  Send,
  Trash2,
  Edit,
  Eye,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useMeliListings, type MeliListing } from "@/hooks/useMeliListings";
import { useProductsWithImages } from "@/hooks/useProducts";
import { MeliListingWizard } from "@/components/marketplaces/MeliListingWizard";
import { MeliListingCreator } from "@/components/marketplaces/MeliListingCreator";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Detecta se o erro de uma pendência tem origem em campo faltando no cadastro
 * do produto. Quando verdadeiro, exibimos o atalho "Abrir cadastro do produto".
 */
function pendencyNeedsProductCadastro(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) return false;
  const m = String(errorMessage).toLowerCase();
  return (
    m.includes("cadastro do produto") ||
    m.includes("missing_required_attributes") ||
    m.includes("marca") ||
    m.includes("brand") ||
    m.includes("gtin") ||
    m.includes("ean")
  );
}


const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color?: string }> = {
  draft: { label: "Rascunho", variant: "outline" },
  ready: { label: "Pronto", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default", color: "bg-primary" },
  publishing: { label: "Publicando...", variant: "secondary" },
  published: { label: "Publicado", variant: "default", color: "bg-green-600" },
  paused: { label: "Pausado", variant: "secondary" },
  inactive: { label: "Inativo", variant: "outline", color: "border-muted-foreground/40 text-muted-foreground" },
  error: { label: "Erro", variant: "destructive" },
};

const LISTING_TYPES: Record<string, string> = {
  gold_special: "Clássico",
  gold_pro: "Premium",
  gold: "Gold",
  free: "Grátis",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function MeliListingsTab() {
  const { currentTenant } = useAuth();
  const { listings, isLoading, createListing, createBulkListings, updateListing, deleteListing, bulkDeleteListings, bulkApproveListings, approveListing, publishListing, syncListings, refetch } = useMeliListings();
  const { products, isLoading: productsLoading } = useProductsWithImages();

  const [showCreator, setShowCreator] = useState(false);
  const [editingListing, setEditingListing] = useState<MeliListing | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfigure, setShowBulkConfigure] = useState(false);

  // Tabs: drafts (default) | published | pending | inactive
  type TabKey = 'drafts' | 'published' | 'pending' | 'inactive';
  const [activeTab, setActiveTab] = useState<TabKey>('drafts');

  const listedProductIds = new Set(listings.map(l => l.product_id));

  const queryClient = useQueryClient();

  // Revalidação automática quando o lojista volta para esta aba do navegador
  // (ex.: depois de corrigir o cadastro de um produto em outra aba via atalho
  // "Abrir cadastro do produto"). Custo zero: só reaproveita o cache do React
  // Query e dispara um refetch local.
  useEffect(() => {
    const handleRevalidate = () => {
      if (document.visibilityState !== 'visible') return;
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
    };
    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);
    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
    };
  }, [queryClient, currentTenant?.id]);

  // Sincronização em tempo real: escuta mudanças na tabela meli_listings
  // disparadas pelo webhook do Mercado Livre. Cancela na desmontagem e
  // pausa quando a aba do navegador fica oculta para não consumir canais.
  useEffect(() => {
    if (!currentTenant?.id) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    const subscribe = () => {
      if (!mounted || channel) return;
      channel = supabase
        .channel(`meli-listings-${currentTenant.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'meli_listings', filter: `tenant_id=eq.${currentTenant.id}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
            queryClient.invalidateQueries({ queryKey: ['meli-connection-status'] });
          },
        )
        .subscribe();
    };

    const unsubscribe = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') subscribe();
      else unsubscribe();
    };

    subscribe();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
    };
  }, [currentTenant?.id, queryClient]);

  const draftsCount = listings.filter(l => ['draft', 'ready', 'approved'].includes(l.status)).length;
  const publishedCount = listings.filter(l => ['published', 'paused'].includes(l.status)).length;
  const pendingCount = listings.filter(l => ['error', 'publishing'].includes(l.status)).length;
  const inactiveCount = listings.filter(l => l.status === 'inactive').length;

  const filteredListings = useMemo(() => {
    if (activeTab === 'drafts') return listings.filter(l => ['draft', 'ready', 'approved'].includes(l.status));
    if (activeTab === 'published') return listings.filter(l => ['published', 'paused'].includes(l.status));
    if (activeTab === 'inactive') return listings.filter(l => l.status === 'inactive');
    return listings.filter(l => ['error', 'publishing'].includes(l.status));
  }, [listings, activeTab]);


  // Selection scoped to currently visible tab
  const allSelected = filteredListings.length > 0 && filteredListings.every(l => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredListings.map(l => l.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Removed: handleCreateSubmit (now handled by MeliListingCreator)

  const handleEditSubmit = (data: any) => {
    const { id, action, ...rest } = data;
    // First save to DB
    updateListing.mutate({ id, ...rest }, {
      onSuccess: () => {
        setEditingListing(null);
        // If post-publication edit, also push changes to ML via edge function
        if (action === "update") {
          publishListing.mutate({ id, action: "update" });
        }
      },
    });
  };

  const handleEditListing = async (listing: MeliListing) => {
    const attrs = listing.attributes || [];
    let categoryName = listing.category_path_text || listing.category_name || listing.category_id || "";

    // Only hit ML if no friendly name was ever persisted on this listing (legacy backfill).
    if (!listing.category_path_text && !listing.category_name && listing.category_id && currentTenant?.id) {
      try {
        const { data } = await supabase.functions.invoke("meli-search-categories", {
          body: { tenantId: currentTenant.id, categoryId: listing.category_id },
        });
        let resolvedPath = "";
        let resolvedName = "";
        if (data?.success && data.path?.length) {
          resolvedPath = data.path.map((p: any) => p.name).join(" > ");
        }
        if (data?.success && data.categories?.[0]?.name) {
          resolvedName = data.categories[0].name;
        }
        categoryName = resolvedPath || resolvedName || listing.category_id;
        // Persist so we never re-fetch for this listing again.
        if (resolvedPath || resolvedName) {
          try {
            await supabase
              .from("meli_listings")
              .update({
                category_name: resolvedName || null,
                category_path_text: resolvedPath || null,
              })
              .eq("id", listing.id);
          } catch { /* skip */ }
        }
      } catch {
        categoryName = listing.category_id;
      }
    }

    // Get GTIN and brand: first from listing attributes, then fallback from product data
    let brand = attrs.find((a: any) => a.id === "BRAND")?.value_name || "";
    let gtin = attrs.find((a: any) => a.id === "GTIN")?.value_name || "";
    
    // If not in attributes, fetch from product record
    if ((!brand || !gtin) && listing.product_id) {
      try {
        const { data: productData } = await supabase
          .from("products")
          .select("brand, gtin, barcode")
          .eq("id", listing.product_id)
          .single();
        if (productData) {
          if (!brand && productData.brand) brand = productData.brand;
          if (!gtin) gtin = productData.gtin || productData.barcode || "";
        }
      } catch { /* skip */ }
    }

    setEditingListing({
      ...listing,
      ...(({
        brand,
        gtin,
        warranty: attrs.find((a: any) => a.id === "WARRANTY_TYPE")?.value_name || "",
        categoryName,
      }) as any),
    });
  };

  const { confirm: confirmAction, ConfirmDialog } = useConfirmDialog();

  const handlePublish = async (listing: MeliListing) => {
    const ok = await confirmAction({
      title: "Publicar anúncio",
      description: "Publicar este anúncio no Mercado Livre?",
      confirmLabel: "Publicar",
      variant: "default",
    });
    if (ok) {
      setActionLoadingId(listing.id);
      publishListing.mutate({ id: listing.id }, { onSettled: () => setActionLoadingId(null) });
    }
  };

  const handlePause = (listing: MeliListing) => {
    setActionLoadingId(listing.id);
    publishListing.mutate({ id: listing.id, action: "pause" }, { onSettled: () => setActionLoadingId(null) });
  };

  const handleActivate = (listing: MeliListing) => {
    setActionLoadingId(listing.id);
    publishListing.mutate({ id: listing.id, action: "activate" }, { onSettled: () => setActionLoadingId(null) });
  };

  const handleSyncUpdate = (listing: MeliListing) => {
    setActionLoadingId(listing.id);
    publishListing.mutate({ id: listing.id, action: "update" }, { onSettled: () => setActionLoadingId(null) });
  };

  const handleDelete = async (id: string) => {
    const listing = listings.find(l => l.id === id);
    const isPublishedOnML = !!listing?.meli_item_id && ['published', 'paused', 'publishing'].includes(listing?.status || '');
    const description = isPublishedOnML
      ? "Este anúncio será desativado (finalizado) no Mercado Livre — sai do ar e o link público para de funcionar. O Mercado Livre não permite exclusão definitiva de anúncios já publicados; ele fica apenas no histórico interno do ML. Aqui no sistema o anúncio será removido. Deseja continuar?"
      : "Tem certeza que deseja remover este anúncio? Esta ação não pode ser desfeita.";
    const ok = await confirmAction({
      title: isPublishedOnML ? "Desativar no Mercado Livre e remover daqui" : "Remover anúncio",
      description,
      confirmLabel: isPublishedOnML ? "Desativar no ML e remover" : "Remover",
      variant: "destructive",
    });
    if (ok) deleteListing.mutate(id);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const items = ids.map(id => listings.find(l => l.id === id)).filter(Boolean) as MeliListing[];
    const publishedCount = items.filter(l => l.meli_item_id && ['published', 'paused', 'publishing'].includes(l.status)).length;
    const description = publishedCount > 0
      ? `Você está prestes a remover ${ids.length} anúncio${ids.length > 1 ? "s" : ""}. ${publishedCount} ${publishedCount > 1 ? "estão publicados" : "está publicado"} no Mercado Livre e ${publishedCount > 1 ? "serão desativados (finalizados) lá" : "será desativado (finalizado) lá"} — saem do ar e os links públicos param de funcionar. O Mercado Livre não permite exclusão definitiva de anúncios publicados; eles ficam apenas no histórico interno do ML. Aqui no sistema serão removidos.`
      : `Excluir ${ids.length} anúncio${ids.length > 1 ? "s" : ""}? Esta ação não pode ser desfeita.`;
    const ok = await confirmAction({
      title: publishedCount > 0 ? "Desativar no Mercado Livre e remover daqui" : "Excluir anúncios",
      description,
      confirmLabel: publishedCount > 0 ? "Desativar no ML e remover" : "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    bulkDeleteListings.mutate(ids);
    setSelectedIds(new Set());
  };


  const handleApprove = (id: string) => approveListing.mutate(id);

  const isActionLoading = (id: string) => actionLoadingId === id && publishListing.isPending;

  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await syncListings.mutateAsync(undefined);
    } finally {
      setIsSyncing(false);
    }
  };

  // Indicador de frescor + selo de sincronização em tempo real.
  const { connection, refetch: refetchConnection } = useMeliConnection();
  const lastSyncAt = connection?.lastSyncAt ? new Date(connection.lastSyncAt) : null;
  const lastWebhookAt = connection?.lastWebhookAt ? new Date(connection.lastWebhookAt) : null;
  // Selo verde se recebemos qualquer sinal do ML na última 1h.
  const realtimeFresh = !!lastWebhookAt && (Date.now() - lastWebhookAt.getTime()) < 60 * 60 * 1000;
  const lastSignalAt = lastWebhookAt && lastSyncAt
    ? (lastWebhookAt > lastSyncAt ? lastWebhookAt : lastSyncAt)
    : (lastWebhookAt || lastSyncAt);
  const lastSyncLabel = lastSignalAt
    ? `Última atualização ${formatDistanceToNow(lastSignalAt, { addSuffix: true, locale: ptBR })}`
    : "Ainda não sincronizado";


  const autoSyncDoneRef = useRef(false);
  useEffect(() => {
    if (autoSyncDoneRef.current) return;
    if (!currentTenant?.id) return;
    // Dispara sync silencioso só se passou mais de 10 min do último (ou nunca sincronizou).
    const stale = !lastSyncAt || (Date.now() - lastSyncAt.getTime()) > 10 * 60 * 1000;
    if (!stale) return;
    autoSyncDoneRef.current = true;
    syncListings.mutateAsync(undefined).then(() => refetchConnection()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id, lastSyncAt?.getTime()]);


  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Anúncios do Mercado Livre
              </CardTitle>
              <CardDescription className="mt-1">
                Prepare, revise e publique seus produtos no ML
              </CardDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${
                        realtimeFresh
                          ? "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          realtimeFresh ? "bg-green-600" : "bg-amber-500"
                        } ${realtimeFresh ? "animate-pulse" : ""}`}
                      />
                      {realtimeFresh
                        ? "Sincronizado em tempo real com o Mercado Livre"
                        : "Sem sinal recente do Mercado Livre"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {realtimeFresh
                      ? "Mudanças feitas no painel do Mercado Livre aparecem aqui em segundos."
                      : "Sem sinal recente do ML. A reconciliação diária às 5h cobre qualquer divergência. Use Sincronizar para forçar agora."}
                  </TooltipContent>
                </Tooltip>
                <span className="text-muted-foreground">{lastSyncLabel}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={async () => { await handleSyncAll(); await refetchConnection(); }} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sincronizar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Força uma reconciliação imediata com o Mercado Livre</TooltipContent>
              </Tooltip>
              <Button onClick={() => setShowCreator(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Anúncio
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabKey); setSelectedIds(new Set()); }}>
              <TabsList>
                <TabsTrigger value="drafts" className="gap-2">
                  Rascunhos
                  {draftsCount > 0 && <Badge variant="secondary" className="text-xs">{draftsCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="published" className="gap-2">
                  Publicados
                  {publishedCount > 0 && <Badge variant="secondary" className="text-xs">{publishedCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                  Pendências
                  {pendingCount > 0 && <Badge variant="destructive" className="text-xs">{pendingCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="inactive" className="gap-2">
                  Inativos
                  {inactiveCount > 0 && <Badge variant="outline" className="text-xs">{inactiveCount}</Badge>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>



          {/* Bulk actions bar — only when something is selected */}
          {selectedIds.size > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 border flex items-center justify-between gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
              </Badge>
              <div className="flex flex-wrap gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setShowBulkConfigure(true)} className="gap-1.5">
                      <Settings2 className="h-3.5 w-3.5" />
                      Editar em Lote
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Reabre o assistente com os anúncios selecionados. Na última etapa, atualiza os anúncios já publicados no Mercado Livre.</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteListings.isPending} className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                      {bulkDeleteListings.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {bulkDeleteListings.isPending ? "Excluindo..." : "Excluir Selecionados"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Remove os selecionados. Publicados são encerrados no Mercado Livre de forma definitiva.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {activeTab === 'drafts' && (
                <>
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="font-medium">Nenhum rascunho em andamento</p>
                  <p className="text-sm mt-1 max-w-sm mx-auto">
                    Crie um novo anúncio. A IA preenche título, descrição e categoria automaticamente.
                  </p>
                  <div className="flex justify-center mt-4">
                    <Button onClick={() => setShowCreator(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Anúncio
                    </Button>
                  </div>
                </>
              )}
              {activeTab === 'published' && (
                <>
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="font-medium">Nenhum anúncio publicado</p>
                  <p className="text-sm mt-1">Os anúncios ativos no Mercado Livre aparecem aqui.</p>
                </>
              )}
              {activeTab === 'pending' && (
                <>
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="font-medium">Nenhuma pendência</p>
                  <p className="text-sm mt-1">Anúncios com erro ou que precisam de revisão aparecem aqui.</p>
                </>
              )}
              {activeTab === 'inactive' && (
                <>
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="font-medium">Nenhum anúncio inativo</p>
                  <p className="text-sm mt-1 max-w-sm mx-auto">
                    Anúncios finalizados no Mercado Livre (encerrados, expirados ou sem estoque) ficam preservados aqui para consulta.
                  </p>
                </>
              )}

            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                      {...(someSelected ? { "data-state": "indeterminate" } : {})}
                    />
                  </TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Título ML</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListings.map((listing) => {
                  const statusInfo = STATUS_MAP[listing.status] || STATUS_MAP.draft;
                  const loading = isActionLoading(listing.id);
                  return (
                    <TableRow key={listing.id} className={selectedIds.has(listing.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(listing.id)}
                          onCheckedChange={() => toggleSelect(listing.id)}
                          aria-label={`Selecionar ${listing.product?.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {listing.primary_image_url ? (
                            <img src={listing.primary_image_url} alt="" className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{listing.product?.name || "-"}</p>
                            <p className="text-xs text-muted-foreground">{listing.product?.sku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{listing.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {LISTING_TYPES[listing.listing_type] || listing.listing_type}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(listing.price))}</TableCell>
                      <TableCell>{listing.available_quantity}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={statusInfo.variant} className={statusInfo.color || ""}>
                            {statusInfo.label}
                          </Badge>
                          {listing.last_status_change_source && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  aria-label="Origem da última alteração"
                                  className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-semibold ${
                                    listing.last_status_change_source === 'meli'
                                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                      : "bg-primary/15 text-primary"
                                  }`}
                                >
                                  {listing.last_status_change_source === 'meli' ? 'ML' : '•'}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {listing.last_status_change_source === 'meli'
                                  ? `Última alteração veio do Mercado Livre${
                                      listing.last_status_change_at
                                        ? ` ${formatDistanceToNow(new Date(listing.last_status_change_at), { addSuffix: true, locale: ptBR })}`
                                        : ''
                                    }.`
                                  : `Última alteração feita aqui no sistema${
                                      listing.last_status_change_at
                                        ? ` ${formatDistanceToNow(new Date(listing.last_status_change_at), { addSuffix: true, locale: ptBR })}`
                                        : ''
                                    }.`}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {listing.status === 'inactive' && listing.inactive_reason && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                            {listing.inactive_reason}
                          </p>
                        )}
                        {listing.error_message && (() => {
                          const raw = String(listing.error_message);
                          const friendly = /address_pending|unable_to_list/i.test(raw)
                            ? "Cadastre um endereço de retirada na sua conta do Mercado Livre (Minha conta → Endereços) e tente novamente."
                            : raw;
                          return (
                            <p className="text-xs text-destructive mt-1 max-w-[220px]" title={raw}>
                              {friendly}
                            </p>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {activeTab === 'pending' && pendencyNeedsProductCadastro(listing.error_message) && listing.product_id && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => window.open(`/products?edit=${listing.product_id}`, '_blank', 'noopener')}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Abrir cadastro
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir o cadastro do produto em uma nova aba para completar os dados que faltam</TooltipContent>
                            </Tooltip>
                          )}
                          {['draft', 'ready', 'approved', 'error', 'published', 'paused'].includes(listing.status) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleEditListing(listing)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {['published', 'paused'].includes(listing.status) ? 'Editar (título, preço, estoque, descrição, imagens)' : 'Editar'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {['draft', 'ready'].includes(listing.status) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleApprove(listing.id)}>
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Aprovar</TooltipContent>
                            </Tooltip>
                          )}
                          {(listing.status === 'approved' || listing.status === 'error') && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handlePublish(listing)} disabled={loading}>
                                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className={`h-4 w-4 ${listing.status === 'error' ? 'text-destructive' : 'text-primary'}`} />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{listing.status === 'error' ? "Tentar novamente" : "Publicar"}</TooltipContent>
                            </Tooltip>
                          )}
                          {listing.status === 'published' && listing.meli_item_id && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => window.open(listing.meli_response?.permalink || `https://www.mercadolivre.com.br/p/${listing.meli_item_id}`, '_blank')}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver no ML</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleSyncUpdate(listing)} disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Sincronizar</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handlePause(listing)} disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4 text-amber-500" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Pausar</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                          {listing.status === 'paused' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleActivate(listing)} disabled={loading}>
                                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-green-500" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reativar</TooltipContent>
                            </Tooltip>
                          )}
                          {listing.status === 'inactive' && listing.meli_item_id && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => window.open(listing.meli_response?.permalink || `https://www.mercadolivre.com.br/p/${listing.meli_item_id}`, '_blank')}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver no Mercado Livre (histórico)</TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(listing.id)} disabled={deleteListing.isPending && deleteListing.variables === listing.id}>
                                {deleteListing.isPending && deleteListing.variables === listing.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{['published', 'paused', 'publishing'].includes(listing.status) ? 'Desativar no ML e remover daqui' : 'Remover'}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog (multi-product) */}
      <MeliListingCreator
        open={showCreator}
        onOpenChange={setShowCreator}
        products={products}
        productsLoading={productsLoading}
        listedProductIds={listedProductIds}
        onBulkCreate={async (data) => {
          return new Promise((resolve, reject) => {
            createBulkListings.mutate(data, {
              onSuccess: (result) => resolve(result),
              onError: (error) => reject(error),
            });
          });
        }}
        isSubmitting={createBulkListings.isPending}
        onRefetch={refetch}
      />

      {/* Edit Wizard */}
      <MeliListingWizard
        open={!!editingListing}
        onOpenChange={(open) => { if (!open) setEditingListing(null); }}
        products={products}
        productsLoading={productsLoading}
        listedProductIds={listedProductIds}
        onSubmit={handleEditSubmit}
        isSubmitting={updateListing.isPending}
        mode="edit"
        initialData={editingListing}
      />
      {/* Configure existing drafts — reuses the same 7-step wizard, starting at Categories */}
      <MeliListingCreator
        open={showBulkConfigure}
        onOpenChange={(o) => { if (!o) setShowBulkConfigure(false); }}
        products={products}
        productsLoading={productsLoading}
        listedProductIds={listedProductIds}
        onBulkCreate={async () => []}
        isSubmitting={false}
        onRefetch={() => {
          refetch();
          setSelectedIds(new Set());
        }}
        existingDrafts={showBulkConfigure ? listings.filter((l) => selectedIds.has(l.id)).map((l) => ({
          id: l.id,
          product_id: l.product_id,
          title: l.title,
          description: l.description,
          category_id: l.category_id,
          category_name: l.category_name,
          category_path_text: l.category_path_text,
          condition: l.condition,
          listing_type: l.listing_type,
          shipping: l.shipping,
          price: l.price,
          product: l.product ? { name: l.product.name, price: l.product.price } : null,
          status: l.status,
          meli_item_id: l.meli_item_id,
        })) : undefined}
      />

      {ConfirmDialog}
    </TooltipProvider>

  );
}