import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProductWithImage } from "@/hooks/useProducts";
import { MeliCategoryPicker } from "./MeliCategoryPicker";
import { MeliAttributesPanel, type MeliAttributesPanelValue } from "./MeliAttributesPanel";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export interface ExistingDraft {
  id: string;
  product_id: string;
  title: string | null;
  description: string | null;
  category_id: string | null;
  condition?: string | null;
  listing_type?: string | null;
  shipping?: Record<string, any> | null;
  price?: number | null;
  product?: { name: string; price?: number | null } | null;
  status?: string | null;
  meli_item_id?: string | null;
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
  /** When provided, dialog opens in "configure existing drafts" mode: skips product selection and draft creation, jumps to Categories step. */
  existingDrafts?: ExistingDraft[];
}

type Step = "select" | "categories" | "titles" | "descriptions" | "attributes" | "condition" | "listing_type" | "prices" | "shipping";

const STEPS: { key: Step; label: string }[] = [
  { key: "select", label: "Produtos" },
  { key: "categories", label: "Categorias" },
  { key: "titles", label: "Títulos" },
  { key: "descriptions", label: "Descrições" },
  { key: "attributes", label: "Características" },
  { key: "condition", label: "Condição" },
  { key: "listing_type", label: "Tipo" },
  { key: "prices", label: "Preços" },
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
  price: number;
  productPrice: number;
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
  existingDrafts,
}: MeliListingCreatorProps) {
  const { currentTenant } = useAuth();
  const isConfigureMode = !!existingDrafts && existingDrafts.length > 0;

  // Step 1: Selection
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState("");

  // Generated data across steps
  const [step, setStep] = useState<Step>("select");
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [listingIds, setListingIds] = useState<string[]>([]);
  // Guard: ensure configure-mode initialization runs ONLY once per dialog opening.
  // Without this, a parent React Query refetch (e.g. when the user switches browser
  // tabs and returns) produces a new `existingDrafts` reference and re-triggers the
  // init effect, which would reset the wizard back to step 1.
  const configureInitRef = useRef<string | null>(null);

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingLabel, setProcessingLabel] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);

  // Step 5, 6 & 7
  const [condition, setCondition] = useState("new");
  const [listingType, setListingType] = useState("gold_special");
  const [freeShipping, setFreeShipping] = useState(false);
  const [localPickup, setLocalPickup] = useState(false);

  // Expanded descriptions
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());

  // Atributos resolvidos por anúncio (etapa "Características").
  // Cada item guarda {attributes, canPublish} vindos do MeliAttributesPanel.
  const [attrValuesByListing, setAttrValuesByListing] = useState<Record<string, MeliAttributesPanelValue>>({});
  const [priceAdjustmentPercent, setPriceAdjustmentPercent] = useState("10");

  // Auto-gen guard for descriptions in configure mode
  const autoGenDescDoneRef = useRef(false);

  // Debounced persistence buffers for inline title/description edits
  const pendingEditsRef = useRef<Map<string, { title?: string; description?: string }>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingEdits = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const entries = Array.from(pendingEditsRef.current.entries());
    pendingEditsRef.current.clear();
    if (entries.length === 0) return;
    try {
      await Promise.all(entries.map(([id, patch]) =>
        supabase.from("meli_listings").update(patch).eq("id", id)
      ));
    } catch (err) {
      console.error("Flush pending edits error:", err);
    }
  }, []);

  const scheduleEdit = useCallback((listingId: string, patch: { title?: string; description?: string }) => {
    const prev = pendingEditsRef.current.get(listingId) || {};
    pendingEditsRef.current.set(listingId, { ...prev, ...patch });
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => { void flushPendingEdits(); }, 800);
  }, [flushPendingEdits]);

  // Persist condition/listing_type/shipping immediately when there are drafts in DB
  const persistBulkSettings = useCallback(async (patch: Record<string, any>) => {
    if (listingIds.length === 0) return;
    try {
      await supabase
        .from("meli_listings")
        .update(patch)
        .in("id", listingIds)
        .eq("tenant_id", currentTenant?.id);
    } catch (err) {
      console.error("Persist bulk settings error:", err);
    }
  }, [listingIds, currentTenant?.id]);


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
      setProcessingLabel("");
      setIsNavigating(false);
      setCondition("new");
      setListingType("gold_special");
      setFreeShipping(false);
      setLocalPickup(false);
      setExpandedDescs(new Set());
      setAttrValuesByListing({});
      setPriceAdjustmentPercent("10");
      configureInitRef.current = null;
    }
  }, [open]);

  // Initialize for "configure existing drafts" mode — runs ONCE per opening.
  useEffect(() => {
    if (!open || !isConfigureMode || !existingDrafts) return;
    const signature = existingDrafts.map(d => d.id).sort().join(",");
    if (configureInitRef.current === signature) return; // already initialized for this set
    configureInitRef.current = signature;
    const items: GeneratedItem[] = existingDrafts.map(d => ({
      listingId: d.id,
      productId: d.product_id,
      productName: d.product?.name || "Produto",
      title: d.title || "",
      description: d.description || "",
      categoryId: d.category_id || "",
      categoryName: d.category_id || "",
      categoryPath: "",
      price: Number(d.price ?? d.product?.price ?? 0),
      productPrice: Number(d.product?.price ?? d.price ?? 0),
    }));
    setGeneratedItems(items);
    setListingIds(existingDrafts.map(d => d.id));
    setStep("categories");
    // Pre-fill condition/listing_type/shipping from first draft
    const first = existingDrafts[0];
    if (first.condition) setCondition(first.condition);
    if (first.listing_type) setListingType(first.listing_type);
    if (first.shipping) {
      setFreeShipping(!!first.shipping.free_shipping);
      setLocalPickup(!!first.shipping.local_pick_up);
    }

    // ALWAYS refresh from DB to avoid stale parent cache. Titles/descriptions/categories
    // generated/saved in a previous session of this dialog might not be reflected in the
    // parent's React Query cached list, which would cause re-generation on reopen.
    (async () => {
      const ids = existingDrafts.map(d => d.id);
      if (ids.length === 0) return;
      try {
        const { data: fresh } = await supabase
          .from("meli_listings")
          .select("id, title, description, category_id, condition, listing_type, shipping, price")
          .in("id", ids);
        if (!fresh) return;
        const byId = new Map(fresh.map((r: any) => [r.id, r]));
        setGeneratedItems(prev => prev.map(i => {
          const r: any = byId.get(i.listingId);
          if (!r) return i;
          return {
            ...i,
            title: r.title || i.title,
            description: r.description || i.description,
            categoryId: r.category_id || i.categoryId,
            categoryName: r.category_id ? i.categoryName : "",
            price: Number(r.price ?? i.price),
          };
        }));
        const f: any = fresh[0];
        if (f?.condition) setCondition(f.condition);
        if (f?.listing_type) setListingType(f.listing_type);
        if (f?.shipping) {
          setFreeShipping(!!f.shipping.free_shipping);
          setLocalPickup(!!f.shipping.local_pick_up);
        }
      } catch { /* skip */ }
    })();

    // Resolve friendly names for already-saved category IDs using the currently hydrated state.
    (async () => {
      const uniqueIds = Array.from(new Set(items.map(d => d.categoryId).filter(Boolean) as string[]));
      if (uniqueIds.length === 0) return;
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const headers = {
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };
        const results = await Promise.all(uniqueIds.map(async (cid) => {
          try {
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meli-search-categories?categoryId=${cid}`,
              { headers }
            );
            if (!res.ok) return null;
            const data = await res.json();
            return {
              id: cid,
              name: data.name as string | undefined,
              path: normalizeCategoryPath(data.path || data.path_from_root),
            };
          } catch { return null; }
        }));
        const byId = new Map(results.filter(Boolean).map(r => [r!.id, r!]));
        setGeneratedItems(prev => prev.map(i => {
          const info = i.categoryId ? byId.get(i.categoryId) : null;
          if (!info) return i;
          return {
            ...i,
            categoryName: info.name || i.categoryName,
            categoryPath: info.path || i.categoryPath,
          };
        }));
      } catch { /* skip */ }
    })();
  }, [open, isConfigureMode, existingDrafts]);



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

  // ====== STEP 2: Create drafts + Auto-categorize ======
  const handleCreateDraftsAndCategorize = useCallback(async () => {
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
        price: Number(p.price || 0),
        productPrice: Number(p.price || 0),
      }));
      setGeneratedItems(items);

      // Auto-categorize
      setProcessingLabel("Categorizando produtos via API do Mercado Livre...");
      let offset = 0;
      const limit = 5;
      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("meli-bulk-operations", {
          body: { tenantId: currentTenant.id, action: "bulk_auto_categories", offset, limit, listingIds: ids },
        });

        if (error || !data?.success) {
          console.error("Bulk categories error:", data?.error || error);
          break;
        }

        hasMore = data.hasMore;
        offset += limit;
        totalProcessed += data.processed || 0;
        setProcessingProgress(Math.round((totalProcessed / ids.length) * 100));

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

      // Sync from DB
      const { data: updatedListings } = await supabase
        .from("meli_listings")
        .select("id, category_id")
        .in("id", ids);

      if (updatedListings) {
        setGeneratedItems(prev => prev.map(item => {
          const updated = updatedListings.find(l => l.id === item.listingId);
          if (updated?.category_id && !item.categoryId) {
            return { ...item, categoryId: updated.category_id };
          }
          return item;
        }));
      }

      setIsProcessing(false);
      setProcessingProgress(100);
    } catch (error) {
      console.error("Create drafts + categorize error:", error);
      toast.error("Erro ao criar rascunhos");
      setIsProcessing(false);
    }
  }, [currentTenant?.id, selectedProductIds, products, onBulkCreate]);

  // ====== STEP 3: Generate Titles (categories already set, so max_title_length is respected) ======
  const handleGenerateTitles = useCallback(async () => {
    if (!currentTenant?.id || listingIds.length === 0) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingLabel("Gerando títulos via IA...");

    try {
      let offset = 0;
      const limit = 5;
      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke("meli-bulk-operations", {
          body: { tenantId: currentTenant.id, action: "bulk_generate_titles", offset, limit, listingIds },
        });

        if (error || !data?.success) {
          console.error("Bulk titles error:", data?.error || error);
          break;
        }

        hasMore = data.hasMore;
        offset += limit;
        totalProcessed += data.processed || 0;
        setProcessingProgress(Math.round((totalProcessed / listingIds.length) * 100));
      }

      // Fetch updated listings to get generated titles
      const { data: updatedListings } = await supabase
        .from("meli_listings")
        .select("id, title, product_id")
        .in("id", listingIds);

      if (updatedListings) {
        setGeneratedItems(prev => prev.map(item => {
          const updated = updatedListings.find(l => l.id === item.listingId);
          return updated ? { ...item, title: updated.title || item.title } : item;
        }));
      }

      setIsProcessing(false);
      setProcessingProgress(100);
    } catch (error) {
      console.error("Generate titles error:", error);
      toast.error("Erro ao gerar títulos");
      setIsProcessing(false);
    }
  }, [currentTenant?.id, listingIds]);

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

  // handleAutoCategories is no longer needed as a separate step — integrated into handleCreateDraftsAndCategorize

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
          listingId: item.listingId,
          categoryId: item.categoryId || undefined,
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

  // ====== Update title inline (persists with debounce) ======
  const handleTitleChange = (listingId: string, value: string) => {
    setGeneratedItems(prev => prev.map(i =>
      i.listingId === listingId ? { ...i, title: value } : i
    ));
    scheduleEdit(listingId, { title: value });
  };

  // ====== Update description inline (persists with debounce) ======
  const handleDescriptionChange = (listingId: string, value: string) => {
    setGeneratedItems(prev => prev.map(i =>
      i.listingId === listingId ? { ...i, description: value } : i
    ));
    scheduleEdit(listingId, { description: value });
  };

  // ====== Apply description from one item to all others ======
  const handleApplyDescriptionToAll = async (sourceListingId: string) => {
    const source = generatedItems.find(i => i.listingId === sourceListingId);
    if (!source?.description?.trim()) {
      toast.error("Defina a descrição deste produto antes de aplicar a todos.");
      return;
    }
    const targets = generatedItems.filter(i => i.listingId !== sourceListingId);
    if (targets.length === 0) return;

    setGeneratedItems(prev => prev.map(i =>
      i.listingId === sourceListingId ? i : { ...i, description: source.description }
    ));

    try {
      await supabase
        .from("meli_listings")
        .update({ description: source.description })
        .in("id", targets.map(t => t.listingId));
      toast.success(`Descrição aplicada a ${targets.length} produto(s).`);
    } catch (err) {
      console.error("Apply description to all error:", err);
      toast.error("Não foi possível aplicar a descrição a todos os produtos.");
    }
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

  // ====== Apply category from one item to all others ======
  const handleApplyCategoryToAll = async (sourceListingId: string) => {
    const source = generatedItems.find(i => i.listingId === sourceListingId);
    if (!source?.categoryId) {
      toast.error("Defina a categoria deste produto antes de aplicar a todos.");
      return;
    }
    const targets = generatedItems.filter(i => i.listingId !== sourceListingId);
    if (targets.length === 0) return;

    setGeneratedItems(prev => prev.map(i =>
      i.listingId === sourceListingId
        ? i
        : {
            ...i,
            categoryId: source.categoryId,
            categoryName: source.categoryName,
            categoryPath: source.categoryPath,
          }
    ));

    try {
      await supabase
        .from("meli_listings")
        .update({ category_id: source.categoryId })
        .in("id", targets.map(t => t.listingId));
      toast.success(`Categoria aplicada a ${targets.length} produto(s).`);
    } catch (err) {
      console.error("Apply category to all error:", err);
      toast.error("Não foi possível aplicar a categoria a todos os produtos.");
    }
  };

  // ====== Save titles to DB when moving to next step ======
  const handleSaveTitles = async () => {
    const ops = generatedItems
      .filter(item => item.title)
      .map(item => supabase.from("meli_listings").update({ title: item.title }).eq("id", item.listingId));
    if (ops.length) await Promise.all(ops);
  };

  // ====== Save descriptions to DB ======
  const handleSaveDescriptions = async () => {
    const ops = generatedItems
      .filter(item => item.description)
      .map(item => supabase.from("meli_listings").update({ description: item.description }).eq("id", item.listingId));
    if (ops.length) await Promise.all(ops);
  };

  // ====== Save resolved attributes to DB (etapa "Características") ======
  // Para cada anúncio, persiste o array completo de atributos resolvidos no
  // formato esperado pela publicação do Mercado Livre: [{ id, value_name, value_id? }, ...].
  // É essa lista que faz o anúncio nascer com pontuação alta de qualidade.
  const handleSaveAttributes = async () => {
    const entries = Object.entries(attrValuesByListing);
    if (entries.length === 0) return;
    const ops = entries
      .filter(([, val]) => Array.isArray(val?.attributes) && val.attributes.length > 0)
      .map(([listingId, val]) => {
        const attrs = (val.attributes || [])
          .filter(a => a.status !== "missing" && (a.value_name || a.value_id))
          .map(a => ({
            id: a.id,
            ...(a.value_id ? { value_id: a.value_id } : {}),
            ...(a.value_name ? { value_name: a.value_name } : {}),
          }));
        return supabase.from("meli_listings").update({ attributes: attrs as any }).eq("id", listingId);
      });
    if (ops.length) await Promise.all(ops);
  };

  const handlePriceChange = (listingId: string, rawValue: string) => {
    const normalized = rawValue.replace(".", "").replace(",", ".");
    const nextPrice = Number(normalized);
    setGeneratedItems(prev => prev.map(item =>
      item.listingId === listingId ? { ...item, price: Number.isFinite(nextPrice) ? nextPrice : 0 } : item
    ));
  };

  const applyPriceAdjustment = (mode: "discount" | "increase" | "restore") => {
    const percent = Number(priceAdjustmentPercent.replace(",", ".")) || 0;
    setGeneratedItems(prev => prev.map(item => {
      if (mode === "restore") return { ...item, price: item.productPrice };
      const factor = mode === "discount" ? (1 - percent / 100) : (1 + percent / 100);
      return { ...item, price: Math.max(0, Number((item.price * factor).toFixed(2))) };
    }));
  };

  const handleSavePrices = async () => {
    const invalid = generatedItems.some(item => !Number.isFinite(item.price) || item.price <= 0);
    if (invalid) throw new Error("Revise os preços: todos precisam ser maiores que zero.");
    const ops = generatedItems.map(item =>
      supabase.from("meli_listings").update({ price: item.price }).eq("id", item.listingId)
    );
    if (ops.length) await Promise.all(ops);
  };

  // ====== Final save: condition + listing_type + shipping ======
  // mode: 'draft' just saves locally; 'publish' also pushes to ML (publish new for unpublished, update for existing meli_item_id)
  const handleFinalSave = async (mode: 'draft' | 'publish' = 'draft') => {
    if (listingIds.length === 0) return;
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingLabel(mode === 'publish' ? 'Salvando e publicando no Mercado Livre...' : 'Salvando anúncios...');
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

      if (mode === 'draft') {
        toast.success(`${listingIds.length} anúncio${listingIds.length > 1 ? "s" : ""} salvo${listingIds.length > 1 ? "s" : ""} com sucesso!`);
        onRefetch();
        onOpenChange(false);
        return;
      }

      // mode === 'publish' — push each listing to ML
      // Auto-approve drafts before publishing
      const draftsToApprove = (existingDrafts || []).length > 0
        ? existingDrafts!.filter(d => ['draft', 'ready'].includes(d.status || '')).map(d => d.id)
        : listingIds; // creation flow → all are drafts
      if (draftsToApprove.length > 0) {
        try {
          await supabase
            .from('meli_listings')
            .update({ status: 'approved' as const })
            .in('id', draftsToApprove);
        } catch { /* continue */ }
      }

      // Determine which need "update" (already published) vs publish-new
      const idToExisting = new Map((existingDrafts || []).map(d => [d.id, d]));
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      let processed = 0;
      for (const id of listingIds) {
        const existing = idToExisting.get(id);
        const action = existing?.meli_item_id ? 'update' : undefined;
        try {
          const { data, error: invErr } = await supabase.functions.invoke('meli-publish-listing', {
            body: { tenantId: currentTenant?.id, listingId: id, action },
          });
          if (invErr || !data?.success) {
            errorCount++;
            errors.push(data?.error || invErr?.message || 'erro');
          } else {
            successCount++;
          }
        } catch (e: any) {
          errorCount++;
          errors.push(e?.message || 'erro');
        }
        processed++;
        setProcessingProgress(Math.round((processed / listingIds.length) * 100));
      }

      if (successCount > 0) {
        toast.success(`${successCount} anúncio${successCount > 1 ? 's' : ''} ${idToExisting.size > 0 ? 'atualizado' : 'publicado'}${successCount > 1 ? 's' : ''} no Mercado Livre!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} com erro: ${errors.slice(0, 2).join(' | ')}`);
      }
      onRefetch();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar anúncios");
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingLabel("");
    }
  };

  // ====== Step navigation ======
  const goNext = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      await flushPendingEdits();
      const idx = currentStepIndex;
      // Clear stale progress label from previous step
      setProcessingLabel("");
      setProcessingProgress(0);
      if (idx === 0) {
        // Select → Categories: create drafts + auto-categorize (skipped in configure mode)
        setStep("categories");
        if (!isConfigureMode) {
          setTimeout(() => handleCreateDraftsAndCategorize(), 100);
        }
      } else if (idx === 1) {
        // Categories → Titles: generate titles only on first pass (creation mode)
        setStep("titles");
        if (!isConfigureMode) {
          setTimeout(() => handleGenerateTitles(), 100);
        }
      } else if (idx === 2) {
        // Titles → Descriptions: save titles, then generate descriptions (creation mode only)
        await handleSaveTitles();
        setStep("descriptions");
        if (!isConfigureMode) {
          setTimeout(() => handleGenerateDescriptions(), 100);
        }
      } else if (idx === 3) {
        // Descriptions → Attributes
        await handleSaveDescriptions();
        setStep("attributes");
      } else if (idx === 4) {
        // Attributes → Condition (salva os atributos resolvidos por anúncio)
        await handleSaveAttributes();
        setStep("condition");
      } else if (idx === 5) {
        setStep("listing_type");
      } else if (idx === 6) {
        setStep("prices");
      } else if (idx === 7) {
        await handleSavePrices();
        setStep("shipping");
      }
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível avançar");
    } finally {
      setIsNavigating(false);
    }
  };

  const minStepIndex = isConfigureMode ? 1 : 0;
  const goBack = async () => {
    await flushPendingEdits();
    const idx = currentStepIndex;
    if (idx > minStepIndex) {
      setStep(STEPS[idx - 1].key);
    }
  };

  // Configure mode must be read-only on step entry: reopening drafts never triggers AI spend.
  useEffect(() => {
    if (!open) autoGenDescDoneRef.current = false;
  }, [open]);

  const canGoNext = () => {
    if (step === "select") return selectedProductIds.size > 0;
    if (step === "categories") return !isProcessing;
    if (step === "titles") return !isProcessing && generatedItems.length > 0 && invalidTitleCount === 0;
    if (step === "descriptions") return !isProcessing;
    if (step === "attributes") {
      // Permite avançar quando nenhum anúncio tem atributo obrigatório faltando.
      const values = Object.values(attrValuesByListing);
      return values.every(v => v.canPublish !== false);
    }
    if (step === "condition") return !!condition;
    if (step === "listing_type") return !!listingType;
    if (step === "prices") return generatedItems.length > 0 && generatedItems.every(item => Number.isFinite(item.price) && item.price > 0);
    return false;
  };

  const handleOpenChange = (next: boolean) => {
    if (isProcessing) return;
    if (!next) { void flushPendingEdits(); }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Selecionar Produtos"}
            {step === "categories" && "Categorias do Mercado Livre"}
            {step === "titles" && "Títulos dos Anúncios"}
            {step === "descriptions" && "Descrições dos Anúncios"}
            {step === "attributes" && "Características dos Anúncios"}
            {step === "condition" && "Condição dos Produtos"}
            {step === "listing_type" && "Tipo de Anúncio"}
            {step === "prices" && "Preços dos Anúncios"}
            {step === "shipping" && "Configuração de Frete"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Escolha os produtos que deseja anunciar no Mercado Livre"}
            {step === "categories" && "Confirme as categorias atribuídas pela API do Mercado Livre"}
            {step === "titles" && "Revise e edite os títulos gerados pela IA (respeitando o limite da categoria)"}
            {step === "descriptions" && "Revise as descrições geradas (texto plano, sem HTML)"}
            {step === "attributes" && "Confirmamos as características exigidas e recomendadas pelo Mercado Livre. Quanto mais preenchido, maior a pontuação do anúncio."}
            {step === "condition" && "Defina a condição dos produtos"}
            {step === "listing_type" && "Escolha o tipo de anúncio e salve"}
            {step === "prices" && "Ajuste o preço que será enviado ao Mercado Livre sem alterar o cadastro interno"}
          </DialogDescription>

          {/* Step indicators */}
          <div className="flex items-center gap-1.5 pt-2 flex-wrap">
            {STEPS.filter((_, i) => i >= minStepIndex).map((s) => {
              const i = STEPS.findIndex(x => x.key === s.key);
              const displayIndex = i - minStepIndex;
              return (
                <div key={s.key} className="flex items-center gap-1.5">
                  {displayIndex > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                    currentStepIndex === i ? "bg-primary text-primary-foreground" :
                    i < currentStepIndex ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {i < currentStepIndex ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <span>{displayIndex + 1}</span>
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                </div>
              );
            })}
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

        {/* ===== STEP 2: Categories ===== */}
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
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <MeliCategoryPicker
                            value={item.categoryId}
                            onChange={(catId, catName) => handleCategoryChange(item.listingId, catId, catName)}
                            selectedName={item.categoryName}
                            productName={item.productName}
                          />
                        </div>
                        {generatedItems.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!item.categoryId}
                            onClick={() => handleApplyCategoryToAll(item.listingId)}
                            title="Usar esta categoria em todos os produtos da lista"
                          >
                            Aplicar a todos
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 3: Titles ===== */}
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
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGeneratedItems(prev => prev.map(i => ({
                          ...i,
                          title: (i.productName || "").slice(0, 60),
                        })));
                        toast.success("Títulos atualizados com os nomes originais dos produtos");
                      }}
                      className="h-8 text-xs"
                    >
                      Manter nomes originais dos produtos
                    </Button>
                  </div>
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

        {/* ===== STEP 4: Descriptions ===== */}
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
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                            {item.productName}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {generatedItems.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApplyDescriptionToAll(item.listingId)}
                                disabled={!item.description?.trim()}
                                className="h-7 text-xs"
                                title="Usar esta descrição em todos os produtos da lista"
                              >
                                Aplicar a todos
                              </Button>
                            )}
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

        {/* ===== STEP 5: Attributes (Características) ===== */}
        {step === "attributes" && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Para cada anúncio, o sistema cruza o cadastro do produto, a categoria escolhida e o dicionário do Mercado Livre, e completa o que falta com a IA. Itens em vermelho precisam ser preenchidos no cadastro do produto antes de continuar — use o atalho ao lado do nome.
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-3 pr-3">
                {generatedItems.map(item => {
                  const value = attrValuesByListing[item.listingId];
                  const missingCount = value?.attributes?.filter(a => a.status === "missing").length ?? 0;
                  return (
                    <div key={item.listingId} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          {item.categoryName && (
                            <p className="text-[11px] text-muted-foreground truncate">{item.categoryPath || item.categoryName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {missingCount > 0 && (
                            <Badge variant="outline" className="border-destructive/50 text-destructive text-[10px]">
                              {missingCount} faltando
                            </Badge>
                          )}
                          {item.productId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => window.open(`/products?edit=${item.productId}`, '_blank', 'noopener')}
                              title="Abrir o cadastro deste produto em nova aba"
                            >
                              <ArrowRight className="h-3 w-3" />
                              Abrir cadastro
                            </Button>
                          )}
                        </div>
                      </div>
                      {item.categoryId && currentTenant?.id ? (
                        <MeliAttributesPanel
                          tenantId={currentTenant.id}
                          listingId={item.listingId}
                          productId={item.productId}
                          categoryId={item.categoryId}
                          onChange={(v) => setAttrValuesByListing(prev => ({ ...prev, [item.listingId]: v }))}
                        />
                      ) : (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Defina a categoria antes de carregar as características.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 6: Condition ===== */}
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
                    onChange={(e) => { setCondition(e.target.value); void persistBulkSettings({ condition: e.target.value }); }}
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
                    onChange={(e) => { setListingType(e.target.value); void persistBulkSettings({ listing_type: e.target.value }); }}
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

        {/* ===== STEP 8: Prices ===== */}
        {step === "prices" && (
          <div className="flex-1 flex flex-col gap-4 min-h-0 py-2">
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              O valor abaixo é específico do anúncio no Mercado Livre. O preço do cadastro do produto permanece igual.
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full sm:w-32">
                <Label className="text-xs">Percentual</Label>
                <Input
                  value={priceAdjustmentPercent}
                  onChange={(e) => setPriceAdjustmentPercent(e.target.value)}
                  inputMode="decimal"
                  className="h-9"
                />
              </div>
              <Button type="button" variant="outline" onClick={() => applyPriceAdjustment("discount")} className="gap-2">
                <DollarSign className="h-4 w-4" /> Aplicar desconto %
              </Button>
              <Button type="button" variant="outline" onClick={() => applyPriceAdjustment("increase")} className="gap-2">
                <DollarSign className="h-4 w-4" /> Aplicar acréscimo %
              </Button>
              <Button type="button" variant="outline" onClick={() => applyPriceAdjustment("restore")}>Restaurar preço do cadastro</Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-3 pr-3">
                {generatedItems.map(item => (
                  <div key={item.listingId} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">Cadastro: {formatCurrency(item.productPrice || 0)}</p>
                      </div>
                      <div className="w-36 shrink-0">
                        <Input
                          value={Number.isFinite(item.price) ? String(item.price).replace(".", ",") : ""}
                          onChange={(e) => handlePriceChange(item.listingId, e.target.value)}
                          inputMode="decimal"
                          className={item.price <= 0 ? "border-destructive" : ""}
                        />
                      </div>
                    </div>
                    {item.price <= 0 && <p className="text-xs text-destructive">O preço precisa ser maior que zero.</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP 9: Shipping ===== */}
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
                <Switch checked={freeShipping} onCheckedChange={(v) => { setFreeShipping(v); void persistBulkSettings({ shipping: { mode: "me2", free_shipping: v, local_pick_up: localPickup } }); }} />
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
                <Switch checked={localPickup} onCheckedChange={(v) => { setLocalPickup(v); void persistBulkSettings({ shipping: { mode: "me2", free_shipping: freeShipping, local_pick_up: v } }); }} />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="gap-2 pt-4 border-t shrink-0">
          {currentStepIndex > minStepIndex && !isProcessing && (
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}
          <div className="flex-1" />
          {step === "shipping" ? (
            (() => {
              const allPublished = isConfigureMode && (existingDrafts || []).every(d => !!d.meli_item_id);
              if (allPublished) {
                return (
                  <Button onClick={() => handleFinalSave('publish')} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Atualizar {generatedItems.length} anúncio{generatedItems.length > 1 ? "s" : ""} no Mercado Livre
                  </Button>
                );
              }
              return (
                <>
                  <Button variant="outline" onClick={() => handleFinalSave('draft')} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Salvar como rascunho
                  </Button>
                  <Button onClick={() => handleFinalSave('publish')} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Salvar e publicar no Mercado Livre
                  </Button>
                </>
              );
            })()
          ) : (
            <Button onClick={goNext} disabled={!canGoNext() || isSubmitting || isNavigating}>
              {(isSubmitting || isNavigating) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isNavigating ? "Salvando..." : "Continuar"}
              {!isNavigating && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}