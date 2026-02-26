import { useState, useMemo } from "react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  Sparkles,
  FileText,
  Tags,
  PackagePlus,
} from "lucide-react";
import { useMeliListings, type MeliListing } from "@/hooks/useMeliListings";
import { useProductsWithImages } from "@/hooks/useProducts";
import { MeliListingWizard } from "@/components/marketplaces/MeliListingWizard";
import { MeliListingCreator } from "@/components/marketplaces/MeliListingCreator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color?: string }> = {
  draft: { label: "Rascunho", variant: "outline" },
  ready: { label: "Pronto", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default", color: "bg-primary" },
  publishing: { label: "Publicando...", variant: "secondary" },
  published: { label: "Publicado", variant: "default", color: "bg-green-600" },
  paused: { label: "Pausado", variant: "secondary" },
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

  // Bulk operations state
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ processed: 0, total: 0, label: "" });

  const listedProductIds = new Set(listings.map(l => l.product_id));

  const allSelected = listings.length > 0 && selectedIds.size === listings.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < listings.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listings.map(l => l.id)));
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
    const { id, ...rest } = data;
    updateListing.mutate({ id, ...rest }, {
      onSuccess: () => setEditingListing(null),
    });
  };

  const handleEditListing = async (listing: MeliListing) => {
    const attrs = listing.attributes || [];
    let categoryName = listing.category_id || "";
    
    // Resolve category name from ML API
    if (listing.category_id && currentTenant?.id) {
      try {
        const { data } = await supabase.functions.invoke("meli-search-categories", {
          body: { tenantId: currentTenant.id, categoryId: listing.category_id },
        });
        if (data?.success && data.path?.length) {
          categoryName = data.path.map((p: any) => p.name).join(" > ");
        } else if (data?.success && data.categories?.[0]?.name) {
          categoryName = data.categories[0].name;
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
    const ok = await confirmAction({
      title: "Remover anúncio",
      description: "Tem certeza que deseja remover este anúncio? Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      variant: "destructive",
    });
    if (ok) deleteListing.mutate(id);
  };

  const handleBulkDelete = async () => {
    const deletableIds = Array.from(selectedIds).filter(id => {
      const listing = listings.find(l => l.id === id);
      return listing && !['published', 'publishing'].includes(listing.status);
    });
    if (deletableIds.length === 0) {
      toast.error("Nenhum anúncio selecionado pode ser excluído (apenas rascunhos/aprovados/erros).");
      return;
    }
    const ok = await confirmAction({
      title: "Excluir anúncios",
      description: `Excluir ${deletableIds.length} anúncio${deletableIds.length > 1 ? "s" : ""}? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    bulkDeleteListings.mutate(deletableIds);
    setSelectedIds(new Set());
  };

  const handleApprove = (id: string) => approveListing.mutate(id);

  const handleBulkSend = async () => {
    // Sendable: draft, ready, approved, error (exclude published/publishing/paused)
    const sendableIds = Array.from(selectedIds).filter(id => {
      const listing = listings.find(l => l.id === id);
      return listing && ['draft', 'ready', 'approved', 'error'].includes(listing.status);
    });
    if (sendableIds.length === 0) {
      toast.error("Nenhum anúncio selecionado pode ser enviado.");
      return;
    }
    const draftsToApprove = sendableIds.filter(id => {
      const listing = listings.find(l => l.id === id);
      return listing && ['draft', 'ready'].includes(listing.status);
    });
    const description = draftsToApprove.length > 0
      ? `Enviar ${sendableIds.length} anúncio${sendableIds.length > 1 ? "s" : ""} ao Mercado Livre? (${draftsToApprove.length} rascunho${draftsToApprove.length > 1 ? "s" : ""} será${draftsToApprove.length > 1 ? "ão" : ""} aprovado${draftsToApprove.length > 1 ? "s" : ""} automaticamente)`
      : `Enviar ${sendableIds.length} anúncio${sendableIds.length > 1 ? "s" : ""} ao Mercado Livre?`;
    const ok = await confirmAction({
      title: "Enviar anúncios",
      description,
      confirmLabel: "Enviar",
      variant: "default",
    });
    if (!ok) return;
    setBulkAction("bulk_send");
    const total = sendableIds.length;
    setBulkProgress({ processed: 0, total, label: "Enviando anúncios..." });

    // Batch-approve drafts silently (single DB call, no individual toasts)
    if (draftsToApprove.length > 0) {
      try {
        await supabase
          .from('meli_listings')
          .update({ status: 'approved' as const })
          .in('id', draftsToApprove);
      } catch { /* continue */ }
    }

    // Publish sequentially (edge function calls) - track results for summary toast
    let successCount = 0;
    let errorCount = 0;
    for (const id of sendableIds) {
      try {
        const { data, error } = await supabase.functions.invoke('meli-publish-listing', {
          body: {
            tenantId: currentTenant?.id,
            listingId: id,
          },
        });
        if (error || !data?.success) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch {
        errorCount++;
      }
      setBulkProgress({ processed: successCount + errorCount, total, label: "Enviando anúncios..." });
    }

    // Single summary toast
    if (successCount > 0) {
      toast.success(`${successCount} anúncio${successCount > 1 ? "s" : ""} enviado${successCount > 1 ? "s" : ""} para publicação!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} anúncio${errorCount > 1 ? "s" : ""} com erro ao publicar`);
    }
    setSelectedIds(new Set());
    setBulkAction(null);
    setBulkProgress({ processed: 0, total: 0, label: "" });
    refetch();
  };

  const isActionLoading = (id: string) => actionLoadingId === id && publishListing.isPending;

  // Bulk operation runner
  const runBulkOperation = async (action: string, label: string) => {
    if (!currentTenant?.id) return;
    const selectedCount = selectedIds.size;
    const confirmMsg = selectedCount > 0
      ? `Executar "${label}" nos ${selectedCount} anúncios selecionados?`
      : `Executar "${label}" em todos os anúncios? Isso pode levar alguns minutos.`;
    const ok = await confirmAction({
      title: label,
      description: confirmMsg,
      confirmLabel: "Executar",
      variant: "warning",
    });
    if (!ok) return;

    const listingIds = selectedCount > 0 ? Array.from(selectedIds) : undefined;

    setBulkAction(action);
    setBulkProgress({ processed: 0, total: 0, label });
    let offset = 0;
    const limit = 5;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let allErrors: string[] = [];

    try {
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("meli-bulk-operations", {
          body: { tenantId: currentTenant.id, action, offset, limit, listingIds },
        });
        if (error || !data?.success) {
          toast.error(data?.error || "Erro na operação em massa");
          break;
        }
        totalProcessed += data.processed || 0;
        totalUpdated += (data.updated || data.created || 0);
        allErrors = [...allErrors, ...(data.errors || [])];
        hasMore = data.hasMore;
        offset += limit;
        setBulkProgress({ processed: totalProcessed, total: data.totalProducts || totalProcessed, label });
      }

      if (allErrors.length > 0) {
        toast.warning(`${label}: ${totalUpdated} processados, ${allErrors.length} erros`);
      } else {
        toast.success(`${label}: ${totalUpdated} processados com sucesso!`);
      }
      refetch();
      setSelectedIds(new Set());
    } catch {
      toast.error("Erro ao executar operação em massa");
    } finally {
      setBulkAction(null);
      setBulkProgress({ processed: 0, total: 0, label: "" });
    }
  };

  const bulkActions = [
    { key: "bulk_create", label: "Enviar Todos", desc: "Cria rascunhos para todos os produtos sem anúncio", icon: PackagePlus },
    { key: "bulk_generate_titles", label: "Gerar Títulos", desc: "IA gera títulos otimizados para o ML", icon: Sparkles },
    { key: "bulk_generate_descriptions", label: "Gerar Descrições", desc: "IA converte descrições para texto plano", icon: FileText },
    { key: "bulk_auto_categories", label: "Auto-Categorizar", desc: "Identifica categorias automaticamente", icon: Tags },
  ];

  const [isSyncing, setIsSyncing] = useState(false);
  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await syncListings.mutateAsync(undefined);
    } finally {
      setIsSyncing(false);
    }
  };

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
            </div>
            <div className="flex gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={handleSyncAll} disabled={isSyncing || !!bulkAction}>
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sincronizar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sincroniza o status dos anúncios com o Mercado Livre</TooltipContent>
              </Tooltip>
              <Button onClick={() => setShowCreator(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Anúncio
              </Button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {listings.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">AÇÕES EM MASSA</p>
                {selectedIds.size > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {bulkActions.map((ba) => {
                  const Icon = ba.icon;
                  const isRunning = bulkAction === ba.key;
                  return (
                    <Tooltip key={ba.key}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runBulkOperation(ba.key, ba.label)}
                          disabled={!!bulkAction}
                          className="gap-1.5"
                        >
                          {isRunning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Icon className="h-3.5 w-3.5" />
                          )}
                          {ba.label}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">{ba.desc}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {selectedIds.size > 0 && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkSend}
                          disabled={!!bulkAction}
                          className="gap-1.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Enviar Selecionados
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">Aprova e publica os anúncios selecionados no Mercado Livre</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkDelete}
                          disabled={!!bulkAction}
                          className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir Selecionados
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="text-xs">Remove os anúncios selecionados (exceto publicados)</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
              {bulkAction && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{bulkProgress.label}</span>
                    <span>{bulkProgress.processed} / {bulkProgress.total || "?"}</span>
                  </div>
                  <Progress
                    value={bulkProgress.total > 0 ? (bulkProgress.processed / bulkProgress.total) * 100 : 30}
                    className="h-1.5"
                  />
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Nenhum anúncio preparado</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">
                Selecione um produto e a IA preencherá título, descrição e categoria automaticamente.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
                <Button onClick={() => setShowCreator(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Anúncio
                </Button>
                <Button
                  variant="outline"
                  onClick={() => runBulkOperation("bulk_create", "Enviar Todos")}
                  disabled={!!bulkAction}
                >
                  <PackagePlus className="h-4 w-4 mr-2" />
                  Enviar Todos os Produtos
                </Button>
              </div>
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
                {listings.map((listing) => {
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
                        <Badge variant={statusInfo.variant} className={statusInfo.color || ""}>
                          {statusInfo.label}
                        </Badge>
                        {listing.error_message && (
                          <p className="text-xs text-destructive mt-1 max-w-[180px] truncate" title={listing.error_message}>
                            {listing.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {['draft', 'ready', 'approved', 'error'].includes(listing.status) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleEditListing(listing)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
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
                          {!['published', 'publishing'].includes(listing.status) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(listing.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remover</TooltipContent>
                            </Tooltip>
                          )}
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
      {ConfirmDialog}
    </TooltipProvider>
  );
}
