// =============================================
// MINI CART SETTINGS - Hanging cart drawer configuration
// Uses centralized useThemeSettings hook (template-wide)
// =============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, ShoppingBag, Gift, Truck, Percent, Clock, ArrowRight } from 'lucide-react';
import { useThemeMiniCart, DEFAULT_THEME_MINI_CART, ThemeMiniCartConfig } from '@/hooks/useThemeSettings';

interface MiniCartSettingsProps {
  tenantId: string;
  templateSetId?: string;
  onNavigateToPage?: (pageType: string) => void;
  showPreview?: boolean;
  onTogglePreview?: (open: boolean) => void;
  onConfigChange?: (config: ThemeMiniCartConfig) => void;
}

export type { ThemeMiniCartConfig as MiniCartConfig };
export { DEFAULT_THEME_MINI_CART as DEFAULT_MINI_CART_CONFIG };

export function MiniCartSettings({ 
  tenantId, 
  templateSetId, 
  onNavigateToPage, 
  showPreview, 
  onTogglePreview,
  onConfigChange 
}: MiniCartSettingsProps) {
  const { miniCart: savedMiniCart, updateMiniCart, isLoading, isSaving } = useThemeMiniCart(tenantId, templateSetId);
  const [localConfig, setLocalConfig] = useState<ThemeMiniCartConfig>(DEFAULT_THEME_MINI_CART);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  // Navigate to home to show preview context
  useEffect(() => {
    onNavigateToPage?.('home');
  }, [onNavigateToPage]);

  // Initialize local state from hook data
  useEffect(() => {
    if (savedMiniCart && !initialLoadDone.current) {
      setLocalConfig(savedMiniCart);
      onConfigChange?.(savedMiniCart);
      initialLoadDone.current = true;
    }
  }, [savedMiniCart, onConfigChange]);

  // Auto-toggle preview when entering/leaving this settings view
  useEffect(() => {
    onTogglePreview?.(true);
    return () => onTogglePreview?.(false);
  }, [onTogglePreview]);

  // Debounced save for number inputs
  const debouncedSave = useCallback((updates: Partial<ThemeMiniCartConfig>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      updateMiniCart(updates);
    }, 500);
  }, [updateMiniCart]);

  // Handle change with optimistic update + save
  const handleChange = useCallback((key: keyof ThemeMiniCartConfig, value: boolean | number) => {
    setLocalConfig(prev => {
      const updated = { ...prev, [key]: value };
      onConfigChange?.(updated);
      
      // Immediate save for booleans, debounced for numbers
      if (typeof value === 'boolean') {
        updateMiniCart({ [key]: value });
      } else {
        debouncedSave({ [key]: value });
      }
      
      return updated;
    });
  }, [updateMiniCart, debouncedSave, onConfigChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDisabled = !localConfig.miniCartEnabled;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configure o carrinho suspenso (mini-cart) que aparece ao adicionar produtos.
      </p>

      {/* Main Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <div>
            <Label className="text-sm font-medium">Ativar Carrinho Suspenso</Label>
            <p className="text-xs text-muted-foreground">Mini-cart lateral ao adicionar produtos</p>
          </div>
        </div>
        <Switch
          checked={localConfig.miniCartEnabled}
          onCheckedChange={(v) => handleChange('miniCartEnabled', v)}
        />
      </div>

      <Separator />

      {/* Features */}
      <div className={`space-y-3 ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className="text-sm font-medium">Funcionalidades</h4>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Barra de Frete Grátis</Label>
          </div>
          <Switch
            checked={localConfig.showFreeShippingProgress}
            onCheckedChange={(v) => handleChange('showFreeShippingProgress', v)}
          />
        </div>

        {localConfig.showFreeShippingProgress && (
          <div className="pl-6 space-y-1">
            <Label className="text-[10px]">Valor mínimo para frete grátis (R$)</Label>
            <Input
              type="number"
              value={localConfig.freeShippingThreshold}
              onChange={(e) => handleChange('freeShippingThreshold', Number(e.target.value))}
              className="h-7 text-xs w-32"
              min={0}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Botão "Ir para Carrinho"</Label>
          </div>
          <Switch
            checked={localConfig.showGoToCartButton}
            onCheckedChange={(v) => handleChange('showGoToCartButton', v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Cross-sell (Produtos Relacionados)</Label>
          </div>
          <Switch
            checked={localConfig.showCrossSell}
            onCheckedChange={(v) => handleChange('showCrossSell', v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Campo de Cupom</Label>
          </div>
          <Switch
            checked={localConfig.showCoupon}
            onCheckedChange={(v) => handleChange('showCoupon', v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs">Calculadora de Frete</Label>
          </div>
          <Switch
            checked={localConfig.showShippingCalculator}
            onCheckedChange={(v) => handleChange('showShippingCalculator', v)}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <Label className="text-xs">Timer de Reserva de Estoque</Label>
              <p className="text-[10px] text-muted-foreground">Urgência para completar a compra</p>
            </div>
          </div>
          <Switch
            checked={localConfig.showStockReservationTimer}
            onCheckedChange={(v) => handleChange('showStockReservationTimer', v)}
          />
        </div>

        {localConfig.showStockReservationTimer && (
          <div className="pl-6 space-y-1">
            <Label className="text-[10px]">Tempo de reserva (minutos)</Label>
            <Input
              type="number"
              value={localConfig.stockReservationMinutes}
              onChange={(e) => handleChange('stockReservationMinutes', Number(e.target.value))}
              className="h-7 text-xs w-32"
              min={1}
              max={60}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        {isSaving ? '💾 Salvando...' : '✓ Configurações salvas automaticamente neste template'}
      </p>
    </div>
  );
}
