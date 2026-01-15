// =============================================
// MINI CART SETTINGS - Carrinho Suspenso configuration
// Uses cart_config JSON column in store_settings
// Navigates to Home page and shows mini-cart preview when active
// =============================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ShoppingCart, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface MiniCartSettingsProps {
  tenantId: string;
  templateSetId?: string;
  onNavigateToPage?: (pageType: string) => void;
}

interface MiniCartConfig {
  miniCartEnabled: boolean;
  showGoToCartButton: boolean;
  showCrossSell: boolean;
  showCoupon: boolean;
  showShippingCalculator: boolean;
}

const DEFAULT_CONFIG: MiniCartConfig = {
  miniCartEnabled: true,
  showGoToCartButton: true,
  showCrossSell: true,
  showCoupon: true,
  showShippingCalculator: false,
};

export function MiniCartSettings({ tenantId, templateSetId, onNavigateToPage }: MiniCartSettingsProps) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<MiniCartConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // Navigate to home page on mount to show mini-cart in context
  useEffect(() => {
    onNavigateToPage?.('home');
  }, [onNavigateToPage]);

  // Load settings from cart_config JSON column
  useEffect(() => {
    async function loadSettings() {
      if (!tenantId) return;
      
      try {
        const { data, error } = await supabase
          .from('store_settings')
          .select('cart_config')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error) throw error;

        if (data?.cart_config) {
          const cartConfig = data.cart_config as Record<string, unknown>;
          // Extract mini-cart specific settings from cart_config
          setConfig({
            miniCartEnabled: cartConfig.miniCartEnabled as boolean ?? DEFAULT_CONFIG.miniCartEnabled,
            showGoToCartButton: cartConfig.showGoToCartButton as boolean ?? DEFAULT_CONFIG.showGoToCartButton,
            showCrossSell: cartConfig.miniCartShowCrossSell as boolean ?? DEFAULT_CONFIG.showCrossSell,
            showCoupon: cartConfig.miniCartShowCoupon as boolean ?? DEFAULT_CONFIG.showCoupon,
            showShippingCalculator: cartConfig.miniCartShowShipping as boolean ?? DEFAULT_CONFIG.showShippingCalculator,
          });
        }
      } catch (err) {
        console.error('Error loading mini cart settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [tenantId]);

  // Save mutation - merge into cart_config
  const saveMutation = useMutation({
    mutationFn: async (newConfig: MiniCartConfig) => {
      // First get current cart_config to merge
      const { data: current } = await supabase
        .from('store_settings')
        .select('cart_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const existingConfig = (current?.cart_config as Record<string, unknown>) || {};
      
      // Merge mini-cart settings into cart_config
      const updatedCartConfig = {
        ...existingConfig,
        miniCartEnabled: newConfig.miniCartEnabled,
        showGoToCartButton: newConfig.showGoToCartButton,
        miniCartShowCrossSell: newConfig.showCrossSell,
        miniCartShowCoupon: newConfig.showCoupon,
        miniCartShowShipping: newConfig.showShippingCalculator,
      };

      const { error } = await supabase
        .from('store_settings')
        .update({ cart_config: updatedCartConfig as unknown as Json })
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return newConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cart-config', tenantId] });
      toast.success('Configurações salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = (key: keyof MiniCartConfig, value: boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    saveMutation.mutate(newConfig);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Configure o mini-carrinho que aparece ao adicionar produtos
      </p>

      {/* Main toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Ativar carrinho suspenso</Label>
          <p className="text-xs text-muted-foreground">
            Exibe drawer lateral ao adicionar produtos
          </p>
        </div>
        <Switch
          checked={config.miniCartEnabled}
          onCheckedChange={(checked) => handleChange('miniCartEnabled', checked)}
        />
      </div>

      {/* Preview button - show mini-cart preview */}
      {config.miniCartEnabled && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPreview ? 'Ocultar Preview' : 'Visualizar Carrinho Suspenso'}
        </Button>
      )}

      {/* Mini-cart preview drawer */}
      <Sheet open={showPreview && config.miniCartEnabled} onOpenChange={setShowPreview}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0">
          <SheetHeader className="border-b px-4 py-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <SheetTitle className="text-base font-semibold">Carrinho (Preview)</SheetTitle>
            </div>
          </SheetHeader>
          <div className="p-4 space-y-4">
            {/* Demo items */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="w-16 h-16 bg-muted rounded flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Produto Exemplo</p>
                <p className="text-xs text-muted-foreground">Qtd: 1</p>
                <p className="text-sm font-semibold">R$ 99,90</p>
              </div>
            </div>

            {/* Cross-sell preview */}
            {config.showCrossSell && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-2">Você também pode gostar:</p>
                <div className="flex gap-2">
                  <div className="w-12 h-12 bg-muted rounded" />
                  <div className="w-12 h-12 bg-muted rounded" />
                </div>
              </div>
            )}

            {/* Coupon preview */}
            {config.showCoupon && (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Cupom de desconto" 
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                  disabled
                />
                <button className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md" disabled>
                  Aplicar
                </button>
              </div>
            )}

            {/* Shipping calculator preview */}
            {config.showShippingCalculator && (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="CEP" 
                  className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                  disabled
                />
                <button className="px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md" disabled>
                  Calcular
                </button>
              </div>
            )}

            {/* Subtotal */}
            <div className="border-t pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Subtotal</span>
                <span className="font-semibold">R$ 99,90</span>
              </div>

              {/* Go to cart button */}
              {config.showGoToCartButton && (
                <button className="w-full py-2 text-sm border rounded-md mb-2" disabled>
                  Ir para Carrinho
                </button>
              )}

              {/* Checkout button */}
              <button className="w-full py-3 text-sm bg-primary text-primary-foreground rounded-md" disabled>
                Finalizar Compra
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {config.miniCartEnabled && (
        <>
          <Separator />
          
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Funcionalidades do carrinho suspenso
            </p>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Botão "Ir para Carrinho"</Label>
                <p className="text-xs text-muted-foreground">
                  Link para página completa do carrinho
                </p>
              </div>
              <Switch
                checked={config.showGoToCartButton}
                onCheckedChange={(checked) => handleChange('showGoToCartButton', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Mostrar Cross-sell</Label>
                <p className="text-xs text-muted-foreground">
                  Sugestões de produtos adicionais
                </p>
              </div>
              <Switch
                checked={config.showCrossSell}
                onCheckedChange={(checked) => handleChange('showCrossSell', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Campo de Cupom</Label>
                <p className="text-xs text-muted-foreground">
                  Permite aplicar cupom no mini-carrinho
                </p>
              </div>
              <Switch
                checked={config.showCoupon}
                onCheckedChange={(checked) => handleChange('showCoupon', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Calculadora de Frete</Label>
                <p className="text-xs text-muted-foreground">
                  Calcular frete no mini-carrinho
                </p>
              </div>
              <Switch
                checked={config.showShippingCalculator}
                onCheckedChange={(checked) => handleChange('showShippingCalculator', checked)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
