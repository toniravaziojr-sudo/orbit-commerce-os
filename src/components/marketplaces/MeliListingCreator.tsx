import { useState, useEffect, useMemo, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressWithETA } from "@/components/ui/progress-with-eta";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronDown,
  RefreshCw,
  Crown,
  Star,
  Gift,
  ShieldCheck,
  Recycle,
  HelpCircle,
  Truck,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProductWithImage } from "@/hooks/useProducts";
import { MeliCategoryPicker } from "./MeliCategoryPicker";

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

type Step = "select" | "titles" | "descriptions" | "categories" | "condition" | "listing_type" | "shipping";

const STEPS: { key: Step; label: string }[] = [
  { key: "select", label: "Produtos" },
  { key: "titles", label: "Títulos" },
  { key: "descriptions", label: "Descrições" },
  { key: "categories", label: "Categorias" },
  { key: "condition", label: "Condição" },
  { key: "listing_type", label: "Tipo" },
  { key: "shipping", label: "Frete" },
];

interface GeneratedItem {
  listingId: string;
  productId: string;
  productName: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryPath: string;
}

const TITLE_SOFT_WARNING_LENGTH = 90;

function getMeliTitleIssue(title: string): string | null {
  const normalized = title.trim();
  if (!normalized) return "Título obrigatório.";
  if (/[-,/:;]$/.test(normalized)) return "Título parece truncado no final.";
  if (normalized.split(/\s+/).length < 2) return "Título muito curto/incompleto.";

  const lastWord = normalized.split(/\s+/).pop()?.toLowerCase() || "";
  if (["de", "da", "do", "das", "dos", "e", "com", "para", "por", "a", "o", "em"].includes(lastWord)) {
    return "Título termina com palavra incompleta.";
  }

  return null;
}

