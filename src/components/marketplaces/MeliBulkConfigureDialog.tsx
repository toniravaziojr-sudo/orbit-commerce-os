import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, CopyCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MeliCategoryPicker } from "./MeliCategoryPicker";
import type { MeliListing } from "@/hooks/useMeliListings";

interface ItemState {
  listingId: string;
  productId: string;
  productName: string;
  thumb: string | null;
  categoryId: string;
  categoryName: string;
  brand: string;
  gtin: string;
  warranty: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: MeliListing[];
  onSaved: () => void;
}

function attrVal(attrs: any[], id: string): string {
  if (!Array.isArray(attrs)) return "";
  const a = attrs.find((x) => x?.id === id);
  return a?.value_name || "";
}

function upsertAttr(attrs: any[], id: string, value: string): any[] {
  const list = Array.isArray(attrs) ? [...attrs] : [];
  const trimmed = (value || "").trim();
  const idx = list.findIndex((x) => x?.id === id);
  if (!trimmed) {
    if (idx >= 0) list.splice(idx, 1);
    return list;
  }
  const next = { id, value_name: trimmed };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return list;
}

export function MeliBulkConfigureDialog({ open, onOpenChange, listings, onSaved }: Props) {
  const { currentTenant } = useAuth();
  const [items, setItems] = useState<ItemState[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItems(
      listings.map((l) => ({
        listingId: l.id,
        productId: l.product_id,
        productName: l.product?.name || l.title,
        thumb: l.primary_image_url || null,
        categoryId: l.category_id || "",
        categoryName: "",
        brand: attrVal(l.attributes as any[], "BRAND"),
        gtin: attrVal(l.attributes as any[], "GTIN"),
        warranty: attrVal(l.attributes as any[], "WARRANTY_TYPE"),
      })),
    );
  }, [open, listings]);

  const totalMissingCategory = useMemo(() => items.filter((i) => !i.categoryId).length, [items]);

  const updateItem = (id: string, patch: Partial<ItemState>) => {
    setItems((prev) => prev.map((i) => (i.listingId === id ? { ...i, ...patch } : i)));
  };

  const applyToAll = (sourceId: string, field: "categoryId" | "brand" | "gtin" | "warranty") => {
    const src = items.find((i) => i.listingId === sourceId);
    if (!src) return;
    if (field === "categoryId" && !src.categoryId) {
      toast.error("Defina a categoria neste item primeiro.");
      return;
    }
    if (field !== "categoryId" && !src[field]) {
      toast.error("Preencha o campo neste item primeiro.");
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.listingId === sourceId
          ? i
          : field === "categoryId"
            ? { ...i, categoryId: src.categoryId, categoryName: src.categoryName }
            : { ...i, [field]: src[field] },
      ),
    );
    toast.success("Aplicado aos demais itens.");
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;
    setSaving(true);
    try {
      // Get current attributes per listing to preserve other attrs
      const ids = items.map((i) => i.listingId);
      const { data: current, error: fetchErr } = await supabase
        .from("meli_listings")
        .select("id, attributes")
        .in("id", ids);
      if (fetchErr) throw fetchErr;
      const attrMap = new Map<string, any[]>((current || []).map((r: any) => [r.id, (r.attributes as any[]) || []]));

      let ok = 0;
      let fail = 0;
      for (const it of items) {
        let attrs = attrMap.get(it.listingId) || [];
        attrs = upsertAttr(attrs, "BRAND", it.brand);
        attrs = upsertAttr(attrs, "GTIN", it.gtin);
        attrs = upsertAttr(attrs, "WARRANTY_TYPE", it.warranty);
        const payload: any = { attributes: attrs };
        if (it.categoryId) payload.category_id = it.categoryId;
        const { error } = await supabase.from("meli_listings").update(payload).eq("id", it.listingId);
        if (error) fail++;
        else ok++;
      }
      if (ok > 0) toast.success(`${ok} anúncio${ok > 1 ? "s" : ""} configurado${ok > 1 ? "s" : ""}.`);
      if (fail > 0) toast.error(`${fail} falha${fail > 1 ? "s" : ""} ao salvar.`);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Configurar anúncios selecionados ({items.length})
          </DialogTitle>
          <DialogDescription>
            Defina categoria, marca, código de barras e garantia para cada anúncio. Use "Aplicar a todos" para replicar o valor nos demais.
            {totalMissingCategory > 0 && (
              <span className="block mt-1 text-amber-600">
                {totalMissingCategory} sem categoria definida.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {items.map((it) => (
              <div key={it.listingId} className="border rounded-lg p-4 space-y-3 bg-card">
                <div className="flex items-center gap-3">
                  {it.thumb ? (
                    <img src={it.thumb} alt="" className="h-12 w-12 rounded object-cover border" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{it.productName}</p>
                    {!it.categoryId && (
                      <Badge variant="outline" className="text-xs mt-0.5 border-amber-500 text-amber-600">
                        Sem categoria
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Categoria do Mercado Livre</Label>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1"
                          disabled={!it.categoryId}
                          onClick={() => applyToAll(it.listingId, "categoryId")}
                        >
                          <CopyCheck className="h-3 w-3" /> Aplicar a todos
                        </Button>
                      )}
                    </div>
                    <MeliCategoryPicker
                      value={it.categoryId}
                      selectedName={it.categoryName}
                      productName={it.productName}
                      onChange={(id, name) => updateItem(it.listingId, { categoryId: id, categoryName: name || "" })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(["brand", "gtin", "warranty"] as const).map((field) => {
                      const labels: Record<string, string> = {
                        brand: "Marca",
                        gtin: "Código de barras (GTIN/EAN)",
                        warranty: "Garantia",
                      };
                      const placeholders: Record<string, string> = {
                        brand: "Ex: Respeite o Homem",
                        gtin: "Ex: 7891234567890",
                        warranty: "Ex: 3 meses pelo vendedor",
                      };
                      return (
                        <div key={field}>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs">{labels[field]}</Label>
                            {items.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs gap-1"
                                disabled={!it[field]}
                                onClick={() => applyToAll(it.listingId, field)}
                              >
                                <CopyCheck className="h-3 w-3" /> Aplicar a todos
                              </Button>
                            )}
                          </div>
                          <Input
                            value={it[field]}
                            placeholder={placeholders[field]}
                            onChange={(e) => updateItem(it.listingId, { [field]: e.target.value } as any)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || items.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
