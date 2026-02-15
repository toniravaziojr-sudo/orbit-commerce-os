// =============================================
// TIKTOK UNIFIED SETTINGS (Hub v2)
// Hub centralizado TikTok em /integrations
// 3 cards: Ads (ativo), Shop (em breve), Content (em breve)
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
  ShoppingBag, Video, Lock
} from 'lucide-react';
import { useTikTokAdsConnection } from '@/hooks/useTikTokAdsConnection';
import { useMarketingIntegrations } from '@/hooks/useMarketingIntegrations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusBadge } from '@/components/ui/status-badge';

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
    connectionStatus, isLoading, isConnecting, isDisconnecting, 
    connect, disconnect 
  } = useTikTokAdsConnection();

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

  if (isLoading) {
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
            <ConnectionStatusBadge status={connectionStatus.connectionStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection section */}
          {connectionStatus.isConnected ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">
                      {connectionStatus.advertiserName || connectionStatus.advertiserId || 'Conta conectada'}
                    </span>
                    {connectionStatus.connectedAt && (
                      <span className="text-xs opacity-75">
                        Conectado em {format(new Date(connectionStatus.connectedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    )}
                    {connectionStatus.isExpired && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ Token expirado — reconecte para continuar
                      </span>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {/* Scope Packs */}
              {connectionStatus.scopePacks.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Packs habilitados</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {connectionStatus.scopePacks.map(pack => (
                      <Badge key={pack} variant="secondary" className="text-xs">
                        {pack}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Assets */}
              {connectionStatus.assets.advertiser_ids && connectionStatus.assets.advertiser_ids.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Advertisers</Label>
                  <p className="text-sm font-mono">{connectionStatus.assets.advertiser_ids.join(', ')}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => connect()} disabled={isConnecting} size="sm">
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                  Reconectar
                </Button>
                <Button variant="ghost" onClick={disconnect} disabled={isDisconnecting} size="sm"
                  className="text-destructive hover:text-destructive">
                  {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta TikTok for Business para habilitar rastreamento de conversões e gestão de campanhas.
              </p>
              <Button onClick={() => connect()} disabled={isConnecting} className="gap-2">
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music2 className="h-4 w-4" />}
                Conectar TikTok Ads
              </Button>
            </div>
          )}

          {connectionStatus.lastError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{connectionStatus.lastError}</AlertDescription>
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
                  {connectionStatus.isConnected ? "Habilitado via OAuth" : "Requer conexão OAuth"}
                </p>
              </div>
              <Switch id="tiktok-events-api" checked={eventsApiEnabled} onCheckedChange={setEventsApiEnabled}
                disabled={!connectionStatus.isConnected} />
            </div>

            <Button onClick={handleSavePixel} disabled={upsertConfig.isPending} size="sm">
              {upsertConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Pixel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: TikTok Shop — Em breve */}
      <Card className="opacity-60">
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
            <StatusBadge variant="default">Em breve</StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Requer credenciais separadas (TikTok Shop Partner Center)
          </div>
        </CardContent>
      </Card>

      {/* Card 3: TikTok Content — Em breve */}
      <Card className="opacity-60">
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
            <StatusBadge variant="default">Em breve</StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Requer credenciais separadas (TikTok for Developers)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
