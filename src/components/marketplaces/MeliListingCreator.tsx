import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressWithETA } from "@/components/ui/progress-with-eta";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  Tags,
  Circle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProductWithImage } from "@/hooks/useProducts";
import type { MeliListing } from "@/hooks/useMeliListings";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface MeliListingCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductWithImage[];
  productsLoading: boolean;
  listedProductIds: Set<string>;
  onBulkCreate: (data: {
    products: Array<{
      product_id: string;
      title: string;
      price: number;
      available_quantity: number;
      images?: any[];
    }>;
    listing_type: string;
    condition: string;
    shipping: Record<string, any>;
  }) => Promise<any>;
  isSubmitting: boolean;
  onRefetch: () => void;
}

type Step = "select" | "config" | "processing";

interface ProcessingItem {
  productId: string;
  productName: string;
  status: "pending" | "processing" | "done" | "error";
  detail?: string;
}

export function MeliListingCreator({
  open,
  onOpenChange,
  products,
  productsLoading,
  listedProductIds,
  onBulkCreate,
  isSubmitting,
  onRefetch,
}: MeliListingCreatorProps) {
  const { currentTenant } = useAuth();

  // Step 1: Selection
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState("");

  // Step 2: Config
  const [listingType, setListingType] = useState("gold_special");
  const [condition, setCondition] = useState("new");
  const [freeShipping, setFreeShipping] = useState(false);
  const [localPickup, setLocalPickup] = useState(false);
  const [aiTitles, setAiTitles] = useState(true);
  const [aiDescriptions, setAiDescriptions] = useState(true);
  const [aiCategories, setAiCategories] = useState(true);

  // Step 3: Processing
  const [step, setStep] = useState<Step>("select");
  const [processingItems, setProcessingItems] = useState<ProcessingItem[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const availableProducts = useMemo(
    () => products.filter(p => !listedProductIds.has(p.id) && p.status === "active"),
    [products, listedProductIds]
  );

  const filteredProducts = useMemo(
    () => {
      const q = productSearch.toLowerCase();
      return q
        ? availableProducts.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q)
          )
        : availableProducts;
    },
    [availableProducts, productSearch]
  );

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.has(p.id));

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedProductIds(new Set());
      setProductSearch("");
      setListingType("gold_special");
      setCondition("new");
      setFreeShipping(false);
      setLocalPickup(false);
      setAiTitles(true);
      setAiDescriptions(true);
      setAiCategories(true);
      setStep("select");
      setProcessingItems([]);
      setProcessedCount(0);
      setTotalToProcess(0);
      setIsProcessing(false);
    }
  }, [open]);

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedProductIds(prev => {
        const next = new Set(prev);
        filteredProducts.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedProductIds(prev => {
        const next = new Set(prev);
        filteredProducts.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateAndProcess = async () => {
    if (!currentTenant?.id) return;

    const selectedProducts = products.filter(p => selectedProductIds.has(p.id));
    const aiEnabled = aiTitles || aiDescriptions || aiCategories;

    // Step 1: Create drafts
    try {
      const result = await onBulkCreate({
        products: selectedProducts.map(p => ({
          product_id: p.id,
          title: p.name.slice(0, 60),
          price: p.price,
          available_quantity: p.stock_quantity || 1,
          images: p.primary_image_url ? [{ url: p.primary_image_url }] : [],
        })),
        listing_type: listingType,
        condition,
        shipping: {
          mode: "me2",
          free_shipping: freeShipping,
          local_pick_up: localPickup,
        },
      });

      if (!aiEnabled) {
        onOpenChange(false);
        return;
      }

      // Step 2: AI processing
      const listingIds = result?.map((r: any) => r.id) || [];
      if (listingIds.length === 0) {
        onOpenChange(false);
        return;
      }

      setStep("processing");
      setIsProcessing(true);

      const items: ProcessingItem[] = selectedProducts.map(p => ({
        productId: p.id,
        productName: p.name,
        status: "pending" as const,
      }));
      setProcessingItems(items);
      setTotalToProcess(listingIds.length);
      setProcessedCount(0);

      // Run AI operations in chunks
      const actions: string[] = [];
      if (aiTitles) actions.push("bulk_generate_titles");
      if (aiDescriptions) actions.push("bulk_generate_descriptions");
      if (aiCategories) actions.push("bulk_auto_categories");

      let currentProcessed = 0;

      for (const action of actions) {
        let offset = 0;
        const limit = 5;
        let hasMore = true;

        while (hasMore) {
          try {
            const { data, error } = await supabase.functions.invoke("meli-bulk-operations", {
              body: {
                tenantId: currentTenant.id,
                action,
                offset,
                limit,
                listingIds,
              },
            });

            if (error || !data?.success) {
              console.error(`Bulk ${action} error:`, data?.error || error);
              break;
            }

            hasMore = data.hasMore;
            offset += limit;
            currentProcessed += data.processed || 0;

            // Update items status
            setProcessingItems(prev =>
              prev.map((item, idx) => {
                if (idx < Math.ceil(currentProcessed / actions.length)) {
                  return { ...item, status: "done", detail: getActionLabel(action) };
                }
                if (idx === Math.ceil(currentProcessed / actions.length)) {
                  return { ...item, status: "processing", detail: getActionLabel(action) };
                }
                return item;
              })
            );
            setProcessedCount(Math.min(currentProcessed, listingIds.length * actions.length));
          } catch {
            break;
          }
        }
      }

      // Mark all as done
      setProcessingItems(prev => prev.map(item => ({ ...item, status: "done" })));
      setProcessedCount(totalToProcess);

      toast.success("Anúncios criados e processados com sucesso!");
      onRefetch();

      // Auto-close after brief delay
      setTimeout(() => onOpenChange(false), 1500);
    } catch (error) {
      console.error("Bulk create error:", error);
      if (step === "processing") {
        setIsProcessing(false);
      }
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "bulk_generate_titles": return "título";
      case "bulk_generate_descriptions": return "descrição";
      case "bulk_auto_categories": return "categoria";
      default: return action;
    }
  };

  const progressPercent = totalToProcess > 0
    ? Math.round((processedCount / (totalToProcess * [aiTitles, aiDescriptions, aiCategories].filter(Boolean).length)) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Selecionar Produtos"}
            {step === "config" && "Configurações do Anúncio"}
            {step === "processing" && "Processando Anúncios"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Escolha os produtos que deseja anunciar no Mercado Livre"}
            {step === "config" && "Defina as configurações padrão para os anúncios selecionados"}
            {step === "processing" && "Criando rascunhos e gerando conteúdo via IA..."}
          </DialogDescription>
          {/* Step indicators */}
          <div className="flex items-center gap-2 pt-2">
            {(["select", "config", "processing"] as Step[]).map((s, i) => {
              const labels = ["Selecionar", "Configurar", "Processar"];
              const stepNum = i + 1;
              const currentNum = step === "select" ? 1 : step === "config" ? 2 : 3;
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                    currentNum === stepNum ? "bg-primary text-primary-foreground" :
                    stepNum < currentNum ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {stepNum < currentNum ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span>{stepNum}</span>
                    )}
                    {labels[i]}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* STEP 1: Select Products */}
        {step === "select" && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Select all */}
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                />
                Selecionar todos ({availableProducts.length} disponíveis)
              </label>
              {selectedProductIds.size > 0 && (
                <Badge variant="secondary">
                  {selectedProductIds.size} selecionado{selectedProductIds.size > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {productsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium text-sm">
                  {availableProducts.length === 0
                    ? "Todos os produtos já possuem anúncio"
                    : "Nenhum produto encontrado"}
                </p>
              </div>
            ) : (
              <ScrollArea className="flex-1 max-h-[400px]">
                <div className="space-y-1 pr-3">
                  {filteredProducts.map(product => (
                    <label
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                        selectedProductIds.has(product.id)
                          ? "bg-primary/5 border-primary/30"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={selectedProductIds.has(product.id)}
                        onCheckedChange={() => toggleSelect(product.id)}
                      />
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
                      <span className="font-medium text-sm shrink-0">{formatCurrency(product.price)}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button
                onClick={() => setStep("config")}
                disabled={selectedProductIds.size === 0}
              >
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2: Default Config */}
        {step === "config" && (
          <div className="flex-1 flex flex-col gap-6 min-h-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Anúncio</Label>
                <Select value={listingType} onValueChange={setListingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold_special">Clássico</SelectItem>
                    <SelectItem value="gold_pro">Premium</SelectItem>
                    <SelectItem value="free">Grátis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select value={condition} onValueChange={setCondition}>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="cursor-pointer">Frete Grátis</Label>
                <Switch checked={freeShipping} onCheckedChange={setFreeShipping} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="cursor-pointer">Retirada no Local</Label>
                <Switch checked={localPickup} onCheckedChange={setLocalPickup} />
              </div>
            </div>

            {/* AI Options */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Automação por IA
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <Checkbox checked={aiTitles} onCheckedChange={(v) => setAiTitles(!!v)} />
                  <Wand2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Gerar títulos otimizados</p>
                    <p className="text-xs text-muted-foreground">IA cria títulos SEO para o Mercado Livre (máx. 60 chars)</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <Checkbox checked={aiDescriptions} onCheckedChange={(v) => setAiDescriptions(!!v)} />
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Gerar descrições</p>
                    <p className="text-xs text-muted-foreground">Converte HTML para texto plano otimizado para o ML</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                  <Checkbox checked={aiCategories} onCheckedChange={(v) => setAiCategories(!!v)} />
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Auto-categorizar</p>
                    <p className="text-xs text-muted-foreground">Identifica a categoria ML automaticamente para cada produto</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <strong>{selectedProductIds.size}</strong> produto{selectedProductIds.size > 1 ? "s" : ""} será{selectedProductIds.size > 1 ? "ão" : ""} criado{selectedProductIds.size > 1 ? "s" : ""} como rascunho{selectedProductIds.size > 1 ? "s" : ""}. 
              Você poderá editar cada anúncio individualmente antes de publicar.
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("select")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={handleCreateAndProcess} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Criar Anúncios
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: Processing */}
        {step === "processing" && (
          <div className="flex-1 flex flex-col gap-6 py-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
                <Wand2 className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>

            <ProgressWithETA
              value={progressPercent}
              label="Processando anúncios"
              showPercentage
              size="md"
              variant={progressPercent >= 100 ? "success" : "default"}
              currentStep={
                processingItems.find(i => i.status === "processing")
                  ? `Gerando ${processingItems.find(i => i.status === "processing")?.detail || ""}...`
                  : progressPercent >= 100 ? "Concluído!" : "Preparando..."
              }
            />

            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 pr-3">
                {processingItems.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    {item.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : item.status === "processing" ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={`text-sm truncate ${
                      item.status === "done" ? "text-foreground" :
                      item.status === "processing" ? "text-foreground" :
                      "text-muted-foreground"
                    }`}>
                      {item.productName}
                    </span>
                    {item.detail && item.status === "processing" && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        gerando {item.detail}...
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {progressPercent >= 100 && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Finalizando...
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
