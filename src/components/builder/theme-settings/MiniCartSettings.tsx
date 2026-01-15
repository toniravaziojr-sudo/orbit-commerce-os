// =============================================
// MINI CART SETTINGS - Carrinho Suspenso configuration
// Uses cart_config JSON column in store_settings
// =============================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface MiniCartSettingsProps {
  tenantId: string;
  templateSetId?: string;
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

export function MiniCartSettings({ tenantId, templateSetId }: MiniCartSettingsProps) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<MiniCartConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

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
