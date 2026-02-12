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
} from "lucide-react";
import { useMeliListings, type MeliListing } from "@/hooks/useMeliListings";
import { useProductsWithImages, type ProductWithImage } from "@/hooks/useProducts";
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
  silver: "Silver",
  bronze: "Bronze",
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

  // Form state for create/edit
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formQuantity, setFormQuantity] = useState("1");
  const [formListingType, setFormListingType] = useState("gold_special");
  const [formCondition, setFormCondition] = useState("new");

  // Products that don't have listings yet
  const listedProductIds = new Set(listings.map(l => l.product_id));
  const availableProducts = products.filter(p => !listedProductIds.has(p.id));
  const filteredProducts = availableProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSelectProduct = (product: ProductWithImage) => {
    setSelectedProduct(product);
    setFormTitle(product.name.slice(0, 60)); // ML limit ~60 chars
    setFormDescription(product.description || "");
    setFormPrice(String(product.price));
    setFormQuantity(String(product.stock_quantity || 1));
  };

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
      images: selectedProduct.primary_image_url ? [{ url: selectedProduct.primary_image_url }] : [],
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
    setProductSearch("");
  };

  const handleApprove = (id: string) => {
    approveListing.mutate(id);
  };

  const handlePublish = (listing: MeliListing) => {
    if (confirm("Publicar este anúncio no Mercado Livre?")) {
      publishListing.mutate({ id: listing.id });
    }
  };

  const handlePause = (listing: MeliListing) => {
    publishListing.mutate({ id: listing.id, action: "pause" });
  };

  const handleActivate = (listing: MeliListing) => {
    publishListing.mutate({ id: listing.id, action: "activate" });
  };

  const handleSyncUpdate = (listing: MeliListing) => {
    publishListing.mutate({ id: listing.id, action: "update" });
  };

  const handleDelete = (id: string) => {
    if (confirm("Remover este anúncio?")) {
      deleteListing.mutate(id);
    }
  };

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
                          <p className="text-xs text-destructive mt-1">{listing.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {listing.status === 'draft' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleEditListing(listing)} title="Editar">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleApprove(listing.id)} title="Aprovar">
                                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                              </Button>
                            </>
                          )}
                          {listing.status === 'approved' && (
                            <Button variant="ghost" size="icon" onClick={() => handlePublish(listing)} title="Publicar no ML" disabled={publishListing.isPending}>
                              <Send className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {listing.status === 'error' && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleEditListing(listing)} title="Editar">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handlePublish(listing)} title="Tentar novamente" disabled={publishListing.isPending}>
                                <Send className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
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
                              <Button variant="ghost" size="icon" onClick={() => handleSyncUpdate(listing)} title="Sincronizar preço/estoque" disabled={publishListing.isPending}>
                                <Send className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                          {listing.status !== 'published' && listing.status !== 'publishing' && (
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
              formTitle={formTitle}
              setFormTitle={setFormTitle}
              formDescription={formDescription}
              setFormDescription={setFormDescription}
              formPrice={formPrice}
              setFormPrice={setFormPrice}
              formQuantity={formQuantity}
              setFormQuantity={setFormQuantity}
              formListingType={formListingType}
              setFormListingType={setFormListingType}
              formCondition={formCondition}
              setFormCondition={setFormCondition}
              selectedProduct={selectedProduct}
              onBack={() => setSelectedProduct(null)}
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancelar
            </Button>
            {selectedProduct && (
              <Button
                onClick={handleCreateListing}
                disabled={!formTitle || !formPrice || createListing.isPending}
              >
                {createListing.isPending ? "Salvando..." : "Preparar Anúncio"}
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
            formTitle={formTitle}
            setFormTitle={setFormTitle}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formPrice={formPrice}
            setFormPrice={setFormPrice}
            formQuantity={formQuantity}
            setFormQuantity={setFormQuantity}
            formListingType={formListingType}
            setFormListingType={setFormListingType}
            formCondition={formCondition}
            setFormCondition={setFormCondition}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingListing(null); }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={!formTitle || !formPrice || updateListing.isPending}>
              {updateListing.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Reusable form fields component
function ListingForm({
  formTitle, setFormTitle,
  formDescription, setFormDescription,
  formPrice, setFormPrice,
  formQuantity, setFormQuantity,
  formListingType, setFormListingType,
  formCondition, setFormCondition,
  selectedProduct,
  onBack,
}: {
  formTitle: string; setFormTitle: (v: string) => void;
  formDescription: string; setFormDescription: (v: string) => void;
  formPrice: string; setFormPrice: (v: string) => void;
  formQuantity: string; setFormQuantity: (v: string) => void;
  formListingType: string; setFormListingType: (v: string) => void;
  formCondition: string; setFormCondition: (v: string) => void;
  selectedProduct?: ProductWithImage | null;
  onBack?: () => void;
}) {
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

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="Descrição detalhada do produto..."
          rows={4}
        />
      </div>

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
    </div>
  );
}
