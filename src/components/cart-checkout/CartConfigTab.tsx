// =============================================
// CART CONFIG TAB - Cart settings configuration
// =============================================

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoreConfig } from '@/hooks/useStoreConfig';
import { CartConfig, defaultCartConfig } from '@/lib/storeConfigTypes';
import { ImageUpload } from '@/components/settings/ImageUpload';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  ShoppingCart, 
  Percent, 
  Truck, 
  Tag, 
  BarChart3,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Loader2,
  Save
} from 'lucide-react';

export function CartConfigTab() {
  const { config, isLoading, updateCartConfig } = useStoreConfig();
  const { currentTenant } = useAuth();
  const [form, setForm] = useState<CartConfig>(defaultCartConfig);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  useEffect(() => {
    if (config?.cartConfig) {
      setForm(config.cartConfig);
    }
  }, [config?.cartConfig]);

  const handleChange = <K extends keyof CartConfig>(key: K, value: CartConfig[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateCartConfig.mutateAsync(form);
    setHasChanges(false);
  };

  const handleImageUpload = async (file: File, type: 'desktop' | 'mobile'): Promise<string | null> => {
    if (!currentTenant?.id) return null;
    
    const setUploading = type === 'desktop' ? setUploadingDesktop : setUploadingMobile;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentTenant.id}/cart-banners/${type}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('store-assets')
        .getPublicUrl(fileName);

      if (type === 'desktop') {
        handleChange('bannerDesktopUrl', publicUrl);
      } else {
        handleChange('bannerMobileUrl', publicUrl);
      }
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Carrinho Suspenso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinho Suspenso Lateral
          </CardTitle>
          <CardDescription>
            Configure o mini-carrinho que aparece ao adicionar produtos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar carrinho suspenso</Label>
              <p className="text-sm text-muted-foreground">
                Exibe um drawer lateral ao adicionar produtos ao carrinho
              </p>
            </div>
            <Switch
              checked={form.miniCartEnabled}
              onCheckedChange={(checked) => handleChange('miniCartEnabled', checked)}
            />
          </div>

          {form.miniCartEnabled && (
            <div className="flex items-center justify-between pl-4 border-l-2 border-muted">
              <div className="space-y-0.5">
                <Label>Botão "Ir para Carrinho"</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe botão para navegar à página completa do carrinho
                </p>
              </div>
              <Switch
                checked={form.showGoToCartButton}
                onCheckedChange={(checked) => handleChange('showGoToCartButton', checked)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funcionalidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Funcionalidades do Carrinho
          </CardTitle>
          <CardDescription>
            Ative ou desative recursos no carrinho
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Cross-sell</Label>
                <p className="text-sm text-muted-foreground">
                  Sugestões de produtos complementares
                </p>
              </div>
            </div>
            <Switch
              checked={form.crossSellEnabled}
              onCheckedChange={(checked) => handleChange('crossSellEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Calculadora de frete</Label>
                <p className="text-sm text-muted-foreground">
                  Permite calcular frete antes do checkout
                </p>
              </div>
            </div>
            <Switch
              checked={form.shippingCalculatorEnabled}
              onCheckedChange={(checked) => handleChange('shippingCalculatorEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Cupom de desconto</Label>
                <p className="text-sm text-muted-foreground">
                  Campo para aplicar cupom no carrinho
                </p>
              </div>
            </div>
            <Switch
              checked={form.couponEnabled}
              onCheckedChange={(checked) => handleChange('couponEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Rastreamento de sessões</Label>
                <p className="text-sm text-muted-foreground">
                  Rastreia sessões de checkout para análise de conversão
                </p>
              </div>
            </div>
            <Switch
              checked={form.sessionTrackingEnabled}
              onCheckedChange={(checked) => handleChange('sessionTrackingEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Banner Promocional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Banner Promocional
          </CardTitle>
          <CardDescription>
            Configure um banner promocional no topo do carrinho
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Desktop Banner */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label>Banner Desktop</Label>
                  <p className="text-sm text-muted-foreground">
                    Dimensão recomendada: 1920x250 pixels
                  </p>
                </div>
              </div>
              <Switch
                checked={form.bannerDesktopEnabled}
                onCheckedChange={(checked) => handleChange('bannerDesktopEnabled', checked)}
              />
            </div>

            {form.bannerDesktopEnabled && (
              <div className="pl-7">
                <ImageUpload
                  label="Imagem Desktop"
                  value={form.bannerDesktopUrl || ''}
                  onChange={(url) => handleChange('bannerDesktopUrl', url || null)}
                  onUpload={(file) => handleImageUpload(file, 'desktop')}
                  description="1920x250 px (faixa horizontal)"
                />
                {uploadingDesktop && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando imagem...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Banner */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label>Banner Mobile</Label>
                  <p className="text-sm text-muted-foreground">
                    Dimensão recomendada: 768x200 pixels
                  </p>
                </div>
              </div>
              <Switch
                checked={form.bannerMobileEnabled}
                onCheckedChange={(checked) => handleChange('bannerMobileEnabled', checked)}
              />
            </div>

            {form.bannerMobileEnabled && (
              <div className="pl-7">
                <ImageUpload
                  label="Imagem Mobile"
                  value={form.bannerMobileUrl || ''}
                  onChange={(url) => handleChange('bannerMobileUrl', url || null)}
                  onUpload={(file) => handleImageUpload(file, 'mobile')}
                  description="768x200 px (faixa horizontal)"
                />
                {uploadingMobile && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando imagem...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Banner Link */}
          {(form.bannerDesktopEnabled || form.bannerMobileEnabled) && (
            <div className="space-y-2">
              <Label>Link do banner (opcional)</Label>
              <Input
                placeholder="https://sualoja.com/promocao"
                value={form.bannerLink || ''}
                onChange={(e) => handleChange('bannerLink', e.target.value || null)}
              />
              <p className="text-xs text-muted-foreground">
                URL para onde o banner deve direcionar ao ser clicado
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updateCartConfig.isPending}
          className="min-w-32"
        >
          {updateCartConfig.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Carrinho
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
