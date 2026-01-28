// =============================================
// TIKTOK INTEGRATION CARD
// OAuth-based TikTok integration with manual fallback
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Music2,
  Lock,
  Server,
  Globe,
  Link2,
  Unlink,
  ChevronDown,
  Settings
} from 'lucide-react';
import { useTikTokConnection } from '@/hooks/useTikTokConnection';
import { MarketingIntegration } from '@/hooks/useMarketingIntegrations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TikTokIntegrationCardProps {
  config: MarketingIntegration | null | undefined;
  upsertConfig: {
    mutateAsync: (updates: Partial<MarketingIntegration>) => Promise<any>;
    isPending: boolean;
  };
}

function StatusIndicator({ status }: { status: string }) {
  if (status === 'active') {
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

export function TikTokIntegrationCard({ config, upsertConfig }: TikTokIntegrationCardProps) {
  const { 
    connectionStatus, 
    isLoading, 
    isConnecting, 
    isDisconnecting,
    connect, 
    disconnect 
  } = useTikTokConnection();

  // Local state for Pixel ID (can be configured even without OAuth)
  const [tiktokPixelId, setTiktokPixelId] = useState('');
  const [tiktokEnabled, setTiktokEnabled] = useState(false);
  const [tiktokEventsApiEnabled, setTiktokEventsApiEnabled] = useState(false);
  
  // Manual mode state (for App Review / testing)
  const [manualModeOpen, setManualModeOpen] = useState(false);
  const [manualAccessToken, setManualAccessToken] = useState('');
  const [manualTokenConfigured, setManualTokenConfigured] = useState(false);

  // Sync local state when config loads
  useEffect(() => {
    if (config) {
      setTiktokPixelId(config.tiktok_pixel_id || '');
      setTiktokEnabled(config.tiktok_enabled);
      setTiktokEventsApiEnabled(config.tiktok_events_api_enabled);
      setManualTokenConfigured(!!(config as any).tiktok_access_token);
    }
  }, [config]);

  const handleSavePixel = async () => {
    const updates: Partial<MarketingIntegration> = {
      tiktok_pixel_id: tiktokPixelId || null,
      tiktok_enabled: tiktokEnabled,
      tiktok_events_api_enabled: tiktokEventsApiEnabled,
      tiktok_status: tiktokEnabled && tiktokPixelId ? 'active' : 'inactive',
    };
    
    await upsertConfig.mutateAsync(updates);
  };

  const handleSaveManualToken = async () => {
    if (!manualAccessToken) return;
    
    const updates: Partial<MarketingIntegration> = {
      tiktok_enabled: true,
      tiktok_events_api_enabled: true,
      tiktok_status: 'active',
    };
    
    // Add token to updates
    (updates as any).tiktok_access_token = manualAccessToken;
    
    await upsertConfig.mutateAsync(updates);
    setManualAccessToken('');
    setManualTokenConfigured(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="h-5 w-5" />
              TikTok for Business
            </CardTitle>
            <CardDescription>
              Conecte sua conta TikTok para rastrear conversões e otimizar campanhas
            </CardDescription>
          </div>
          <StatusIndicator status={connectionStatus.isConnected ? 'active' : 'inactive'} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* OAuth Connection Section */}
        {connectionStatus.isConnected ? (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    Conta conectada: {connectionStatus.advertiserName || connectionStatus.advertiserId}
                  </span>
                  {connectionStatus.connectedAt && (
                    <span className="text-xs opacity-75">
                      Conectado em {format(new Date(connectionStatus.connectedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  )}
                  {connectionStatus.isExpired && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      ⚠️ Token expirado - reconecte para continuar
                    </span>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={connect}
                disabled={isConnecting}
              >
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                Reconectar
              </Button>
              <Button 
                variant="ghost" 
                onClick={disconnect}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive"
              >
                {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4" />
              Conexão OAuth
            </div>
            
            <p className="text-sm text-muted-foreground">
              Conecte sua conta TikTok for Business para habilitar o rastreamento de conversões automaticamente.
            </p>
            
            <Button 
              onClick={connect}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Music2 className="h-4 w-4" />
              )}
              Conectar TikTok
            </Button>
          </div>
        )}

        <Separator />

        {/* Pixel Configuration - Always available */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4" />
            Client-side (Pixel)
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="tiktok-enabled">Ativar TikTok Pixel</Label>
            <Switch
              id="tiktok-enabled"
              checked={tiktokEnabled}
              onCheckedChange={setTiktokEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tiktok-pixel-id">Pixel ID</Label>
            <Input
              id="tiktok-pixel-id"
              placeholder="XXXXXXXXXXXXXXXXX"
              value={tiktokPixelId}
              onChange={(e) => setTiktokPixelId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Encontre seu Pixel ID no{' '}
              <a 
                href="https://ads.tiktok.com/marketing_api/apps" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                TikTok Ads Manager <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="tiktok-events-api-enabled">Ativar Events API (Server-side)</Label>
              <p className="text-xs text-muted-foreground">
                {connectionStatus.isConnected 
                  ? "Habilitado automaticamente via OAuth" 
                  : "Requer conexão OAuth ou token manual"}
              </p>
            </div>
            <Switch
              id="tiktok-events-api-enabled"
              checked={tiktokEventsApiEnabled}
              onCheckedChange={setTiktokEventsApiEnabled}
              disabled={!connectionStatus.isConnected && !manualTokenConfigured}
            />
          </div>

          <Button onClick={handleSavePixel} disabled={upsertConfig.isPending}>
            {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Configurações
          </Button>
        </div>

        {/* Manual Mode (for App Review) */}
        <Separator />
        
        <Collapsible open={manualModeOpen} onOpenChange={setManualModeOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Settings className="h-4 w-4" />
                Modo Manual (Avançado)
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${manualModeOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Use o modo manual apenas para testes ou se o OAuth não estiver disponível.
                Para produção, recomendamos usar a conexão OAuth.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="manual-access-token" className="flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Access Token Manual
                {manualTokenConfigured && (
                  <Badge variant="secondary" className="text-xs">Configurado</Badge>
                )}
              </Label>
              <Input
                id="manual-access-token"
                type="password"
                placeholder={manualTokenConfigured ? '••••••••••••' : 'Cole seu access token aqui'}
                value={manualAccessToken}
                onChange={(e) => setManualAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Token de acesso do TikTok Marketing API. Gere em{' '}
                <a 
                  href="https://business-api.tiktok.com/portal/apps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  TikTok Developer Portal <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <Button 
              onClick={handleSaveManualToken} 
              disabled={!manualAccessToken || upsertConfig.isPending}
              variant="secondary"
            >
              {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Token Manual
            </Button>
          </CollapsibleContent>
        </Collapsible>

        {config?.tiktok_last_error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{config.tiktok_last_error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
