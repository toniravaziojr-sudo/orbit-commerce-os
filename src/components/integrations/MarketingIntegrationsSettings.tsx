// =============================================
// MARKETING INTEGRATIONS SETTINGS
// UI for configuring Meta/Google/TikTok integrations per tenant
// =============================================

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Facebook,
  Chrome,
  Music2,
  Lock,
  Server,
  Globe,
  FileText,
  Copy
} from 'lucide-react';
import { useMarketingIntegrations, MarketingIntegration } from '@/hooks/useMarketingIntegrations';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

function StatusIndicator({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Ativo
      </Badge>
    );
  }
  if (status === 'error') {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <XCircle className="h-3 w-3 mr-1" />
        Erro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
      <AlertCircle className="h-3 w-3 mr-1" />
      Inativo
    </Badge>
  );
}

function maskToken(token: string | null): string {
  if (!token) return '';
  if (token.length <= 8) return '••••••••';
  return `••••••${token.slice(-4)}`;
}

export function MarketingIntegrationsSettings() {
  const { config, isLoading, upsertConfig } = useMarketingIntegrations();
  const { currentTenant } = useAuth();
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('meta');

  // Local state for form values
  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaEnabled, setMetaEnabled] = useState(false);
  const [metaCapiEnabled, setMetaCapiEnabled] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaTokenConfigured, setMetaTokenConfigured] = useState(false);
  
  const [googleMeasurementId, setGoogleMeasurementId] = useState('');
  const [googleAdsConversionId, setGoogleAdsConversionId] = useState('');
  const [googleAdsConversionLabel, setGoogleAdsConversionLabel] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleApiSecret, setGoogleApiSecret] = useState('');
  const [googleSecretConfigured, setGoogleSecretConfigured] = useState(false);
  
  const [tiktokPixelId, setTiktokPixelId] = useState('');
  const [tiktokEnabled, setTiktokEnabled] = useState(false);
  const [tiktokEventsApiEnabled, setTiktokEventsApiEnabled] = useState(false);
  const [tiktokAccessToken, setTiktokAccessToken] = useState('');
  const [tiktokTokenConfigured, setTiktokTokenConfigured] = useState(false);

  // Sync local state when config loads
  useEffect(() => {
    if (config) {
      setMetaPixelId(config.meta_pixel_id || '');
      setMetaEnabled(config.meta_enabled);
      setMetaCapiEnabled(config.meta_capi_enabled);
      setMetaTokenConfigured(!!(config as any).meta_access_token);
      
      setGoogleMeasurementId(config.google_measurement_id || '');
      setGoogleAdsConversionId(config.google_ads_conversion_id || '');
      setGoogleAdsConversionLabel(config.google_ads_conversion_label || '');
      setGoogleEnabled(config.google_enabled);
      setGoogleSecretConfigured(!!(config as any).google_api_secret);
      
      setTiktokPixelId(config.tiktok_pixel_id || '');
      setTiktokEnabled(config.tiktok_enabled);
      setTiktokEventsApiEnabled(config.tiktok_events_api_enabled);
      setTiktokTokenConfigured(!!(config as any).tiktok_access_token);
    }
  }, [config]);

  const handleSaveMeta = async () => {
    const updates: Partial<MarketingIntegration> = {
      meta_pixel_id: metaPixelId || null,
      meta_enabled: metaEnabled,
      meta_capi_enabled: metaCapiEnabled,
      meta_status: metaEnabled && metaPixelId ? 'active' : 'inactive',
    };
    
    // Only update token if user entered a new one
    if (metaAccessToken) {
      (updates as any).meta_access_token = metaAccessToken;
    }
    
    await upsertConfig.mutateAsync(updates);
    setMetaAccessToken(''); // Clear token input after save
  };

  const handleSaveGoogle = async () => {
    const updates: Partial<MarketingIntegration> = {
      google_measurement_id: googleMeasurementId || null,
      google_ads_conversion_id: googleAdsConversionId || null,
      google_ads_conversion_label: googleAdsConversionLabel || null,
      google_enabled: googleEnabled,
      google_status: googleEnabled && googleMeasurementId ? 'active' : 'inactive',
    };
    
    if (googleApiSecret) {
      (updates as any).google_api_secret = googleApiSecret;
    }
    
    await upsertConfig.mutateAsync(updates);
    setGoogleApiSecret('');
  };

  const handleSaveTikTok = async () => {
    const updates: Partial<MarketingIntegration> = {
      tiktok_pixel_id: tiktokPixelId || null,
      tiktok_enabled: tiktokEnabled,
      tiktok_events_api_enabled: tiktokEventsApiEnabled,
      tiktok_status: tiktokEnabled && tiktokPixelId ? 'active' : 'inactive',
    };
    
    if (tiktokAccessToken) {
      (updates as any).tiktok_access_token = tiktokAccessToken;
    }
    
    await upsertConfig.mutateAsync(updates);
    setTiktokAccessToken('');
  };

  const handleTestEvent = async (provider: 'meta' | 'google' | 'tiktok') => {
    if (!currentTenant?.id) return;
    
    setIsTesting(provider);
    
    try {
      const functionName = `marketing-send-${provider}`;
      const testPayload: Record<string, any> = {
        tenant_id: currentTenant.id,
        event_name: 'PageView',
        event_id: `test_${Date.now()}`,
        event_source_url: window.location.origin,
        test_event_code: 'TEST_EVENT',
      };

      if (provider === 'google') {
        testPayload.client_id = `test_${Date.now()}`;
        testPayload.debug_mode = true;
        testPayload.params = { page_title: '[TESTE] Evento de teste' };
      } else if (provider === 'tiktok') {
        testPayload.page_url = window.location.origin;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: testPayload,
      });

      if (error) throw error;

      if (data?.skipped) {
        toast.info(`${provider.toUpperCase()} não está habilitado ou configurado`);
      } else if (data?.success) {
        toast.success(`[TESTE] Evento enviado com sucesso para ${provider.toUpperCase()}`);
      } else if (data?.error) {
        toast.error(`Erro: ${JSON.stringify(data.error)}`);
      }
    } catch (error: any) {
      console.error('Test event error:', error);
      toast.error(`Erro ao enviar evento de teste: ${error.message}`);
    } finally {
      setIsTesting(null);
    }
  };

  const getFeedUrl = (format: 'google' | 'meta') => {
    if (!currentTenant?.slug) return '';
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-feed`;
    return `${baseUrl}?tenant=${currentTenant.slug}&format=${format}`;
  };

  const copyFeedUrl = (format: 'google' | 'meta') => {
    const url = getFeedUrl(format);
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configure seus pixels de marketing para rastrear conversões automaticamente em todas as páginas da sua loja.
          Os eventos são disparados automaticamente: PageView, ViewContent, AddToCart, InitiateCheckout e Purchase.
        </AlertDescription>
      </Alert>

      {/* Product Feeds Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Feeds de Catálogo
          </CardTitle>
          <CardDescription>
            URLs dos feeds de produtos para Google Merchant Center e Meta Catalog
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Google Merchant (XML)</Label>
              <div className="flex gap-2">
                <Input 
                  value={getFeedUrl('google')} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={() => copyFeedUrl('google')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meta Catalog (CSV)</Label>
              <div className="flex gap-2">
                <Input 
                  value={getFeedUrl('meta')} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={() => copyFeedUrl('meta')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="meta" className="gap-2">
            <Facebook className="h-4 w-4" />
            Meta
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <Chrome className="h-4 w-4" />
            Google
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2">
            <Music2 className="h-4 w-4" />
            TikTok
          </TabsTrigger>
        </TabsList>

        {/* Meta/Facebook Tab */}
        <TabsContent value="meta">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Facebook className="h-5 w-5 text-blue-600" />
                    Meta Pixel (Facebook/Instagram)
                  </CardTitle>
                  <CardDescription>
                    Rastreie conversões e crie públicos personalizados
                  </CardDescription>
                </div>
                <StatusIndicator status={config?.meta_status || 'inactive'} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client-side Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4" />
                  Client-side (Pixel)
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="meta-enabled">Ativar Meta Pixel</Label>
                  <Switch
                    id="meta-enabled"
                    checked={metaEnabled}
                    onCheckedChange={setMetaEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta-pixel-id">Pixel ID</Label>
                  <Input
                    id="meta-pixel-id"
                    placeholder="123456789012345"
                    value={metaPixelId}
                    onChange={(e) => setMetaPixelId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre seu Pixel ID no{' '}
                    <a 
                      href="https://business.facebook.com/events_manager" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Gerenciador de Eventos <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>

              <Separator />

              {/* Server-side Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Server className="h-4 w-4" />
                  Server-side (Conversions API)
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="meta-capi-enabled">Ativar Conversions API</Label>
                    <p className="text-xs text-muted-foreground">Melhora atribuição e reduz perda por bloqueadores</p>
                  </div>
                  <Switch
                    id="meta-capi-enabled"
                    checked={metaCapiEnabled}
                    onCheckedChange={setMetaCapiEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta-access-token" className="flex items-center gap-2">
                    <Lock className="h-3 w-3" />
                    Access Token
                    {metaTokenConfigured && (
                      <Badge variant="secondary" className="text-xs">Configurado</Badge>
                    )}
                  </Label>
                  <Input
                    id="meta-access-token"
                    type="password"
                    placeholder={metaTokenConfigured ? '••••••••••••' : 'Cole seu access token aqui'}
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Token nunca é exibido após salvo. Para alterar, insira um novo.
                  </p>
                </div>
              </div>

              {config?.meta_last_error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{config.meta_last_error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveMeta} disabled={upsertConfig.isPending}>
                  {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleTestEvent('meta')}
                  disabled={!metaEnabled || !metaPixelId || isTesting === 'meta'}
                >
                  {isTesting === 'meta' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Tab */}
        <TabsContent value="google">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Chrome className="h-5 w-5 text-yellow-500" />
                    Google Analytics & Ads
                  </CardTitle>
                  <CardDescription>
                    Acompanhe métricas e conversões no Google Analytics 4 e Google Ads
                  </CardDescription>
                </div>
                <StatusIndicator status={config?.google_status || 'inactive'} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client-side Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4" />
                  Client-side (gtag.js)
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="google-enabled">Ativar Google Tag</Label>
                  <Switch
                    id="google-enabled"
                    checked={googleEnabled}
                    onCheckedChange={setGoogleEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-measurement-id">GA4 Measurement ID</Label>
                  <Input
                    id="google-measurement-id"
                    placeholder="G-XXXXXXXXXX"
                    value={googleMeasurementId}
                    onChange={(e) => setGoogleMeasurementId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em{' '}
                    <a 
                      href="https://analytics.google.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Google Analytics <ExternalLink className="h-3 w-3" />
                    </a>
                    {' → Admin → Data Streams'}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="google-ads-id">Google Ads Conversion ID</Label>
                    <Input
                      id="google-ads-id"
                      placeholder="AW-XXXXXXXXX"
                      value={googleAdsConversionId}
                      onChange={(e) => setGoogleAdsConversionId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="google-ads-label">Conversion Label</Label>
                    <Input
                      id="google-ads-label"
                      placeholder="XXXXXXXXX"
                      value={googleAdsConversionLabel}
                      onChange={(e) => setGoogleAdsConversionLabel(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Server-side Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Server className="h-4 w-4" />
                  Server-side (Measurement Protocol)
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-api-secret" className="flex items-center gap-2">
                    <Lock className="h-3 w-3" />
                    API Secret
                    {googleSecretConfigured && (
                      <Badge variant="secondary" className="text-xs">Configurado</Badge>
                    )}
                  </Label>
                  <Input
                    id="google-api-secret"
                    type="password"
                    placeholder={googleSecretConfigured ? '••••••••••••' : 'Cole seu API secret aqui'}
                    value={googleApiSecret}
                    onChange={(e) => setGoogleApiSecret(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em Admin → Data Streams → Measurement Protocol API secrets
                  </p>
                </div>
              </div>

              {config?.google_last_error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{config.google_last_error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveGoogle} disabled={upsertConfig.isPending}>
                  {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleTestEvent('google')}
                  disabled={!googleEnabled || !googleMeasurementId || isTesting === 'google'}
                >
                  {isTesting === 'google' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TikTok Tab */}
        <TabsContent value="tiktok">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Music2 className="h-5 w-5" />
                    TikTok Pixel
                  </CardTitle>
                  <CardDescription>
                    Rastreie conversões e otimize suas campanhas no TikTok Ads
                  </CardDescription>
                </div>
                <StatusIndicator status={config?.tiktok_status || 'inactive'} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client-side Section */}
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
              </div>

              <Separator />

              {/* Server-side Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Server className="h-4 w-4" />
                  Server-side (Events API)
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="tiktok-events-api-enabled">Ativar Events API</Label>
                    <p className="text-xs text-muted-foreground">Melhora atribuição e reduz perda por bloqueadores</p>
                  </div>
                  <Switch
                    id="tiktok-events-api-enabled"
                    checked={tiktokEventsApiEnabled}
                    onCheckedChange={setTiktokEventsApiEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktok-access-token" className="flex items-center gap-2">
                    <Lock className="h-3 w-3" />
                    Access Token
                    {tiktokTokenConfigured && (
                      <Badge variant="secondary" className="text-xs">Configurado</Badge>
                    )}
                  </Label>
                  <Input
                    id="tiktok-access-token"
                    type="password"
                    placeholder={tiktokTokenConfigured ? '••••••••••••' : 'Cole seu access token aqui'}
                    value={tiktokAccessToken}
                    onChange={(e) => setTiktokAccessToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Token nunca é exibido após salvo. Para alterar, insira um novo.
                  </p>
                </div>
              </div>

              {config?.tiktok_last_error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{config.tiktok_last_error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveTikTok} disabled={upsertConfig.isPending}>
                  {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleTestEvent('tiktok')}
                  disabled={!tiktokEnabled || !tiktokPixelId || isTesting === 'tiktok'}
                >
                  {isTesting === 'tiktok' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
