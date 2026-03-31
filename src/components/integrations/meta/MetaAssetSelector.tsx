import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronRight, Building2, Phone, Globe, Instagram, Crosshair, Megaphone, ShoppingBag, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetaAssetType } from "@/config/metaIntegrationCatalog";
import type { DiscoveredAssets, DiscoveredBusiness } from "@/hooks/useMetaIntegrations";
import { useMetaCatalog } from "@/hooks/useMetaCatalog";

interface MetaAssetSelectorProps {
  assetType: MetaAssetType;
  assetLabel?: string;
  discoveredAssets: DiscoveredAssets | null;
  onConfirm: (selectedAssets: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FlatAsset {
  id: string;
  label: string;
  sublabel?: string;
  businessId: string;
  businessName: string;
  raw: any;
}

export function MetaAssetSelector({
  assetType,
  assetLabel,
  discoveredAssets,
  onConfirm,
  onCancel,
  isLoading,
}: MetaAssetSelectorProps) {
  const businesses = discoveredAssets?.businesses ?? [];
  
  // Flatten assets from all businesses
  const flatAssets = useMemo(() => {
    const assets: FlatAsset[] = [];
    
    for (const biz of businesses) {
      switch (assetType) {
        case "page":
          for (const page of biz.pages || []) {
            assets.push({
              id: `${biz.id}:${page.id}`,
              label: page.name,
              sublabel: biz.name,
              businessId: biz.id,
              businessName: biz.name,
              raw: page,
            });
          }
          break;

        case "instagram_account":
          for (const ig of biz.instagram_accounts || []) {
            const linkedPage = biz.pages?.find(p => p.id === ig.page_id);
            assets.push({
              id: `${biz.id}:${ig.id}`,
              label: ig.username ? `@${ig.username}` : `Instagram ${ig.id}`,
              sublabel: linkedPage ? `Página: ${linkedPage.name}` : biz.name,
              businessId: biz.id,
              businessName: biz.name,
              raw: { ...ig, linked_page: linkedPage },
            });
          }
          break;

        case "waba_phone":
          for (const waba of biz.whatsapp_business_accounts || []) {
            const phones = waba.phone_numbers || [];
            if (phones.length === 0) {
              assets.push({
                id: `${biz.id}:${waba.id}:no_phone`,
                label: waba.name || `WABA ${waba.id}`,
                sublabel: "Nenhum número encontrado",
                businessId: biz.id,
                businessName: biz.name,
                raw: { waba_id: waba.id, waba_name: waba.name },
              });
            } else {
              for (const phone of phones) {
                assets.push({
                  id: `${biz.id}:${waba.id}:${phone.id}`,
                  label: phone.display_phone_number || phone.id,
                  sublabel: `${waba.name || "WhatsApp"} — ${biz.name}`,
                  businessId: biz.id,
                  businessName: biz.name,
                  raw: {
                    id: phone.id,
                    display_phone_number: phone.display_phone_number,
                    verified_name: phone.verified_name,
                    waba_id: waba.id,
                    waba_name: waba.name,
                  },
                });
              }
            }
          }
          break;

        case "pixel":
          for (const pixel of biz.pixels || []) {
            assets.push({
              id: `${biz.id}:${pixel.id}`,
              label: pixel.name || `Pixel ${pixel.id}`,
              sublabel: biz.name,
              businessId: biz.id,
              businessName: biz.name,
              raw: pixel,
            });
          }
          break;

        case "ad_account":
          for (const acc of biz.ad_accounts || []) {
            assets.push({
              id: `${biz.id}:${acc.id}`,
              label: acc.name || acc.id,
              sublabel: biz.name,
              businessId: biz.id,
              businessName: biz.name,
              raw: acc,
            });
          }
          break;
      }
    }
    
    return assets;
  }, [businesses, assetType]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Catalog-specific selector
  if (assetType === "catalog") {
    return (
      <CatalogSelector
        onConfirm={onConfirm}
        onCancel={onCancel}
        isLoading={isLoading}
      />
    );
  }

  if (assetType === "none") {
    return (
      <div className="mt-2 ml-7 pl-3 border-l-2 border-primary/30 py-2">
        <p className="text-xs text-muted-foreground mb-2">
          Este recurso será configurado automaticamente.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={() => onConfirm({})} disabled={isLoading}>
            {isLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (flatAssets.length === 0) {
    return (
      <div className="mt-2 ml-7 pl-3 border-l-2 border-amber-400/50 py-2">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Nenhum {assetLabel || "ativo"} encontrado na sua conta Meta. 
          Verifique se a conta conectada tem acesso a este tipo de recurso.
        </p>
        <Button size="sm" variant="ghost" onClick={onCancel} className="mt-2">
          Cancelar
        </Button>
      </div>
    );
  }

  const selectedAsset = flatAssets.find(a => a.id === selectedId);

  const handleConfirm = () => {
    if (!selectedAsset) return;
    const payload = buildAssetPayload(assetType, selectedAsset);
    onConfirm(payload);
  };

  const assetIcon = getAssetIcon(assetType);

  return (
    <div className="mt-2 ml-7 pl-3 border-l-2 border-primary/30 py-2 space-y-3">
      <p className="text-xs font-medium text-foreground">
        Selecione {assetLabel ? `o ${assetLabel.toLowerCase()}` : "o ativo"}:
      </p>
      
      <RadioGroup value={selectedId || ""} onValueChange={setSelectedId} className="space-y-1">
        {flatAssets.map((asset) => (
          <div
            key={asset.id}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors",
              selectedId === asset.id 
                ? "border-primary bg-primary/5" 
                : "border-border hover:bg-muted/50"
            )}
            onClick={() => setSelectedId(asset.id)}
          >
            <RadioGroupItem value={asset.id} id={asset.id} />
            <div className="text-muted-foreground">{assetIcon}</div>
            <Label htmlFor={asset.id} className="flex-1 cursor-pointer">
              <span className="text-sm font-medium">{asset.label}</span>
              {asset.sublabel && (
                <span className="text-xs text-muted-foreground block">{asset.sublabel}</span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>

      <div className="flex gap-2">
        <Button 
          size="sm" 
          variant="default" 
          onClick={handleConfirm} 
          disabled={!selectedId || isLoading}
        >
          {isLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Confirmar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// === Catalog Selector ===

function CatalogSelector({
  onConfirm,
  onCancel,
  isLoading: parentLoading,
}: {
  onConfirm: (assets: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const { catalogs, isLoadingCatalogs, createCatalog, isCreating } = useMetaCatalog();
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");

  const loading = parentLoading || isLoadingCatalogs;

  const handleConfirm = () => {
    const catalog = catalogs.find(c => c.id === selectedCatalogId);
    if (!catalog) return;
    onConfirm({ catalog: { id: catalog.id, name: catalog.name } });
  };

  const handleCreate = () => {
    if (!newCatalogName.trim()) return;
    createCatalog(newCatalogName.trim(), {
      onSuccess: (catalog: any) => {
        onConfirm({ catalog: { id: catalog.id, name: catalog.name } });
      },
    } as any);
  };

  if (loading) {
    return (
      <div className="mt-2 ml-7 pl-3 border-l-2 border-primary/30 py-3 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando catálogos...</span>
      </div>
    );
  }

  if (showCreate) {
    return (
      <div className="mt-2 ml-7 pl-3 border-l-2 border-primary/30 py-2 space-y-3">
        <p className="text-xs font-medium text-foreground">Criar novo catálogo:</p>
        <Input
          placeholder="Nome do catálogo"
          value={newCatalogName}
          onChange={(e) => setNewCatalogName(e.target.value)}
          className="h-8 text-sm"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={handleCreate} disabled={!newCatalogName.trim() || isCreating}>
            {isCreating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Criar e vincular
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)} disabled={isCreating}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 ml-7 pl-3 border-l-2 border-primary/30 py-2 space-y-3">
      <p className="text-xs font-medium text-foreground">
        Selecione o catálogo:
      </p>

      {catalogs.length > 0 ? (
        <RadioGroup value={selectedCatalogId || ""} onValueChange={setSelectedCatalogId} className="space-y-1">
          {catalogs.map((cat) => (
            <div
              key={cat.id}
              className={cn(
                "flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors",
                selectedCatalogId === cat.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              )}
              onClick={() => setSelectedCatalogId(cat.id)}
            >
              <RadioGroupItem value={cat.id} id={`cat-${cat.id}`} />
              <div className="text-muted-foreground"><ShoppingBag className="h-4 w-4" /></div>
              <Label htmlFor={`cat-${cat.id}`} className="flex-1 cursor-pointer">
                <span className="text-sm font-medium">{cat.name}</span>
                {cat.product_count !== undefined && (
                  <span className="text-xs text-muted-foreground block">{cat.product_count} produto(s)</span>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhum catálogo encontrado na sua conta Meta.
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {catalogs.length > 0 && (
          <Button size="sm" variant="default" onClick={handleConfirm} disabled={!selectedCatalogId || parentLoading}>
            {parentLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Confirmar
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3 w-3" />
          Criar catálogo
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function getAssetIcon(assetType: MetaAssetType) {
  switch (assetType) {
    case "page": return <Globe className="h-4 w-4" />;
    case "instagram_account": return <Instagram className="h-4 w-4" />;
    case "waba_phone": return <Phone className="h-4 w-4" />;
    case "pixel": return <Crosshair className="h-4 w-4" />;
    case "ad_account": return <Megaphone className="h-4 w-4" />;
    case "catalog": return <ShoppingBag className="h-4 w-4" />;
    default: return <Building2 className="h-4 w-4" />;
  }
}

function buildAssetPayload(assetType: MetaAssetType, asset: FlatAsset): any {
  switch (assetType) {
    case "page":
      return {
        page: { id: asset.raw.id, name: asset.raw.name },
        business: { id: asset.businessId, name: asset.businessName },
      };
    case "instagram_account":
      return {
        instagram: { id: asset.raw.id, username: asset.raw.username, page_id: asset.raw.page_id },
        page: asset.raw.linked_page ? { id: asset.raw.linked_page.id, name: asset.raw.linked_page.name } : undefined,
        business: { id: asset.businessId, name: asset.businessName },
      };
    case "waba_phone":
      return {
        phone: asset.raw,
        business: { id: asset.businessId, name: asset.businessName },
      };
    case "pixel":
      return {
        pixel: { id: asset.raw.id, name: asset.raw.name },
        business: { id: asset.businessId, name: asset.businessName },
      };
    case "ad_account":
      return {
        ad_account: { id: asset.raw.id, name: asset.raw.name },
        business: { id: asset.businessId, name: asset.businessName },
      };
    default:
      return {};
  }
}

/**
 * Display component for showing which asset is currently linked
 */
export function MetaAssetDisplay({
  assetType,
  selectedAssets,
  onEdit,
  onRemove,
}: {
  assetType: MetaAssetType;
  selectedAssets: any;
  onEdit: () => void;
  onRemove: () => void;
}) {
  if (!selectedAssets || assetType === "none") return null;

  const { label, sublabel } = getAssetDisplayInfo(assetType, selectedAssets);
  if (!label) return null;

  const assetIcon = getAssetIcon(assetType);

  return (
    <div className="mt-1.5 ml-7 flex items-center gap-2">
      <div className="text-muted-foreground">{assetIcon}</div>
      <span className="text-xs text-foreground font-medium">{label}</span>
      {sublabel && (
        <span className="text-xs text-muted-foreground">({sublabel})</span>
      )}
      <div className="flex gap-1 ml-auto">
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onEdit}>
          Alterar
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={onRemove}>
          Remover
        </Button>
      </div>
    </div>
  );
}

function getAssetDisplayInfo(assetType: MetaAssetType, assets: any): { label: string | null; sublabel: string | null } {
  switch (assetType) {
    case "page":
      return { label: assets.page?.name || null, sublabel: assets.business?.name || null };
    case "instagram_account":
      return { 
        label: assets.instagram?.username ? `@${assets.instagram.username}` : null, 
        sublabel: assets.business?.name || null 
      };
    case "waba_phone":
      return { 
        label: assets.phone?.display_phone_number || assets.phone?.verified_name || null, 
        sublabel: assets.phone?.waba_name || assets.business?.name || null 
      };
    case "pixel":
      return { label: assets.pixel?.name || null, sublabel: assets.business?.name || null };
    case "ad_account":
      return { label: assets.ad_account?.name || null, sublabel: assets.business?.name || null };
    case "catalog":
      return { label: assets.catalog?.name || null, sublabel: null };
    default:
      return { label: null, sublabel: null };
  }
}
