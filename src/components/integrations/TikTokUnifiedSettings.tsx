// =============================================
// TIKTOK UNIFIED SETTINGS (Hub v3)
// Hub centralizado TikTok em /integrations
// 3 cards: Ads (ativo), Shop (ativo), Content (em breve)
// =============================================

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, CheckCircle2, XCircle, AlertCircle,
  Music2, Link2, Unlink, Globe, Server,
  ShoppingBag, Video
} from 'lucide-react';
import { useTikTokAdsConnection } from '@/hooks/useTikTokAdsConnection';
import { useTikTokShopConnection } from '@/hooks/useTikTokShopConnection';
import { useTikTokContentConnection } from '@/hooks/useTikTokContentConnection';
import { useMarketingIntegrations } from '@/hooks/useMarketingIntegrations';
import { TikTokShopPanel } from './tiktok/TikTokShopPanel';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function ConnectionStatusBadge({ status }: { status: string }) {
  if (status === 'connected') {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Conectado
      </Badge>
    );
  }
  if (status === 'error') {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
        <XCircle className="h-3 w-3 mr-1" />
        Erro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
      <AlertCircle className="h-3 w-3 mr-1" />
      Não conectado
    </Badge>
  );
}

export function TikTokUnifiedSettings() {
  const { 
    connectionStatus: adsStatus, isLoading: adsLoading, isConnecting: adsConnecting, 
    isDisconnecting: adsDisconnecting, connect: adsConnect, disconnect: adsDisconnect 
  } = useTikTokAdsConnection();

  const {
    connectionStatus: shopStatus, isLoading: shopLoading, isConnecting: shopConnecting,
    isDisconnecting: shopDisconnecting, connect: shopConnect, disconnect: shopDisconnect
  } = useTikTokShopConnection();

  const {
    connectionStatus: contentStatus, isLoading: contentLoading, isConnecting: contentConnecting,
    isDisconnecting: contentDisconnecting, connect: contentConnect, disconnect: contentDisconnect
  } = useTikTokContentConnection();

  const { config: marketingConfig, upsertConfig } = useMarketingIntegrations();

  // Local state for Pixel (can be configured independently)
  const [pixelId, setPixelId] = useState('');
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [eventsApiEnabled, setEventsApiEnabled] = useState(false);

  useEffect(() => {
    if (marketingConfig) {
      setPixelId(marketingConfig.tiktok_pixel_id || '');
      setPixelEnabled(marketingConfig.tiktok_enabled);
      setEventsApiEnabled(marketingConfig.tiktok_events_api_enabled);
    }
  }, [marketingConfig]);

  const handleSavePixel = async () => {
    await upsertConfig.mutateAsync({
      tiktok_pixel_id: pixelId || null,
      tiktok_enabled: pixelEnabled,
      tiktok_events_api_enabled: eventsApiEnabled,
      tiktok_status: pixelEnabled && pixelId ? 'active' : 'inactive',
    });
  };

  if (adsLoading || shopLoading || contentLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Music2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Hub TikTok</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie todas as integrações TikTok em um só lugar
          </p>
        </div>
      </div>

      {/* Card 1: TikTok Ads (Marketing API) — Ativo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" />
                TikTok Ads
                <Badge variant="secondary" className="text-xs">Marketing API</Badge>
              </CardTitle>
              <CardDescription>
                Pixel, Events API (CAPI) e gestão de campanhas
              </CardDescription>
            </div>
            <ConnectionStatusBadge status={adsStatus.connectionStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection section */}
          {adsStatus.isConnected ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {adsStatus.advertiserName || adsStatus.advertiserId || 'Conta conectada'}
                    </span>
                    {adsStatus.connectedAt && (
                      <span className="text-xs opacity-75">
                        Conectado em {format(new Date(adsStatus.connectedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    )}
                    {adsStatus.isExpired && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ Token expirado — reconecte para continuar
                      </span>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {/* Scope Packs */}
              {adsStatus.scopePacks.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Packs habilitados</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {adsStatus.scopePacks.map(pack => (
                      <Badge key={pack} variant="secondary" className="text-xs">
                        {pack}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Assets */}
              {adsStatus.assets.advertiser_ids && adsStatus.assets.advertiser_ids.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Advertisers</Label>
                  <p className="text-sm font-mono">{adsStatus.assets.advertiser_ids.join(', ')}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => adsConnect()} disabled={adsConnecting} size="sm">
                  {adsConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                  Reconectar
                </Button>
                <Button variant="ghost" onClick={adsDisconnect} disabled={adsDisconnecting} size="sm"
                  className="text-destructive hover:text-destructive">
                  {adsDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta TikTok for Business para habilitar rastreamento de conversões e gestão de campanhas.
              </p>
              <Button onClick={() => adsConnect()} disabled={adsConnecting} className="gap-2">
                {adsConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music2 className="h-4 w-4" />}
                Conectar TikTok Ads
              </Button>
            </div>
          )}

          {adsStatus.lastError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{adsStatus.lastError}</AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Pixel / CAPI Config */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Server className="h-4 w-4" />
              Pixel e Events API
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="tiktok-pixel-enabled">Ativar TikTok Pixel</Label>
              <Switch id="tiktok-pixel-enabled" checked={pixelEnabled} onCheckedChange={setPixelEnabled} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tiktok-pixel-id">Pixel ID</Label>
              <Input id="tiktok-pixel-id" placeholder="XXXXXXXXXXXXXXXXX" value={pixelId} onChange={(e) => setPixelId(e.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="tiktok-events-api">Events API (Server-side)</Label>
                <p className="text-xs text-muted-foreground">
                  {adsStatus.isConnected ? "Habilitado via OAuth" : "Requer conexão OAuth"}
                </p>
              </div>
              <Switch id="tiktok-events-api" checked={eventsApiEnabled} onCheckedChange={setEventsApiEnabled}
                disabled={!adsStatus.isConnected} />
            </div>

            <Button onClick={handleSavePixel} disabled={upsertConfig.isPending} size="sm">
              {upsertConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Pixel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: TikTok Shop — Ativo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-4 w-4" />
                TikTok Shop
                <Badge variant="secondary" className="text-xs">Seller API</Badge>
              </CardTitle>
              <CardDescription>
                Catálogo, pedidos, fulfillment e atendimento
              </CardDescription>
            </div>
            <ConnectionStatusBadge status={shopStatus.connectionStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {shopStatus.isConnected ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {shopStatus.shopName || shopStatus.shopId || 'Loja conectada'}
                    </span>
                    {shopStatus.shopRegion && (
                      <span className="text-xs opacity-75">
                        Região: {shopStatus.shopRegion}
                      </span>
                    )}
                    {shopStatus.connectedAt && (
                      <span className="text-xs opacity-75">
                        Conectado em {format(new Date(shopStatus.connectedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    )}
                    {shopStatus.isExpired && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ Token expirado — reconecte para continuar
                      </span>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {/* Scope Packs */}
              {shopStatus.scopePacks.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Packs habilitados</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {shopStatus.scopePacks.map(pack => (
                      <Badge key={pack} variant="secondary" className="text-xs">
                        {pack}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Shops */}
              {shopStatus.assets.shops && Array.isArray(shopStatus.assets.shops) && shopStatus.assets.shops.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Lojas autorizadas</Label>
                  <div className="space-y-1">
                    {(shopStatus.assets.shops as any[]).map((shop: any, i: number) => (
                      <p key={i} className="text-sm">
                        <span className="font-medium">{shop.name}</span>
                        {shop.region && <span className="text-muted-foreground ml-1">({shop.region})</span>}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => shopConnect()} disabled={shopConnecting} size="sm">
                  {shopConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                  Reconectar
                </Button>
                <Button variant="ghost" onClick={shopDisconnect} disabled={shopDisconnecting} size="sm"
                  className="text-destructive hover:text-destructive">
                  {shopDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </div>

              {/* Operational Panel */}
              <Separator />
              <TikTokShopPanel />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte sua loja TikTok Shop para sincronizar catálogo, pedidos e fulfillment.
              </p>
              <Button onClick={() => shopConnect()} disabled={shopConnecting} className="gap-2">
                {shopConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                Conectar TikTok Shop
              </Button>
            </div>
          )}

          {shopStatus.lastError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{shopStatus.lastError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Card 3: TikTok Content — Ativo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-4 w-4" />
                TikTok Content
                <Badge variant="secondary" className="text-xs">Login Kit</Badge>
              </CardTitle>
              <CardDescription>
                Publicação orgânica de vídeos e analytics
              </CardDescription>
            </div>
            <ConnectionStatusBadge status={contentStatus.connectionStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {contentStatus.isConnected ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {contentStatus.displayName || contentStatus.openId || 'Conta conectada'}
                    </span>
                    {contentStatus.connectedAt && (
                      <span className="text-xs opacity-75">
                        Conectado em {format(new Date(contentStatus.connectedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    )}
                    {contentStatus.isExpired && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ Token expirado — reconecte para continuar
                      </span>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {/* Scope Packs */}
              {contentStatus.scopePacks.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Packs habilitados</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {contentStatus.scopePacks.map(pack => (
                      <Badge key={pack} variant="secondary" className="text-xs">
                        {pack}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => contentConnect()} disabled={contentConnecting} size="sm">
                  {contentConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                  Reconectar
                </Button>
                <Button variant="ghost" onClick={contentDisconnect} disabled={contentDisconnecting} size="sm"
                  className="text-destructive hover:text-destructive">
                  {contentDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta TikTok para publicar vídeos orgânicos e acompanhar analytics.
              </p>
              <Button onClick={() => contentConnect()} disabled={contentConnecting} className="gap-2">
                {contentConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                Conectar TikTok Content
              </Button>
            </div>
          )}

          {contentStatus.lastError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{contentStatus.lastError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
