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
  Loader2, CheckCircle, AlertTriangle, XCircle,
  Music2, Link2, Unlink, Globe, Server, RefreshCw,
  ShoppingBag, Video
} from 'lucide-react';
import { useTikTokAdsConnection } from '@/hooks/useTikTokAdsConnection';
import { useTikTokShopConnection } from '@/hooks/useTikTokShopConnection';
import { useTikTokContentConnection } from '@/hooks/useTikTokContentConnection';
import { useMarketingIntegrations } from '@/hooks/useMarketingIntegrations';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TikTokSubConnection {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  apiLabel: string;
  isConnected: boolean;
  isExpired: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  connectedAt?: string;
  displayName?: string;
  lastError?: string;
  scopePacks: string[];
  extraInfo?: React.ReactNode;
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

  const [pixelId, setPixelId] = useState('');
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [eventsApiEnabled, setEventsApiEnabled] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const isLoading = adsLoading || shopLoading || contentLoading;

  useEffect(() => {
    if (!isLoading && !initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [isLoading, initialLoadComplete]);

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

  if (isLoading && !initialLoadComplete) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Count connected APIs
  const connectedCount = [adsStatus.isConnected, shopStatus.isConnected, contentStatus.isConnected].filter(Boolean).length;
  const anyConnected = connectedCount > 0;
  const anyExpired = [adsStatus.isExpired, shopStatus.isExpired, contentStatus.isExpired].some(Boolean);

  // Build sub-connections array
  const subConnections: TikTokSubConnection[] = [
    {
      id: 'ads',
      label: 'TikTok Ads',
      description: 'Pixel, Events API (CAPI) e gestão de campanhas',
      icon: <Globe className="h-4 w-4" />,
      apiLabel: 'Marketing API',
      isConnected: adsStatus.isConnected,
      isExpired: adsStatus.isExpired,
      isConnecting: adsConnecting,
      isDisconnecting: adsDisconnecting,
      connect: () => adsConnect(),
      disconnect: adsDisconnect,
      connectedAt: adsStatus.connectedAt,
      displayName: adsStatus.advertiserName || adsStatus.advertiserId,
      lastError: adsStatus.lastError,
      scopePacks: adsStatus.scopePacks,
      extraInfo: adsStatus.assets.advertiser_ids?.length > 0 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Advertisers</span>
          <span className="text-sm font-mono">{adsStatus.assets.advertiser_ids.join(', ')}</span>
        </div>
      ) : null,
    },
    {
      id: 'shop',
      label: 'TikTok Shop',
      description: 'Catálogo, pedidos, fulfillment e atendimento',
      icon: <ShoppingBag className="h-4 w-4" />,
      apiLabel: 'Seller API',
      isConnected: shopStatus.isConnected,
      isExpired: shopStatus.isExpired,
      isConnecting: shopConnecting,
      isDisconnecting: shopDisconnecting,
      connect: () => shopConnect(),
      disconnect: shopDisconnect,
      connectedAt: shopStatus.connectedAt,
      displayName: shopStatus.shopName || shopStatus.shopId,
      lastError: shopStatus.lastError,
      scopePacks: shopStatus.scopePacks,
      extraInfo: shopStatus.assets.shops && Array.isArray(shopStatus.assets.shops) && shopStatus.assets.shops.length > 0 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Lojas</span>
          <div className="text-sm text-right">
            {(shopStatus.assets.shops as any[]).map((shop: any, i: number) => (
              <span key={i} className="block">
                <span className="font-medium">{shop.name}</span>
                {shop.region && <span className="text-muted-foreground ml-1">({shop.region})</span>}
              </span>
            ))}
          </div>
        </div>
      ) : null,
    },
    {
      id: 'content',
      label: 'TikTok Content',
      description: 'Publicação orgânica de vídeos e analytics',
      icon: <Video className="h-4 w-4" />,
      apiLabel: 'Login Kit',
      isConnected: contentStatus.isConnected,
      isExpired: contentStatus.isExpired,
      isConnecting: contentConnecting,
      isDisconnecting: contentDisconnecting,
      connect: () => contentConnect(),
      disconnect: contentDisconnect,
      connectedAt: contentStatus.connectedAt,
      displayName: contentStatus.displayName || contentStatus.openId,
      lastError: contentStatus.lastError,
      scopePacks: contentStatus.scopePacks,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header Card — Connection Status (same pattern as Meta/Google) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Music2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                TikTok
                {anyConnected && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {connectedCount}/3 Conectado{connectedCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {anyExpired && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Token expirado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Conecte suas contas TikTok para anúncios, loja e publicações orgânicas
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {/* Sub-connections listed inside the main card */}
        <CardContent className="space-y-1 pt-0">
          {subConnections.map((sub, idx) => (
            <TikTokSubConnectionRow
              key={sub.id}
              sub={sub}
              isLast={idx === subConnections.length - 1}
            />
          ))}
        </CardContent>
      </Card>

      {/* Pixel / CAPI Config — separate card like Meta's Pixel section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Server className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Pixel e Events API</CardTitle>
              <CardDescription className="text-xs">
                Rastreamento de conversões no TikTok
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                {adsStatus.isConnected ? "Habilitado via OAuth" : "Requer conexão OAuth do TikTok Ads"}
              </p>
            </div>
            <Switch id="tiktok-events-api" checked={eventsApiEnabled} onCheckedChange={setEventsApiEnabled}
              disabled={!adsStatus.isConnected} />
          </div>

          <Button onClick={handleSavePixel} disabled={upsertConfig.isPending} size="sm">
            {upsertConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Pixel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// === Sub-connection row (similar to Meta's integration toggle rows) ===

function TikTokSubConnectionRow({ sub, isLast }: { sub: TikTokSubConnection; isLast: boolean }) {
  return (
    <div className={cn("py-3", !isLast && "border-b border-border/50")}>
      {/* Main row */}
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{sub.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{sub.label}</span>
            <Badge variant="outline" className="text-[10px]">{sub.apiLabel}</Badge>
            {sub.isConnected && (
              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                Ativo
              </Badge>
            )}
            {sub.isExpired && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                Expirado
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{sub.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {sub.isConnected ? (
            <>
              <Button variant="outline" size="sm" onClick={sub.connect} disabled={sub.isConnecting} className="gap-1.5 h-7 text-xs">
                {sub.isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Reconectar
              </Button>
              <Button variant="ghost" size="sm" onClick={sub.disconnect} disabled={sub.isDisconnecting}
                className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive">
                {sub.isDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                Desconectar
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={sub.connect} disabled={sub.isConnecting} className="gap-1.5 h-7 text-xs">
              {sub.isConnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              Conectar
            </Button>
          )}
        </div>
      </div>

      {/* Connection details (shown when connected, like Meta's connection info) */}
      {sub.isConnected && (
        <div className="ml-7 mt-2 rounded-lg border p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Conta</span>
            <span className="font-medium">{sub.displayName || 'Conta conectada'}</span>
          </div>
          {sub.connectedAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Conectado há</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(sub.connectedAt), { locale: ptBR, addSuffix: true })}
              </span>
            </div>
          )}
          {sub.scopePacks.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Permissões</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {sub.scopePacks.map(pack => (
                  <Badge key={pack} variant="secondary" className="text-xs">{pack}</Badge>
                ))}
              </div>
            </div>
          )}
          {sub.extraInfo}
        </div>
      )}

      {/* Error display */}
      {sub.lastError && (
        <div className="ml-7 mt-2">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{sub.lastError}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
