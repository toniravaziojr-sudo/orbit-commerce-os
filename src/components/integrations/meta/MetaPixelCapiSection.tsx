import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Lock,
  Plus,
  Globe,
  Server,
  Facebook,
  Chrome,
  Crosshair,
} from "lucide-react";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { useMarketingIntegrations, MarketingIntegration } from "@/hooks/useMarketingIntegrations";

export function MetaPixelCapiSection() {
  const { config, isLoading, upsertConfig } = useMarketingIntegrations();
  const { isConnected, connection } = useMetaConnection();
  
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaTokenConfigured, setMetaTokenConfigured] = useState(false);
  const [additionalPixels, setAdditionalPixels] = useState<string[]>([]);
  const [newPixelId, setNewPixelId] = useState('');
  const [showManualCapi, setShowManualCapi] = useState(false);

  const primaryPixelId = config?.meta_pixel_id || '';
  const primaryPixelName = connection?.assets?.pixels?.find(p => p.id === primaryPixelId)?.name || '';
  const isCapiAutoConfigured = isConnected && primaryPixelId && metaTokenConfigured;

  useEffect(() => {
    if (config) {
      setMetaTokenConfigured(!!(config as any).meta_access_token);
      setAdditionalPixels(config.meta_additional_pixel_ids || []);
    }
  }, [config]);

  const handleAddPixel = () => {
    const trimmed = newPixelId.trim();
    if (!trimmed || additionalPixels.includes(trimmed) || trimmed === primaryPixelId) return;
    setAdditionalPixels([...additionalPixels, trimmed]);
    setNewPixelId('');
  };

  const handleRemovePixel = (pixelId: string) => {
    setAdditionalPixels(additionalPixels.filter(p => p !== pixelId));
  };

  const handleSave = async () => {
    const updates: Partial<MarketingIntegration> = {
      meta_additional_pixel_ids: additionalPixels.length > 0 ? additionalPixels : null,
    };
    if (metaAccessToken) {
      (updates as any).meta_access_token = metaAccessToken;
      updates.meta_capi_enabled = true;
    }
    await upsertConfig.mutateAsync(updates);
    setMetaAccessToken('');
    setShowManualCapi(false);
  };

  if (isLoading) return null;

  const isActive = config?.meta_enabled && primaryPixelId;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Crosshair className="h-4 w-4" />
        Pixel & Conversions API
        {isActive && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
            <CheckCircle className="h-3 w-3 mr-1" /> Ativo
          </Badge>
        )}
      </h4>
      
      <div className="rounded-lg border p-4 space-y-4">
        <div className="space-y-3">
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
              Adicione outros Pixel IDs para disparar eventos em múltiplos pixels simultaneamente.
            </p>
            
            {additionalPixels.length > 0 && (
              <div className="space-y-1.5">
                {additionalPixels.map((pixelId) => (
                  <div key={pixelId} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                    <span className="text-sm font-mono flex-1">{pixelId}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemovePixel(pixelId)}>×</Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input placeholder="ID do pixel adicional" value={newPixelId} onChange={(e) => setNewPixelId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddPixel()} className="flex-1" />
              <Button variant="outline" size="sm" onClick={handleAddPixel} disabled={!newPixelId.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            Server-side (Conversions API)
          </div>
          
          {isCapiAutoConfigured ? (
            <>
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Conversions API ativa</p>
                  <p className="text-xs text-muted-foreground">Token sincronizado automaticamente (~60 dias).</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">Automático</Badge>
              </div>
              
              <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => setShowManualCapi(!showManualCapi)}>
                {showManualCapi ? 'Ocultar opção manual' : 'Usar token manual (avançado)'}
              </button>

              {showManualCapi && (
                <div className="space-y-2 pl-2 border-l-2 border-muted">
                  <p className="text-xs text-muted-foreground">Token manual permanente (System User Token) substitui o automático.</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-access-token" className="text-sm flex items-center gap-2">
                      <Lock className="h-3 w-3" />Token Manual
                    </Label>
                    <Input id="meta-access-token" type="password" placeholder="Cole o System User Token aqui" value={metaAccessToken} onChange={(e) => setMetaAccessToken(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Conversions API</Label>
                  <p className="text-xs text-muted-foreground">Melhora atribuição e reduz perda por bloqueadores</p>
                </div>
                {metaTokenConfigured ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" /> Configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Não configurado</Badge>
                )}
              </div>
              
              {isConnected && primaryPixelId && !metaTokenConfigured ? (
                <Alert className="bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs">Reconecte sua conta Meta para ativar a CAPI automaticamente.</AlertDescription>
                </Alert>
              ) : !isConnected ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">Conecte sua conta Meta para ativar Pixel e CAPI.</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="meta-access-token-fallback" className="text-sm flex items-center gap-2">
                  <Lock className="h-3 w-3" />Access Token
                </Label>
                <Input id="meta-access-token-fallback" type="password" placeholder={metaTokenConfigured ? '••••••••••••' : 'Cole seu access token aqui'} value={metaAccessToken} onChange={(e) => setMetaAccessToken(e.target.value)} />
              </div>
            </>
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
