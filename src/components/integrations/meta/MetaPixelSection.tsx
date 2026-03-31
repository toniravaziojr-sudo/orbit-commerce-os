import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Plus,
  Globe,
  Crosshair,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { useMarketingIntegrations, MarketingIntegration } from "@/hooks/useMarketingIntegrations";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";

export function MetaPixelSection() {
  const { config, isLoading, upsertConfig } = useMarketingIntegrations();
  const { isConnected, connection } = useMetaConnection();
  const { grant } = useMetaIntegrations();

  const [additionalPixels, setAdditionalPixels] = useState<Array<{ id: string; name: string }>>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [selectedPixelId, setSelectedPixelId] = useState<string | null>(null);

  const primaryPixelId = config?.meta_pixel_id || '';
  const primaryPixelName = connection?.assets?.pixels?.find(p => p.id === primaryPixelId)?.name || '';

  // Get all available pixels from discovered assets
  const availablePixels = useMemo(() => {
    const pixels: Array<{ id: string; name: string; businessName: string; compositeId: string }> = [];
    const businesses = grant?.discoveredAssets?.businesses ?? [];
    for (const biz of businesses) {
      for (const pixel of biz.pixels || []) {
        // Exclude the primary pixel and already-added pixels
        const alreadyAdded = additionalPixels.some(p => p.id === pixel.id);
        if (pixel.id !== primaryPixelId && !alreadyAdded) {
          pixels.push({
            id: pixel.id,
            name: pixel.name || `Pixel ${pixel.id}`,
            businessName: biz.name,
            compositeId: `${biz.id}:${pixel.id}`,
          });
        }
      }
    }
    return pixels;
  }, [grant?.discoveredAssets, primaryPixelId, additionalPixels]);

  useEffect(() => {
    if (config?.meta_additional_pixel_ids) {
      // Convert legacy string[] to {id, name}[] format
      const existing = config.meta_additional_pixel_ids;
      const parsed = existing.map((id: string) => {
        // Try to find name from discovered assets
        const businesses = grant?.discoveredAssets?.businesses ?? [];
        for (const biz of businesses) {
          const found = biz.pixels?.find(p => p.id === id);
          if (found) return { id, name: found.name || id };
        }
        return { id, name: id };
      });
      setAdditionalPixels(parsed);
    }
  }, [config?.meta_additional_pixel_ids, grant?.discoveredAssets]);

  const handleAddPixel = () => {
    if (!selectedPixelId) return;
    const pixel = availablePixels.find(p => p.compositeId === selectedPixelId);
    if (!pixel) return;
    setAdditionalPixels(prev => [...prev, { id: pixel.id, name: pixel.name }]);
    setSelectedPixelId(null);
    setShowSelector(false);
  };

  const handleRemovePixel = (pixelId: string) => {
    setAdditionalPixels(prev => prev.filter(p => p.id !== pixelId));
  };

  const handleSave = async () => {
    const ids = additionalPixels.map(p => p.id);
    const updates: Partial<MarketingIntegration> = {
      meta_additional_pixel_ids: ids.length > 0 ? ids : null,
    };
    await upsertConfig.mutateAsync(updates);
  };

  if (isLoading) return null;

  const isActive = config?.meta_enabled && primaryPixelId;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Crosshair className="h-4 w-4" />
        Pixel Facebook
        {isActive && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
            <CheckCircle className="h-3 w-3 mr-1" /> Ativo
          </Badge>
        )}
      </h4>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Client-side (Pixel)
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Pixel Principal</Label>
          {primaryPixelId ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono">{primaryPixelId}</p>
                {primaryPixelName && <p className="text-xs text-muted-foreground">{primaryPixelName}</p>}
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">Automático</Badge>
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Nenhum pixel conectado. Conecte sua conta Meta e selecione um Pixel nos ativos.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <Label className="text-sm">Pixels Adicionais (opcional)</Label>
          <p className="text-xs text-muted-foreground">
            Selecione outros pixels da sua conta Meta para disparar eventos em múltiplos pixels simultaneamente.
          </p>

          {additionalPixels.length > 0 && (
            <div className="space-y-1.5">
              {additionalPixels.map((pixel) => (
                <div key={pixel.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{pixel.name}</span>
                    <span className="text-xs text-muted-foreground block font-mono">{pixel.id}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" 
                    onClick={() => handleRemovePixel(pixel.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {showSelector ? (
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-medium text-foreground">Selecione o pixel:</p>
              {availablePixels.length > 0 ? (
                <RadioGroup value={selectedPixelId || ""} onValueChange={setSelectedPixelId} className="space-y-1">
                  {availablePixels.map((pixel) => (
                    <div
                      key={pixel.compositeId}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors",
                        selectedPixelId === pixel.compositeId
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedPixelId(pixel.compositeId)}
                    >
                      <RadioGroupItem value={pixel.compositeId} id={`add-pixel-${pixel.compositeId}`} />
                      <Crosshair className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={`add-pixel-${pixel.compositeId}`} className="flex-1 cursor-pointer">
                        <span className="text-sm font-medium">{pixel.name}</span>
                        <span className="text-xs text-muted-foreground block">{pixel.businessName}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhum pixel adicional disponível na sua conta Meta.
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="default" onClick={handleAddPixel} disabled={!selectedPixelId}>
                  Adicionar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowSelector(false); setSelectedPixelId(null); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowSelector(true)} className="gap-1">
              <Plus className="h-4 w-4" />
              Adicionar pixel
            </Button>
          )}
        </div>

        <Button size="sm" onClick={handleSave} disabled={upsertConfig.isPending}>
          {upsertConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