function normalizeCategoryPath(pathData: unknown): string {
  if (typeof pathData === "string") return pathData;
  if (Array.isArray(pathData)) {
    return pathData
      .map((entry: any) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "name" in entry) return String((entry as any).name);
        return "";
      })
      .filter(Boolean)
      .join(" > ");
  }
  return "";
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

  // Generated data across steps
  const [step, setStep] = useState<Step>("select");
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [listingIds, setListingIds] = useState<string[]>([]);

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingLabel, setProcessingLabel] = useState("");

  // Step 5, 6 & 7
  const [condition, setCondition] = useState("new");
  const [listingType, setListingType] = useState("gold_special");
  const [freeShipping, setFreeShipping] = useState(false);
  const [localPickup, setLocalPickup] = useState(false);

  // Expanded descriptions
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());

  const availableProducts = useMemo(
    () => products.filter(p => p.status === "active"),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return q
      ? availableProducts.filter(p =>
          p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
        )
      : availableProducts;
  }, [availableProducts, productSearch]);

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.has(p.id));

  const invalidTitleCount = useMemo(
    () => generatedItems.filter(item => !!getMeliTitleIssue(item.title)).length,
    [generatedItems]
  );

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedProductIds(new Set());
      setProductSearch("");
      setStep("select");
      setGeneratedItems([]);
      setListingIds([]);
      setIsProcessing(false);
      setProcessingProgress(0);
      setCondition("new");
      setListingType("gold_special");
      setFreeShipping(false);
      setLocalPickup(false);
      setExpandedDescs(new Set());
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

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  // ====== STEP 2: Create drafts + Generate Titles ======
  const handleGenerateTitles = useCallback(async () => {
    if (!currentTenant?.id) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingLabel("Criando rascunhos...");

    try {
      const selectedProducts = products.filter(p => selectedProductIds.has(p.id));

      // Create drafts first
      const result = await onBulkCreate({
        products: selectedProducts.map(p => ({
          product_id: p.id,
          title: p.name,
          price: p.price,
          available_quantity: p.stock_quantity || 1,
          images: p.primary_image_url ? [{ url: p.primary_image_url }] : [],
        })),
        listing_type: "gold_special",
        condition: "new",
        shipping: { mode: "me2", free_shipping: false, local_pick_up: false },
      });

      const ids = result?.map((r: any) => r.id) || [];
      setListingIds(ids);

      if (ids.length === 0) {
        toast.error("Nenhum rascunho criado");
        setIsProcessing(false);
        return;
      }

      // Initialize generated items
      const items: GeneratedItem[] = selectedProducts.map(p => ({
        listingId: ids[selectedProducts.findIndex(sp => sp.id === p.id)] || "",
        productId: p.id,
        productName: p.name,
        title: p.name,
        description: "",
        categoryId: "",
        categoryName: "",
        categoryPath: "",
      }));

      setProcessingLabel("Gerando títulos via IA...");

      // Generate titles in chunks
      let offset = 0;
      const limit = 5;
      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("meli-bulk-operations", {
          body: { tenantId: currentTenant.id, action: "bulk_generate_titles", offset, limit, listingIds: ids },
        });

        if (error || !data?.success) {
          console.error("Bulk titles error:", data?.error || error);
          break;
        }

        hasMore = data.hasMore;
        offset += limit;
        totalProcessed += data.processed || 0;
        setProcessingProgress(Math.round((totalProcessed / ids.length) * 100));
      }

      // Fetch updated listings to get generated titles
      const { data: updatedListings } = await supabase
        .from("meli_listings")
        .select("id, title, product_id")
        .in("id", ids);

      if (updatedListings) {
        for (const listing of updatedListings) {
          const itemIdx = items.findIndex(i => i.listingId === listing.id);
          if (itemIdx >= 0) {
            items[itemIdx].title = listing.title || items[itemIdx].title;
          }
        }
      }

      setGeneratedItems(items);
      setIsProcessing(false);
      setProcessingProgress(100);
    } catch (error) {
      console.error("Generate titles error:", error);
      toast.error("Erro ao gerar títulos");
      setIsProcessing(false);
    }
  }, [currentTenant?.id, selectedProductIds, products, onBulkCreate]);

  // ====== STEP 3: Generate Descriptions ======
  const handleGenerateDescriptions = useCallback(async () => {
    if (!currentTenant?.id || listingIds.length === 0) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingLabel("Gerando descrições via IA...");

    try {
      let offset = 0;
      const limit = 5;
      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("meli-bulk-operations", {
          body: { tenantId: currentTenant.id, action: "bulk_generate_descriptions", offset, limit, listingIds },
        });

        if (error || !data?.success) {
          console.error("Bulk descriptions error:", data?.error || error);
          break;
        }

        hasMore = data.hasMore;
        offset += limit;
        totalProcessed += data.processed || 0;
        setProcessingProgress(Math.round((totalProcessed / listingIds.length) * 100));
      }

      // Fetch updated listings
      const { data: updatedListings } = await supabase
        .from("meli_listings")
        .select("id, description")
        .in("id", listingIds);

      if (updatedListings) {
        setGeneratedItems(prev => prev.map(item => {
          const updated = updatedListings.find(l => l.id === item.listingId);
          return updated ? { ...item, description: updated.description || "" } : item;
        }));
      }

      setIsProcessing(false);
      setProcessingProgress(100);
    } catch (error) {
      console.error("Generate descriptions error:", error);
      toast.error("Erro ao gerar descrições");
      setIsProcessing(false);
    }
  }, [currentTenant?.id, listingIds]);

  // ====== STEP 4: Auto-categorize + Refit Titles by Category Limit ======
  const handleAutoCategories = useCallback(async () => {
    if (!currentTenant?.id || listingIds.length === 0) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingLabel("Categorizando produtos via API do Mercado Livre...");

    try {
      // 1) Resolve categories in chunks
      let offset = 0;
      const limit = 5;
      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("meli-bulk-operations", {
          body: { tenantId: currentTenant.id, action: "bulk_auto_categories", offset, limit, listingIds },
        });

        if (error || !data?.success) {
          console.error("Bulk categories error:", data?.error || error);
          break;
        }

        hasMore = data.hasMore;
        offset += limit;
        totalProcessed += data.processed || 0;
        setProcessingProgress(Math.round((totalProcessed / listingIds.length) * 100));

        if (data.resolvedCategories?.length) {
          setGeneratedItems(prev => prev.map(item => {
            const resolved = data.resolvedCategories.find((r: any) => r.listingId === item.listingId);
            if (!resolved) return item;

            return {
              ...item,
              categoryId: resolved.categoryId,
              categoryName: resolved.categoryName || "",
              categoryPath: normalizeCategoryPath(resolved.categoryPath),
            };
          }));
        }
      }

      // 2) Re-generate titles AFTER categories are set (uses category max_title_length)
      setProcessingLabel("Ajustando títulos ao limite real da categoria...");
      setProcessingProgress(0);
      offset = 0;
      hasMore = true;
      totalProcessed = 0;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("meli-bulk-operations", {
          body: { tenantId: currentTenant.id, action: "bulk_generate_titles", offset, limit, listingIds },
        });

        if (error || !data?.success) {
          console.error("Bulk title refit error:", data?.error || error);
          break;
        }

        hasMore = data.hasMore;
        offset += limit;
        totalProcessed += data.processed || 0;
        setProcessingProgress(Math.round((totalProcessed / listingIds.length) * 100));
      }

      // 3) Sync final categories + titles from DB
      const { data: updatedListings } = await supabase
        .from("meli_listings")
        .select("id, title, category_id")
        .in("id", listingIds);

      if (updatedListings) {
        setGeneratedItems(prev => prev.map(item => {
          const updated = updatedListings.find(l => l.id === item.listingId);
          if (!updated) return item;

          return {
            ...item,
            title: updated.title || item.title,
            categoryId: updated.category_id || item.categoryId,
          };
        }));
      }

      setIsProcessing(false);
      setProcessingProgress(100);
    } catch (error) {
      console.error("Auto categories error:", error);
      toast.error("Erro ao categorizar produtos");
      setIsProcessing(false);
    }
  }, [currentTenant?.id, listingIds]);

  // ====== Regenerate single title ======
  const [regeneratingTitleId, setRegeneratingTitleId] = useState<string | null>(null);
  const handleRegenerateTitle = useCallback(async (item: GeneratedItem) => {
    if (!currentTenant?.id) return;
    setRegeneratingTitleId(item.listingId);
    try {
      const { data, error } = await supabase.functions.invoke("meli-generate-description", {
        body: {
          tenantId: currentTenant.id,
          productId: item.productId,
          generateTitle: true,
        },
      });
      if (error || !data?.success) {
        toast.error("Erro ao regenerar título");
        return;
      }
      const newTitle = data.title || "";
      if (newTitle) {
        setGeneratedItems(prev => prev.map(i =>
          i.listingId === item.listingId ? { ...i, title: newTitle } : i
        ));
        // Also update in DB
        await supabase.from("meli_listings").update({ title: newTitle }).eq("id", item.listingId);
        toast.success("Título regenerado!");
      }
    } catch {
      toast.error("Erro ao regenerar título");
    } finally {
      setRegeneratingTitleId(null);
    }
  }, [currentTenant?.id]);

  // ====== Regenerate single description ======
  const [regeneratingDescId, setRegeneratingDescId] = useState<string | null>(null);
  const handleRegenerateDescription = useCallback(async (item: GeneratedItem) => {
    if (!currentTenant?.id) return;
    setRegeneratingDescId(item.listingId);
    try {
      const { data, error } = await supabase.functions.invoke("meli-generate-description", {
        body: {
          tenantId: currentTenant.id,
          productId: item.productId,
        },
      });
      if (error || !data?.success) {
        toast.error("Erro ao regenerar descrição");
        return;
      }
      const newDesc = data.description || "";
      if (newDesc) {
        setGeneratedItems(prev => prev.map(i =>
          i.listingId === item.listingId ? { ...i, description: newDesc } : i
        ));
        await supabase.from("meli_listings").update({ description: newDesc }).eq("id", item.listingId);
        toast.success("Descrição regenerada!");
      }
    } catch {
      toast.error("Erro ao regenerar descrição");
    } finally {
      setRegeneratingDescId(null);
    }
  }, [currentTenant?.id]);

  // ====== Update title inline ======
  const handleTitleChange = (listingId: string, value: string) => {
    setGeneratedItems(prev => prev.map(i =>
      i.listingId === listingId ? { ...i, title: value } : i
    ));
  };

  // ====== Update description inline ======
  const handleDescriptionChange = (listingId: string, value: string) => {
    setGeneratedItems(prev => prev.map(i =>
      i.listingId === listingId ? { ...i, description: value } : i
    ));
  };

  // ====== Change category manually ======
  const handleCategoryChange = async (listingId: string, categoryId: string, categoryName?: string) => {
    // Resolve full path
    let categoryPath = categoryName || "";
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meli-search-categories?categoryId=${categoryId}`,
        {
          headers: {
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const normalizedPath = normalizeCategoryPath(data.path || data.path_from_root);
        if (normalizedPath) categoryPath = normalizedPath;
        if (data.name) categoryName = data.name;
      }
    } catch { /* skip */ }

    setGeneratedItems(prev => prev.map(i =>
      i.listingId === listingId
        ? {
            ...i,
            categoryId,
            categoryName: categoryName || categoryId,
            categoryPath: normalizeCategoryPath(categoryPath),
          }
        : i
    ));
    // Update in DB
    await supabase.from("meli_listings").update({ category_id: categoryId }).eq("id", listingId);
  };

  // ====== Save titles to DB when moving to next step ======
  const handleSaveTitles = async () => {
    for (const item of generatedItems) {
      if (item.title) {
        await supabase.from("meli_listings").update({ title: item.title }).eq("id", item.listingId);
      }
    }
  };

  // ====== Save descriptions to DB ======
  const handleSaveDescriptions = async () => {
    for (const item of generatedItems) {
      if (item.description) {
        await supabase.from("meli_listings").update({ description: item.description }).eq("id", item.listingId);
      }
    }
  };

  // ====== Final save: condition + listing_type + shipping ======
  const handleFinalSave = async () => {
    if (listingIds.length === 0) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("meli_listings")
        .update({
          condition,
          listing_type: listingType,
          shipping: {
            mode: "me2",
            free_shipping: freeShipping,
            local_pick_up: localPickup,
          },
        })
        .in("id", listingIds)
        .eq("tenant_id", currentTenant?.id);

      if (error) throw error;

      toast.success(`${listingIds.length} anúncio${listingIds.length > 1 ? "s" : ""} salvo${listingIds.length > 1 ? "s" : ""} com sucesso!`);
      onRefetch();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar anúncios");
    } finally {
      setIsProcessing(false);
    }
  };

  // ====== Step navigation ======
  const goNext = async () => {
    const idx = currentStepIndex;
    if (idx === 0) {
      // Select → Titles: create drafts + generate titles
      setStep("titles");
      setTimeout(() => handleGenerateTitles(), 100);
    } else if (idx === 1) {
      // Titles → Descriptions: save titles, then generate descriptions
      await handleSaveTitles();
      setStep("descriptions");
      setTimeout(() => handleGenerateDescriptions(), 100);
    } else if (idx === 2) {
      // Descriptions → Categories: save descriptions, then auto-categorize
      await handleSaveDescriptions();
      setStep("categories");
      setTimeout(() => handleAutoCategories(), 100);
    } else if (idx === 3) {
      setStep("condition");
    } else if (idx === 4) {
      setStep("listing_type");
    } else if (idx === 5) {
      setStep("shipping");
    }
  };

  const goBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setStep(STEPS[idx - 1].key);
    }
  };

  const canGoNext = () => {
    if (step === "select") return selectedProductIds.size > 0;
    if (step === "titles") return !isProcessing && generatedItems.length > 0 && invalidTitleCount === 0;
    if (step === "descriptions") return !isProcessing;
    if (step === "categories") return !isProcessing;
    if (step === "condition") return !!condition;
    if (step === "listing_type") return !!listingType;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Selecionar Produtos"}
            {step === "titles" && "Títulos dos Anúncios"}
            {step === "descriptions" && "Descrições dos Anúncios"}
            {step === "categories" && "Categorias do Mercado Livre"}
            {step === "condition" && "Condição dos Produtos"}
            {step === "listing_type" && "Tipo de Anúncio"}
            {step === "shipping" && "Configuração de Frete"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Escolha os produtos que deseja anunciar no Mercado Livre"}
            {step === "titles" && "Revise e edite os títulos gerados pela IA (sem final truncado)"}
            {step === "descriptions" && "Revise as descrições geradas (texto plano, sem HTML)"}
            {step === "categories" && "Confirme as categorias atribuídas pela API do Mercado Livre"}
            {step === "condition" && "Defina a condição dos produtos"}
            {step === "listing_type" && "Escolha o tipo de anúncio e salve"}
          </DialogDescription>

          {/* Step indicators */}
          <div className="flex items-center gap-1.5 pt-2 flex-wrap">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                  currentStepIndex === i ? "bg-primary text-primary-foreground" :
                  i < currentStepIndex ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i < currentStepIndex ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* ===== STEP 1: Select Products ===== */}
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

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
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
                  {availableProducts.length === 0 ? "Todos os produtos já possuem anúncio" : "Nenhum produto encontrado"}
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-1 pr-3">
                  {filteredProducts.map(product => (
                    <label
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                        selectedProductIds.has(product.id) ? "bg-primary/5 border-primary/30" : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox checked={selectedProductIds.has(product.id)} onCheckedChange={() => toggleSelect(product.id)} />
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
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 2: Titles ===== */}
        {step === "titles" && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {isProcessing ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10">
                  <Wand2 className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <ProgressWithETA
                  value={processingProgress}
                  label={processingLabel}
                  showPercentage
                  size="md"
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-3 pr-3">
                  {invalidTitleCount > 0 && (
                     <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                       {invalidTitleCount} título{invalidTitleCount > 1 ? "s" : ""} precisa{invalidTitleCount > 1 ? "m" : ""} de ajuste (remova final truncado/incompleto).
                     </div>
                  )}

                  {generatedItems.map(item => {
                    const titleIssue = getMeliTitleIssue(item.title);
                    const titleInvalid = !!titleIssue;

                    return (
                    <div key={item.listingId} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate max-w-[70%]">
                          {item.productName}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerateTitle(item)}
                          disabled={regeneratingTitleId === item.listingId}
                          className="h-7 text-xs gap-1"
                        >
                          {regeneratingTitleId === item.listingId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          {regeneratingTitleId === item.listingId ? "Gerando..." : "Regenerar"}
                        </Button>
                      </div>
                      <div className="relative">
                        <Input
                          value={item.title}
                          onChange={(e) => handleTitleChange(item.listingId, e.target.value)}
                          className={titleInvalid ? "border-destructive" : ""}
                        />
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${
                          titleInvalid ? "text-destructive font-bold" :
                          item.title.length > TITLE_SOFT_WARNING_LENGTH ? "text-amber-500" :
                          "text-muted-foreground"
                        }`}>
                          {item.title.length} chars
                        </span>
                      </div>
                      {titleInvalid && (
                        <p className="text-xs text-destructive">
                          {titleIssue}
                        </p>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 3: Descriptions ===== */}
        {step === "descriptions" && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {isProcessing ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10">
                  <Wand2 className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <ProgressWithETA
                  value={processingProgress}
                  label={processingLabel}
                  showPercentage
                  size="md"
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-3 pr-3">
                  {generatedItems.map(item => {
                    const isExpanded = expandedDescs.has(item.listingId);
                    const previewText = item.description.split("\n").slice(0, 3).join("\n");
                    const isLong = item.description.split("\n").length > 3;

                    return (
                      <div key={item.listingId} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground truncate max-w-[70%]">
                            {item.productName}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRegenerateDescription(item)}
                            disabled={regeneratingDescId === item.listingId}
                            className="h-7 text-xs gap-1"
                          >
                            {regeneratingDescId === item.listingId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            {regeneratingDescId === item.listingId ? "Gerando..." : "Regenerar"}
                          </Button>
                        </div>

                        {isExpanded ? (
                          <>
                            <Textarea
                              value={item.description}
                              onChange={(e) => handleDescriptionChange(item.listingId, e.target.value)}
                              rows={8}
                              className="text-xs"
                            />
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${item.description.length > 5000 ? "text-destructive" : "text-muted-foreground"}`}>
                                {item.description.length}/5000
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedDescs(prev => { const n = new Set(prev); n.delete(item.listingId); return n; })}
                                className="h-6 text-xs"
                              >
                                Recolher
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div
                            className="text-xs text-muted-foreground whitespace-pre-line cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => setExpandedDescs(prev => new Set(prev).add(item.listingId))}
                          >
                            {previewText || <span className="italic">Sem descrição gerada</span>}
                            {isLong && (
                              <span className="text-primary ml-1 inline-flex items-center gap-0.5">
                                <ChevronDown className="h-3 w-3" /> ver mais
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 4: Categories ===== */}
        {step === "categories" && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {isProcessing ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10">
                  <Wand2 className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <ProgressWithETA
                  value={processingProgress}
                  label={processingLabel}
                  showPercentage
                  size="md"
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-3 pr-3">
                  {generatedItems.map(item => (
                    <div key={item.listingId} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      {item.categoryPath ? (
                        <p className="text-xs text-muted-foreground">{item.categoryPath}</p>
                      ) : item.categoryName ? (
                        <p className="text-xs text-muted-foreground">{item.categoryName}</p>
                      ) : item.categoryId ? (
                        <p className="text-xs text-muted-foreground">{item.categoryId}</p>
                      ) : (
                        <p className="text-xs text-amber-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Categoria não identificada
                        </p>
                      )}
                      <MeliCategoryPicker
                        value={item.categoryId}
                        onChange={(catId, catName) => handleCategoryChange(item.listingId, catId, catName)}
                        selectedName={item.categoryName}
                        productName={item.productName}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 5: Condition ===== */}
        {step === "condition" && (
          <div className="flex-1 flex flex-col gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione a condição que será aplicada a todos os {generatedItems.length} anúncios.
            </p>
            <div className="grid gap-3">
              {[
                { value: "new", label: "Novo", desc: "Produto novo, sem uso", icon: ShieldCheck },
                { value: "used", label: "Usado", desc: "Produto em segunda mão", icon: Recycle },
                { value: "not_specified", label: "Não especificado", desc: "Não se aplica", icon: HelpCircle },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    condition === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={opt.value}
                    checked={condition === opt.value}
                    onChange={(e) => setCondition(e.target.value)}
                    className="sr-only"
                  />
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    condition === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <opt.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                  {condition === opt.value && (
                    <CheckCircle2 className="h-5 w-5 text-primary ml-auto shrink-0" />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ===== STEP 6: Listing Type ===== */}
        {step === "listing_type" && (
          <div className="flex-1 flex flex-col gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Escolha o tipo de anúncio para todos os {generatedItems.length} produtos.
            </p>
            <div className="grid gap-3">
              {[
                { value: "gold_special", label: "Clássico", desc: "Maior visibilidade, 11% de comissão", icon: Star },
                { value: "gold_pro", label: "Premium", desc: "Máxima exposição, 16% de comissão + frete grátis", icon: Crown },
                { value: "free", label: "Grátis", desc: "Sem custo, menor visibilidade", icon: Gift },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    listingType === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="listing_type"
                    value={opt.value}
                    checked={listingType === opt.value}
                    onChange={(e) => setListingType(e.target.value)}
                    className="sr-only"
                  />
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    listingType === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <opt.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                  {listingType === opt.value && (
                    <CheckCircle2 className="h-5 w-5 text-primary ml-auto shrink-0" />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ===== STEP 7: Shipping ===== */}
        {step === "shipping" && (
          <div className="flex-1 flex flex-col gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Configure o frete para todos os {generatedItems.length} anúncios.
            </p>
            <div className="grid gap-3">
              <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                freeShipping ? "border-primary bg-primary/5" : "border-border"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    freeShipping ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Frete Grátis</p>
                    <p className="text-xs text-muted-foreground">O vendedor assume o custo do frete</p>
                  </div>
                </div>
                <Switch checked={freeShipping} onCheckedChange={setFreeShipping} />
              </div>

              <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                localPickup ? "border-primary bg-primary/5" : "border-border"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    localPickup ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Retirada no Local</p>
                    <p className="text-xs text-muted-foreground">Comprador retira pessoalmente</p>
                  </div>
                </div>
                <Switch checked={localPickup} onCheckedChange={setLocalPickup} />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="gap-2 pt-4 border-t shrink-0">
          {currentStepIndex > 0 && !isProcessing && (
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}
          <div className="flex-1" />
          {step === "shipping" ? (
            <Button onClick={handleFinalSave} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Salvar {generatedItems.length} Anúncio{generatedItems.length > 1 ? "s" : ""}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canGoNext() || isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Continuar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
