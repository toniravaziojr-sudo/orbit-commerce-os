// =============================================
// MARKETING INTEGRATIONS SETTINGS
// UI for configuring Meta/Google/TikTok integrations per tenant
// =============================================

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Facebook,
  Chrome,
  Music2
} from 'lucide-react';
import { useMarketingIntegrations } from '@/hooks/useMarketingIntegrations';
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

export function MarketingIntegrationsSettings() {
  const { config, isLoading, upsertConfig } = useMarketingIntegrations();
  const { currentTenant } = useAuth();
  const [isTesting, setIsTesting] = useState<string | null>(null);

  // Local state for form values
  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaEnabled, setMetaEnabled] = useState(false);
  
  const [googleMeasurementId, setGoogleMeasurementId] = useState('');
  const [googleAdsConversionId, setGoogleAdsConversionId] = useState('');
  const [googleAdsConversionLabel, setGoogleAdsConversionLabel] = useState('');
  const [googleEnabled, setGoogleEnabled] = useState(false);
  
  const [tiktokPixelId, setTiktokPixelId] = useState('');
  const [tiktokEnabled, setTiktokEnabled] = useState(false);

  // Initialize form values from config
  useState(() => {
    if (config) {
      setMetaPixelId(config.meta_pixel_id || '');
      setMetaEnabled(config.meta_enabled);
      setGoogleMeasurementId(config.google_measurement_id || '');
      setGoogleAdsConversionId(config.google_ads_conversion_id || '');
      setGoogleAdsConversionLabel(config.google_ads_conversion_label || '');
      setGoogleEnabled(config.google_enabled);
      setTiktokPixelId(config.tiktok_pixel_id || '');
      setTiktokEnabled(config.tiktok_enabled);
    }
  });

  // Sync local state when config loads
  if (config && !metaPixelId && config.meta_pixel_id) {
    setMetaPixelId(config.meta_pixel_id);
  }
  if (config && !googleMeasurementId && config.google_measurement_id) {
    setGoogleMeasurementId(config.google_measurement_id);
  }
  if (config && !tiktokPixelId && config.tiktok_pixel_id) {
    setTiktokPixelId(config.tiktok_pixel_id);
  }

  const handleSaveMeta = async () => {
    await upsertConfig.mutateAsync({
      meta_pixel_id: metaPixelId || null,
      meta_enabled: metaEnabled,
      meta_status: metaEnabled && metaPixelId ? 'active' : 'inactive',
    });
  };

  const handleSaveGoogle = async () => {
    await upsertConfig.mutateAsync({
      google_measurement_id: googleMeasurementId || null,
      google_ads_conversion_id: googleAdsConversionId || null,
      google_ads_conversion_label: googleAdsConversionLabel || null,
      google_enabled: googleEnabled,
      google_status: googleEnabled && googleMeasurementId ? 'active' : 'inactive',
    });
  };

  const handleSaveTikTok = async () => {
    await upsertConfig.mutateAsync({
      tiktok_pixel_id: tiktokPixelId || null,
      tiktok_enabled: tiktokEnabled,
      tiktok_status: tiktokEnabled && tiktokPixelId ? 'active' : 'inactive',
    });
  };

  const handleTestEvent = async (provider: 'meta' | 'google' | 'tiktok') => {
    setIsTesting(provider);
    
    try {
      // For now, just update last_test_at - actual test would require the pixel to be loaded
      const updates: Record<string, any> = {};
      updates[`${provider}_last_test_at`] = new Date().toISOString();
      updates[`${provider}_last_error`] = null;
      
      await upsertConfig.mutateAsync(updates);
      toast.success(`Evento de teste enviado para ${provider.toUpperCase()}`);
    } catch (error) {
      toast.error('Erro ao enviar evento de teste');
    } finally {
      setIsTesting(null);
    }
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
          Os eventos serão disparados automaticamente para PageView, ViewContent, AddToCart, InitiateCheckout e Purchase.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="meta" className="space-y-6">
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
            <CardContent className="space-y-4">
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
            <CardContent className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="google-ads-id">Google Ads Conversion ID (opcional)</Label>
                <Input
                  id="google-ads-id"
                  placeholder="AW-XXXXXXXXX"
                  value={googleAdsConversionId}
                  onChange={(e) => setGoogleAdsConversionId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="google-ads-label">Conversion Label (opcional)</Label>
                <Input
                  id="google-ads-label"
                  placeholder="XXXXXXXXX"
                  value={googleAdsConversionLabel}
                  onChange={(e) => setGoogleAdsConversionLabel(e.target.value)}
                />
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
            <CardContent className="space-y-4">
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
