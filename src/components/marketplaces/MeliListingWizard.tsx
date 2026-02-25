import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Wand2,
  AlertCircle,
  Package,
  ChevronRight,
  Zap,
} from "lucide-react";
import { MeliCategoryPicker } from "@/components/marketplaces/MeliCategoryPicker";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProductWithImage } from "@/hooks/useProducts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface MeliListingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductWithImage[];
  productsLoading: boolean;
  listedProductIds: Set<string>;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  mode: "create" | "edit";
  initialData?: any;
}

type WizardStep = "select" | "auto" | "review";

const STEP_INFO: Record<WizardStep, { title: string; description: string; number: number }> = {
  select: { title: "Selecionar Produto", description: "Escolha o produto que deseja anunciar", number: 1 },
  auto: { title: "Preenchimento Inteligente", description: "IA preenchendo dados automaticamente...", number: 2 },
  review: { title: "Revisar e Ajustar", description: "Confira os dados e faça ajustes se necessário", number: 3 },
};

export function MeliListingWizard({
  open,
  onOpenChange,
  products,
  productsLoading,
  listedProductIds,
  onSubmit,
  isSubmitting,
  mode,
  initialData,
}: MeliListingWizardProps) {
  const { currentTenant } = useAuth();
  const [step, setStep] = useState<WizardStep>(mode === "edit" ? "review" : "select");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductWithImage | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [listingType, setListingType] = useState("gold_special");
  const [condition, setCondition] = useState("new");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [gtin, setGtin] = useState("");
  const [brand, setBrand] = useState("");
  const [warranty, setWarranty] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [localPickup, setLocalPickup] = useState(false);

  // Auto-fill state
  const [autoProgress, setAutoProgress] = useState(0);
  const [autoStatus, setAutoStatus] = useState("");
  const [autoSteps, setAutoSteps] = useState<{ label: string; done: boolean; error?: boolean }[]>([]);

  // Initialize edit mode
  useEffect(() => {
    if (mode === "edit" && initialData && open) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setPrice(String(initialData.price || ""));
      setQuantity(String(initialData.available_quantity || 1));
      setListingType(initialData.listing_type || "gold_special");
      setCondition(initialData.condition || "new");
      setCategoryId(initialData.category_id || "");
      setCategoryName(initialData.categoryName || "");
      setGtin(initialData.gtin || "");
      setBrand(initialData.brand || "");
      setWarranty(initialData.warranty || "");
      setFreeShipping(initialData.shipping?.free_shipping || false);
      setLocalPickup(initialData.shipping?.local_pick_up || false);
      setStep("review");
    }
  }, [mode, initialData, open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep(mode === "edit" ? "review" : "select");
      setProductSearch("");
      setSelectedProduct(null);
      setTitle("");
      setDescription("");
      setPrice("");
      setQuantity("1");
      setListingType("gold_special");
      setCondition("new");
      setCategoryId("");
      setCategoryName("");
      setGtin("");
      setBrand("");
      setWarranty("");
      setFreeShipping(false);
      setLocalPickup(false);
      setAutoProgress(0);
      setAutoStatus("");
      setAutoSteps([]);
    }
  }, [open, mode]);

  const availableProducts = products.filter(p => !listedProductIds.has(p.id));
  const filteredProducts = availableProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleSelectProduct = useCallback((product: ProductWithImage) => {
    setSelectedProduct(product);
    // Pre-fill basic data immediately
    setTitle(product.name.slice(0, 60));
    setPrice(String(product.price));
    setQuantity(String(product.stock_quantity || 1));
    setBrand((product as any).brand || "");
    setGtin((product as any).gtin || (product as any).ean || "");
    setDescription(product.description || "");
    // Start auto-fill
    runAutoFill(product);
  }, [currentTenant?.id]);

  const runAutoFill = async (product: ProductWithImage) => {
    if (!currentTenant?.id) return;
    setStep("auto");

    const steps: { label: string; done: boolean; error?: boolean }[] = [
      { label: "Gerando título otimizado para o ML", done: false },
      { label: "Convertendo descrição para texto plano", done: false },
      { label: "Identificando categoria automaticamente", done: false },
    ];
    setAutoSteps([...steps]);
    setAutoProgress(5);

    // Step 1: Generate title
    setAutoStatus("Gerando título...");
    try {
      const { data } = await supabase.functions.invoke("meli-generate-description", {
        body: {
          tenantId: currentTenant.id,
          htmlDescription: product.name + (product.description ? "\n" + product.description : ""),
          productName: product.name,
          productTitle: product.name.slice(0, 60),
          generateTitle: true,
        },
      });
      if (data?.success && (data.title || data.description)) {
        setTitle((data.title || data.description || "").slice(0, 60));
        steps[0].done = true;
      } else {
        steps[0].error = true;
      }
    } catch {
      steps[0].error = true;
    }
    setAutoSteps([...steps]);
    setAutoProgress(35);

    // Step 2: Generate description
    setAutoStatus("Gerando descrição...");
    const htmlSource = product.description || "";
    if (htmlSource.trim()) {
      try {
        const { data } = await supabase.functions.invoke("meli-generate-description", {
          body: {
            tenantId: currentTenant.id,
            htmlDescription: htmlSource,
            productName: product.name,
            productTitle: product.name.slice(0, 60),
          },
        });
        if (data?.success && data.description) {
          setDescription(data.description);
          steps[1].done = true;
        } else {
          steps[1].error = true;
        }
      } catch {
        steps[1].error = true;
      }
    } else {
      steps[1].done = true; // No description to convert
    }
    setAutoSteps([...steps]);
    setAutoProgress(65);

    // Step 3: Auto-categorize
    setAutoStatus("Identificando categoria...");
    try {
      const { data } = await supabase.functions.invoke("meli-bulk-operations", {
        body: {
          tenantId: currentTenant.id,
          action: "auto_suggest_category",
          productName: product.name,
        },
      });
      if (data?.success && data.categoryId) {
        setCategoryId(data.categoryId);
        setCategoryName(data.path || data.categoryName || data.categoryId);
        steps[2].done = true;
      } else {
        steps[2].error = true;
      }
    } catch {
      steps[2].error = true;
    }
    setAutoSteps([...steps]);
    setAutoProgress(100);
    setAutoStatus("Concluído!");

    // Brief pause to show 100% then move to review
    setTimeout(() => setStep("review"), 800);
  };

  const handleSubmit = () => {
    const attrs: any[] = [];
    if (brand) attrs.push({ id: "BRAND", value_name: brand });
    if (gtin) attrs.push({ id: "GTIN", value_name: gtin });

    const data: any = {
      title,
      description: description || undefined,
      price: parseFloat(price),
      available_quantity: parseInt(quantity) || 1,
      listing_type: listingType,
      condition,
      category_id: categoryId || undefined,
      attributes: attrs,
      shipping: {
        mode: "me2",
        local_pick_up: localPickup,
        free_shipping: freeShipping,
      },
    };

    if (mode === "create" && selectedProduct) {
      data.product_id = selectedProduct.id;
      data.images = selectedProduct.primary_image_url ? [{ url: selectedProduct.primary_image_url }] : [];
    }

    if (mode === "edit" && initialData?.id) {
      data.id = initialData.id;
    }

    onSubmit(data);
  };

  const isValid = !!title && !!price && parseFloat(price) > 0 && !!categoryId;

  const stepNumber = STEP_INFO[step].number;
  const totalSteps = mode === "edit" ? 1 : 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "edit" ? "Editar Anúncio" : "Novo Anúncio no Mercado Livre"}
          </DialogTitle>
          <DialogDescription>
            {STEP_INFO[step].description}
          </DialogDescription>
          {mode === "create" && (
            <div className="flex items-center gap-2 pt-2">
              {(["select", "auto", "review"] as WizardStep[]).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                    step === s ? "bg-primary text-primary-foreground" :
                    STEP_INFO[s].number < STEP_INFO[step].number ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {STEP_INFO[s].number < STEP_INFO[step].number ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span>{STEP_INFO[s].number}</span>
                    )}
                    {STEP_INFO[s].title}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* STEP 1: Select Product */}
        {step === "select" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {productsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-sm">
                  {availableProducts.length === 0
                    ? "Todos os produtos já possuem anúncio"
                    : "Nenhum produto encontrado"}
                </p>
                <p className="text-xs mt-1">
                  {availableProducts.length === 0
                    ? "Cada produto pode ter apenas um anúncio no ML."
                    : "Tente buscar com outro termo."}
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-2">
                  <Zap className="h-3 w-3 inline mr-1" />
                  Ao selecionar, a IA irá preencher título, descrição e categoria automaticamente.
                </p>
                {filteredProducts.slice(0, 20).map(product => (
                  <button
                    key={product.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 text-left transition-colors border border-transparent hover:border-border"
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
                    <div className="text-right shrink-0">
                      <span className="font-medium text-sm">{formatCurrency(product.price)}</span>
                      <p className="text-xs text-muted-foreground">Selecionar →</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Auto-fill in progress */}
        {step === "auto" && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
                <Wand2 className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold">Preenchendo automaticamente</h3>
              <p className="text-sm text-muted-foreground mt-1">
                A IA está gerando conteúdo otimizado para o Mercado Livre
              </p>
            </div>

            <Progress value={autoProgress} className="h-2" />

            <div className="space-y-3">
              {autoSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  {s.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : s.error ? (
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                  )}
                  <span className={`text-sm ${s.done ? "text-foreground" : s.error ? "text-amber-600" : "text-muted-foreground"}`}>
                    {s.label}
                    {s.error && <span className="text-xs ml-2">(você pode ajustar manualmente)</span>}
                  </span>
                </div>
              ))}
            </div>

            {autoProgress === 100 && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Abrindo revisão...
              </p>
            )}
          </div>
        )}

        {/* STEP 3: Review & Edit */}
        {step === "review" && (
          <div className="space-y-4">
            {/* Product card (create mode) */}
            {selectedProduct && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                {selectedProduct.primary_image_url ? (
                  <img src={selectedProduct.primary_image_url} alt="" className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">{selectedProduct.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {selectedProduct.sku} • {formatCurrency(selectedProduct.price)}</p>
                </div>
                {mode === "create" && (
                  <Button variant="outline" size="sm" onClick={() => setStep("select")}>
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Trocar
                  </Button>
                )}
              </div>
            )}

            {/* Title with AI badge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  Título do Anúncio <span className="text-destructive">*</span>
                </Label>
                <RegenButton
                  label="Regerar"
                  loading={false}
                  onClick={async () => {
                    if (!currentTenant?.id) return;
                    const productName = selectedProduct?.name || title;
                    try {
                      const { data } = await supabase.functions.invoke("meli-generate-description", {
                        body: {
                          tenantId: currentTenant.id,
                          htmlDescription: productName + (description ? "\n" + description : ""),
                          productName,
                          productTitle: title,
                          generateTitle: true,
                        },
                      });
                      if (data?.success && (data.title || data.description)) {
                        setTitle((data.title || data.description || "").slice(0, 60));
                        toast.success("Título regenerado!");
                      }
                    } catch {
                      toast.error("Erro ao regerar título");
                    }
                  }}
                />
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="Título que aparecerá no Mercado Livre"
              />
              <div className="flex items-center justify-between">
                <p className={`text-xs ${title.length > 55 ? "text-amber-500" : "text-muted-foreground"}`}>
                  {title.length}/60 caracteres
                </p>
                {!title && <p className="text-xs text-destructive">Obrigatório</p>}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Descrição</Label>
                <RegenButton
                  label="Regerar"
                  loading={false}
                  onClick={async () => {
                    if (!currentTenant?.id) return;
                    const htmlSource = selectedProduct?.description || description;
                    if (!htmlSource?.trim()) {
                      toast.error("Nenhuma descrição disponível para converter");
                      return;
                    }
                    try {
                      const { data } = await supabase.functions.invoke("meli-generate-description", {
                        body: {
                          tenantId: currentTenant.id,
                          htmlDescription: htmlSource,
                          productName: selectedProduct?.name || "",
                          productTitle: title,
                        },
                      });
                      if (data?.success && data.description) {
                        setDescription(data.description);
                        toast.success("Descrição regenerada!");
                      }
                    } catch {
                      toast.error("Erro ao regerar descrição");
                    }
                  }}
                />
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição detalhada (texto plano, sem HTML)"
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                O Mercado Livre aceita apenas texto plano. Links, HTML e dados de contato são removidos automaticamente.
              </p>
            </div>

            {/* Price + Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço (R$) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                />
              </div>
            </div>

            {/* Listing Type + Condition */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Anúncio</Label>
                <Select value={listingType} onValueChange={setListingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold_special">Clássico (Gold Special)</SelectItem>
                    <SelectItem value="gold_pro">Premium (Gold Pro)</SelectItem>
                    <SelectItem value="free">Grátis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Novo</SelectItem>
                    <SelectItem value="used">Usado</SelectItem>
                    <SelectItem value="not_specified">Não especificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Categoria do Mercado Livre <span className="text-destructive">*</span>
              </Label>
              <MeliCategoryPicker
                value={categoryId}
                onChange={(id, name) => { setCategoryId(id); if (name) setCategoryName(name); }}
                selectedName={categoryName}
                productName={selectedProduct?.name || title}
              />
              {!categoryId && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Obrigatório — clique "Auto" para sugerir ou busque manualmente.
                </p>
              )}
            </div>

            {/* Brand + GTIN */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ex: Nike, Samsung..." />
              </div>
              <div className="space-y-2">
                <Label>GTIN / EAN</Label>
                <Input value={gtin} onChange={(e) => setGtin(e.target.value)} placeholder="Código de barras" />
              </div>
            </div>

            {/* Warranty */}
            <div className="space-y-2">
              <Label>Garantia</Label>
              <Input value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="Ex: 12 meses de garantia do fabricante" />
            </div>

            {/* Shipping */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Frete</Label>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Frete Grátis</p>
                  <p className="text-xs text-muted-foreground">O vendedor assume o custo</p>
                </div>
                <Switch checked={freeShipping} onCheckedChange={setFreeShipping} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Retirada no Local</p>
                  <p className="text-xs text-muted-foreground">Comprador retira pessoalmente</p>
                </div>
                <Switch checked={localPickup} onCheckedChange={setLocalPickup} />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {step === "select" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : mode === "edit" ? (
                  "Salvar Alterações"
                ) : (
                  <>Preparar Anúncio <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Small regenerate button
function RegenButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isLoading}
      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
    >
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      {label}
    </Button>
  );
}
