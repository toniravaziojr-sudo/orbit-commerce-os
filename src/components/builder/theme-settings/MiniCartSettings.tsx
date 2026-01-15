// =============================================
// MINI CART SETTINGS - Carrinho Suspenso configuration
// Uses cart_config JSON column in store_settings
// Navigates to Home page and shows mini-cart preview in canvas
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
  onNavigateToPage?: (pageType: string) => void;
  showPreview?: boolean;
  onTogglePreview?: (open: boolean) => void;
  onConfigChange?: (config: MiniCartConfig) => void;
}

export interface MiniCartConfig {
  miniCartEnabled: boolean;
  showGoToCartButton: boolean;
  showCrossSell: boolean;
  showCoupon: boolean;
  showShippingCalculator: boolean;
  showFreeShippingProgress: boolean;
  freeShippingThreshold: number;
  showStockReservationTimer: boolean;
  stockReservationMinutes: number;
}

export const DEFAULT_MINI_CART_CONFIG: MiniCartConfig = {
  miniCartEnabled: true,
  showGoToCartButton: true,
  showCrossSell: true,
  showCoupon: true,
  showShippingCalculator: false,
  showFreeShippingProgress: true,
  freeShippingThreshold: 299,
  showStockReservationTimer: false,
  stockReservationMinutes: 15,
};

export function MiniCartSettings({ 
  tenantId, 
  templateSetId, 
  onNavigateToPage,
  showPreview,
  onTogglePreview,
  onConfigChange,
}: MiniCartSettingsProps) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<MiniCartConfig>(DEFAULT_MINI_CART_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Navigate to home page on mount to show mini-cart in context
  useEffect(() => {
    onNavigateToPage?.('home');
  }, [onNavigateToPage]);

  // Load settings from cart_config JSON column + auto-show preview
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
          const loadedConfig: MiniCartConfig = {
            miniCartEnabled: cartConfig.miniCartEnabled as boolean ?? DEFAULT_MINI_CART_CONFIG.miniCartEnabled,
            showGoToCartButton: cartConfig.showGoToCartButton as boolean ?? DEFAULT_MINI_CART_CONFIG.showGoToCartButton,
            showCrossSell: cartConfig.miniCartShowCrossSell as boolean ?? DEFAULT_MINI_CART_CONFIG.showCrossSell,
            showCoupon: cartConfig.miniCartShowCoupon as boolean ?? DEFAULT_MINI_CART_CONFIG.showCoupon,
            showShippingCalculator: cartConfig.miniCartShowShipping as boolean ?? DEFAULT_MINI_CART_CONFIG.showShippingCalculator,
            showFreeShippingProgress: cartConfig.miniCartShowFreeShippingProgress as boolean ?? DEFAULT_MINI_CART_CONFIG.showFreeShippingProgress,
            freeShippingThreshold: cartConfig.freeShippingThreshold as number ?? DEFAULT_MINI_CART_CONFIG.freeShippingThreshold,
            showStockReservationTimer: cartConfig.miniCartShowStockTimer as boolean ?? DEFAULT_MINI_CART_CONFIG.showStockReservationTimer,
            stockReservationMinutes: cartConfig.stockReservationMinutes as number ?? DEFAULT_MINI_CART_CONFIG.stockReservationMinutes,
          };
          setConfig(loadedConfig);
          onConfigChange?.(loadedConfig);
        }
      } catch (err) {
        console.error('Error loading mini cart settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
    
    // Auto-show preview when entering mini cart settings
    onTogglePreview?.(true);
    
    // Auto-hide preview when leaving settings (cleanup)
    return () => {
      onTogglePreview?.(false);
    };
  }, [tenantId]);

  // Save mutation - merge into cart_config using upsert
  const saveMutation = useMutation({
    mutationFn: async (newConfig: MiniCartConfig) => {
      // First get current cart_config to merge
      const { data: current } = await supabase
        .from('store_settings')
        .select('id, cart_config')
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
        miniCartShowFreeShippingProgress: newConfig.showFreeShippingProgress,
        freeShippingThreshold: newConfig.freeShippingThreshold,
        miniCartShowStockTimer: newConfig.showStockReservationTimer,
        stockReservationMinutes: newConfig.stockReservationMinutes,
      };

      // Use upsert to handle both create and update cases
      const { error } = await supabase
        .from('store_settings')
        .upsert(
          { 
            tenant_id: tenantId, 
            cart_config: updatedCartConfig as unknown as Json,
          },
          { onConflict: 'tenant_id' }
        );

      if (error) throw error;
      return newConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['cart-config', tenantId] });
      toast.success('Configurações salvas');
    },
    onError: (err) => {
      console.error('Error saving mini cart settings:', err);
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleChange = (key: keyof MiniCartConfig, value: boolean | number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    
    // If disabling mini-cart, also close the preview
    if (key === 'miniCartEnabled' && value === false) {
      onTogglePreview?.(false);
    }
    
    // Immediately update the preview with new config
    onConfigChange?.(newConfig);
    
    // Then save to database
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
            
            {/* Free Shipping Progress Bar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Barra de Frete Grátis</Label>
                <p className="text-xs text-muted-foreground">
                  Mostra progresso para frete grátis
                </p>
              </div>
              <Switch
                checked={config.showFreeShippingProgress}
                onCheckedChange={(checked) => handleChange('showFreeShippingProgress', checked)}
              />
            </div>

            {/* Go to Cart Button */}
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

            {/* Cross-sell */}
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

            {/* Coupon */}
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

            {/* Shipping Calculator */}
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

            {/* Stock Reservation Timer */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Timer de Reserva</Label>
                <p className="text-xs text-muted-foreground">
                  Mostra tempo restante para reserva de estoque
                </p>
              </div>
              <Switch
                checked={config.showStockReservationTimer}
                onCheckedChange={(checked) => handleChange('showStockReservationTimer', checked)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
