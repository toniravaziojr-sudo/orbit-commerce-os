import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Package,
  Plus,
  CheckCircle2,
  Send,
  Trash2,
  Edit,
  Eye,
  AlertCircle,
  Search,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useMeliListings, type MeliListing } from "@/hooks/useMeliListings";
import { useProductsWithImages, type ProductWithImage } from "@/hooks/useProducts";
import { MeliCategoryPicker } from "@/components/marketplaces/MeliCategoryPicker";
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
  gold_special: "Clássico (Gold Special)",
  gold_pro: "Premium (Gold Pro)",
  gold: "Gold",
  free: "Grátis",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function MeliListingsTab() {
  const { listings, isLoading, createListing, updateListing, deleteListing, approveListing, publishListing } = useMeliListings();
  const { products, isLoading: productsLoading } = useProductsWithImages();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingListing, setEditingListing] = useState<MeliListing | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithImage | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formQuantity, setFormQuantity] = useState("1");
  const [formListingType, setFormListingType] = useState("gold_special");
  const [formCondition, setFormCondition] = useState("new");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formCategoryName, setFormCategoryName] = useState("");
  const [formGtin, setFormGtin] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formWarranty, setFormWarranty] = useState("");
  const [formFreeShipping, setFormFreeShipping] = useState(false);
  const [formLocalPickup, setFormLocalPickup] = useState(false);

  // Products that don't have listings yet
  const listedProductIds = new Set(listings.map(l => l.product_id));
  const availableProducts = products.filter(p => !listedProductIds.has(p.id));
  const filteredProducts = availableProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSelectProduct = (product: ProductWithImage) => {
    setSelectedProduct(product);
    setFormTitle(product.name.slice(0, 60));
    setFormDescription(product.description || "");
    setFormPrice(String(product.price));
    setFormQuantity(String(product.stock_quantity || 1));
    setFormBrand((product as any).brand || "");
    setFormGtin((product as any).gtin || (product as any).ean || "");
  };

  const buildAttributes = () => {
    const attrs: any[] = [];
    if (formBrand) attrs.push({ id: "BRAND", value_name: formBrand });
    if (formGtin) attrs.push({ id: "GTIN", value_name: formGtin });
    return attrs;
  };

  const buildShipping = () => ({
    mode: "me2",
    local_pick_up: formLocalPickup,
    free_shipping: formFreeShipping,
  });

  const handleCreateListing = () => {
    if (!selectedProduct) return;
    createListing.mutate({
      product_id: selectedProduct.id,
      title: formTitle,
      description: formDescription || undefined,
      price: parseFloat(formPrice),
      available_quantity: parseInt(formQuantity) || 1,
      listing_type: formListingType,
      condition: formCondition,
      category_id: formCategoryId || undefined,
      images: selectedProduct.primary_image_url ? [{ url: selectedProduct.primary_image_url }] : [],
      attributes: buildAttributes(),
      shipping: buildShipping(),
    }, {
      onSuccess: () => {
        setShowCreateDialog(false);
        resetForm();
      },
    });
  };

  const handleEditListing = (listing: MeliListing) => {
    setEditingListing(listing);
    setFormTitle(listing.title);
    setFormDescription(listing.description || "");
    setFormPrice(String(listing.price));
    setFormQuantity(String(listing.available_quantity));
    setFormListingType(listing.listing_type);
    setFormCondition(listing.condition);
    setFormCategoryId(listing.category_id || "");
    // Extract attributes
    const attrs = listing.attributes || [];
    setFormBrand(attrs.find((a: any) => a.id === "BRAND")?.value_name || "");
    setFormGtin(attrs.find((a: any) => a.id === "GTIN")?.value_name || "");
    // Extract shipping
    const ship = listing.shipping || {};
    setFormFreeShipping(ship.free_shipping || false);
    setFormLocalPickup(ship.local_pick_up || false);
    setFormWarranty(attrs.find((a: any) => a.id === "WARRANTY_TYPE")?.value_name || "");
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editingListing) return;
    updateListing.mutate({
      id: editingListing.id,
      title: formTitle,
      description: formDescription,
      price: parseFloat(formPrice),
      available_quantity: parseInt(formQuantity) || 1,
      listing_type: formListingType,
      condition: formCondition,
      category_id: formCategoryId || null,
      attributes: buildAttributes(),
      shipping: buildShipping(),
    }, {
      onSuccess: () => {
        setShowEditDialog(false);
        setEditingListing(null);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setFormTitle("");
    setFormDescription("");
    setFormPrice("");
    setFormQuantity("1");
    setFormListingType("gold_special");
    setFormCondition("new");
    setFormCategoryId("");
    setFormCategoryName("");
    setFormGtin("");
    setFormBrand("");
    setFormWarranty("");
    setFormFreeShipping(false);
    setFormLocalPickup(false);
    setProductSearch("");
  };

  const handleApprove = (id: string) => {
    approveListing.mutate(id);
  };

  const handlePublish = (listing: MeliListing) => {
    if (confirm("Publicar este anúncio no Mercado Livre?")) {
      setActionLoadingId(listing.id);
      publishListing.mutate({ id: listing.id }, {
        onSettled: () => setActionLoadingId(null),
      });
    }
  };

  const handlePause = (listing: MeliListing) => {
    setActionLoadingId(listing.id);
    publishListing.mutate({ id: listing.id, action: "pause" }, {
      onSettled: () => setActionLoadingId(null),
    });
  };

  const handleActivate = (listing: MeliListing) => {
    setActionLoadingId(listing.id);
    publishListing.mutate({ id: listing.id, action: "activate" }, {
      onSettled: () => setActionLoadingId(null),
    });
  };

  const handleSyncUpdate = (listing: MeliListing) => {
    setActionLoadingId(listing.id);
    publishListing.mutate({ id: listing.id, action: "update" }, {
      onSettled: () => setActionLoadingId(null),
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Remover este anúncio?")) {
      deleteListing.mutate(id);
    }
  };

  const isActionLoading = (id: string) => actionLoadingId === id && publishListing.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Anúncios do Mercado Livre
              </CardTitle>
              <CardDescription>
                Prepare, revise e publique seus produtos como anúncios no Mercado Livre
              </CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Anúncio
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Nenhum anúncio preparado</p>
              <p className="text-sm mt-1">
                Selecione produtos da sua loja para criar anúncios no Mercado Livre.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Preparar Anúncio
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Título no ML</TableHead>
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
                    <TableRow key={listing.id}>
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
                          {/* Edit - available for all pre-publication statuses */}
                          {['draft', 'ready', 'approved', 'error'].includes(listing.status) && (
                            <Button variant="ghost" size="icon" onClick={() => handleEditListing(listing)} title="Editar">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Approve - only for draft/ready */}
                          {['draft', 'ready'].includes(listing.status) && (
                            <Button variant="ghost" size="icon" onClick={() => handleApprove(listing.id)} title="Aprovar">
                              <CheckCircle2 className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          {/* Publish - for approved or error (retry) */}
                          {(listing.status === 'approved' || listing.status === 'error') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePublish(listing)}
                              title={listing.status === 'error' ? "Tentar novamente" : "Publicar no ML"}
                              disabled={loading}
                            >
                              {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className={`h-4 w-4 ${listing.status === 'error' ? 'text-destructive' : 'text-primary'}`} />
                              )}
                            </Button>
                          )}
                          {/* Published actions */}
                          {listing.status === 'published' && listing.meli_item_id && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(`https://produto.mercadolivre.com.br/${listing.meli_item_id}`, '_blank')}
                                title="Ver no ML"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSyncUpdate(listing)}
                                title="Sincronizar preço/estoque"
                                disabled={loading}
                              >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handlePause(listing)}
                                title="Pausar anúncio"
                                disabled={loading}
                              >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4 text-amber-500" />}
                              </Button>
                            </>
                          )}
                          {/* Paused → reactivate */}
                          {listing.status === 'paused' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleActivate(listing)}
                              title="Reativar anúncio"
                              disabled={loading}
                            >
                              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-green-500" />}
                            </Button>
                          )}
                          {/* Delete - not published/publishing */}
                          {!['published', 'publishing'].includes(listing.status) && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(listing.id)} title="Remover">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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

      {/* Create Listing Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preparar Anúncio para o Mercado Livre</DialogTitle>
            <DialogDescription>
              Selecione um produto e configure os dados do anúncio.
            </DialogDescription>
          </DialogHeader>

          {!selectedProduct ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto por nome ou SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {productsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {availableProducts.length === 0
                      ? "Todos os produtos ativos já possuem anúncios."
                      : "Nenhum produto encontrado."}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {filteredProducts.slice(0, 20).map(product => (
                    <button
                      key={product.id}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 text-left transition-colors"
                      onClick={() => handleSelectProduct(product)}
                    >
                      {product.primary_image_url ? (
                        <img src={product.primary_image_url} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {product.sku} • Estoque: {product.stock_quantity}</p>
                      </div>
                      <span className="font-medium text-sm">{formatCurrency(product.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <ListingForm
              formTitle={formTitle} setFormTitle={setFormTitle}
              formDescription={formDescription} setFormDescription={setFormDescription}
              formPrice={formPrice} setFormPrice={setFormPrice}
              formQuantity={formQuantity} setFormQuantity={setFormQuantity}
              formListingType={formListingType} setFormListingType={setFormListingType}
              formCondition={formCondition} setFormCondition={setFormCondition}
              formCategoryId={formCategoryId} setFormCategoryId={(v, name) => { setFormCategoryId(v); if (name !== undefined) setFormCategoryName(name); }}
              formGtin={formGtin} setFormGtin={setFormGtin}
              formBrand={formBrand} setFormBrand={setFormBrand}
              formWarranty={formWarranty} setFormWarranty={setFormWarranty}
              formFreeShipping={formFreeShipping} setFormFreeShipping={setFormFreeShipping}
              formLocalPickup={formLocalPickup} setFormLocalPickup={setFormLocalPickup}
              selectedProduct={selectedProduct}
              onBack={() => setSelectedProduct(null)}
              productHtmlDescription={selectedProduct?.description || ""}
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            {selectedProduct && (
              <Button
                onClick={handleCreateListing}
                disabled={!formTitle || !formPrice || !formCategoryId || createListing.isPending}
              >
                {createListing.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : "Preparar Anúncio"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Listing Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Anúncio</DialogTitle>
            <DialogDescription>
              Ajuste os dados antes de aprovar e publicar.
            </DialogDescription>
          </DialogHeader>

          <ListingForm
            formTitle={formTitle} setFormTitle={setFormTitle}
            formDescription={formDescription} setFormDescription={setFormDescription}
            formPrice={formPrice} setFormPrice={setFormPrice}
            formQuantity={formQuantity} setFormQuantity={setFormQuantity}
            formListingType={formListingType} setFormListingType={setFormListingType}
            formCondition={formCondition} setFormCondition={setFormCondition}
            formCategoryId={formCategoryId} setFormCategoryId={(v, name) => { setFormCategoryId(v); if (name !== undefined) setFormCategoryName(name); }}
            formGtin={formGtin} setFormGtin={setFormGtin}
            formBrand={formBrand} setFormBrand={setFormBrand}
            formWarranty={formWarranty} setFormWarranty={setFormWarranty}
            formFreeShipping={formFreeShipping} setFormFreeShipping={setFormFreeShipping}
            formLocalPickup={formLocalPickup} setFormLocalPickup={setFormLocalPickup}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingListing(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={!formTitle || !formPrice || !formCategoryId || updateListing.isPending}>
              {updateListing.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              ) : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ Reusable Listing Form ============

interface ListingFormProps {
  formTitle: string; setFormTitle: (v: string) => void;
  formDescription: string; setFormDescription: (v: string) => void;
  formPrice: string; setFormPrice: (v: string) => void;
  formQuantity: string; setFormQuantity: (v: string) => void;
  formListingType: string; setFormListingType: (v: string) => void;
  formCondition: string; setFormCondition: (v: string) => void;
  formCategoryId: string; setFormCategoryId: (v: string, name?: string) => void;
  formGtin: string; setFormGtin: (v: string) => void;
  formBrand: string; setFormBrand: (v: string) => void;
  formWarranty: string; setFormWarranty: (v: string) => void;
  formFreeShipping: boolean; setFormFreeShipping: (v: boolean) => void;
  formLocalPickup: boolean; setFormLocalPickup: (v: boolean) => void;
  selectedProduct?: ProductWithImage | null;
  onBack?: () => void;
  productHtmlDescription?: string;
}

function ListingForm(props: ListingFormProps) {
  const { currentTenant } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    formTitle, setFormTitle,
    formDescription, setFormDescription,
    formPrice, setFormPrice,
    formQuantity, setFormQuantity,
    formListingType, setFormListingType,
    formCondition, setFormCondition,
    formCategoryId, setFormCategoryId,
    formGtin, setFormGtin,
    formBrand, setFormBrand,
    formWarranty, setFormWarranty,
    formFreeShipping, setFormFreeShipping,
    formLocalPickup, setFormLocalPickup,
    selectedProduct,
    onBack,
    productHtmlDescription,
  } = props;

  const handleGenerateDescription = async () => {
    const htmlSource = productHtmlDescription || formDescription;
    if (!htmlSource?.trim()) {
      toast.error("Nenhuma descrição disponível para converter.");
      return;
    }

    if (!currentTenant?.id) {
      toast.error("Tenant não identificado.");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("meli-generate-description", {
        body: {
          tenantId: currentTenant.id,
          htmlDescription: htmlSource,
          productName: selectedProduct?.name || "",
          productTitle: formTitle,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao gerar descrição");
        return;
      }

      setFormDescription(data.description);
      toast.success("Descrição gerada para o Mercado Livre!");
    } catch (err) {
      toast.error("Erro de conexão ao gerar descrição");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {selectedProduct && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          {selectedProduct.primary_image_url ? (
            <img src={selectedProduct.primary_image_url} alt="" className="h-12 w-12 rounded object-cover" />
          ) : (
            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <p className="font-medium">{selectedProduct.name}</p>
            <p className="text-xs text-muted-foreground">SKU: {selectedProduct.sku}</p>
          </div>
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Trocar
            </Button>
          )}
        </div>
      )}

      {/* Título */}
      <div className="space-y-2">
        <Label>Título do Anúncio *</Label>
        <Input
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          maxLength={60}
          placeholder="Título que aparecerá no Mercado Livre"
        />
        <p className="text-xs text-muted-foreground">{formTitle.length}/60 caracteres</p>
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Descrição</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateDescription}
            disabled={isGenerating || !(productHtmlDescription || formDescription)}
            className="gap-1.5"
          >
            {isGenerating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" />Gerar para ML</>
            )}
          </Button>
        </div>
        <Textarea
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="Descrição detalhada do produto (texto plano, sem HTML)..."
          rows={6}
        />
        <p className="text-xs text-muted-foreground">
          O ML aceita apenas texto plano. Use o botão "Gerar para ML" para converter automaticamente.
        </p>
      </div>

      {/* Preço + Quantidade */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Preço (R$) *</Label>
          <Input
            type="number"
            value={formPrice}
            onChange={(e) => setFormPrice(e.target.value)}
            min="0.01"
            step="0.01"
          />
        </div>
        <div className="space-y-2">
          <Label>Quantidade Disponível *</Label>
          <Input
            type="number"
            value={formQuantity}
            onChange={(e) => setFormQuantity(e.target.value)}
            min="1"
          />
        </div>
      </div>

      {/* Tipo + Condição */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Anúncio</Label>
          <Select value={formListingType} onValueChange={setFormListingType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gold_special">Clássico (Gold Special)</SelectItem>
              <SelectItem value="gold_pro">Premium (Gold Pro)</SelectItem>
              <SelectItem value="free">Grátis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Condição</Label>
          <Select value={formCondition} onValueChange={setFormCondition}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Novo</SelectItem>
              <SelectItem value="used">Usado</SelectItem>
              <SelectItem value="not_specified">Não especificado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Categoria ML */}
      <div className="space-y-2">
        <Label>Categoria do Mercado Livre *</Label>
        <MeliCategoryPicker
          value={formCategoryId}
          onChange={(id, name) => setFormCategoryId(id, name)}
        />
        {!formCategoryId && (
          <p className="text-xs text-destructive">
            Obrigatório. Selecione a categoria do produto no Mercado Livre.
          </p>
        )}
      </div>

      {/* Marca + GTIN/EAN */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Marca (BRAND)</Label>
          <Input
            value={formBrand}
            onChange={(e) => setFormBrand(e.target.value)}
            placeholder="Ex: Nike, Samsung..."
          />
        </div>
        <div className="space-y-2">
          <Label>GTIN / EAN / UPC</Label>
          <Input
            value={formGtin}
            onChange={(e) => setFormGtin(e.target.value)}
            placeholder="Código de barras do produto"
          />
          <p className="text-xs text-muted-foreground">Obrigatório para algumas categorias</p>
        </div>
      </div>

      {/* Garantia */}
      <div className="space-y-2">
        <Label>Garantia</Label>
        <Input
          value={formWarranty}
          onChange={(e) => setFormWarranty(e.target.value)}
          placeholder="Ex: 12 meses de garantia do fabricante"
        />
      </div>

      {/* Frete */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Frete</Label>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Frete Grátis</p>
            <p className="text-xs text-muted-foreground">O vendedor assume o custo do envio</p>
          </div>
          <Switch checked={formFreeShipping} onCheckedChange={setFormFreeShipping} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Retirada no Local</p>
            <p className="text-xs text-muted-foreground">Permitir que o comprador retire pessoalmente</p>
          </div>
          <Switch checked={formLocalPickup} onCheckedChange={setFormLocalPickup} />
        </div>
      </div>
    </div>
  );
}
