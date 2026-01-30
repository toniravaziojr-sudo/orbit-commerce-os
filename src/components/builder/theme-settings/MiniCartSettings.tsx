// =============================================
// MINI CART SETTINGS - Mini-cart features configuration
// Uses centralized useThemeSettings hook (template-wide)
// NOTE: Cart action (miniCart vs goToCart vs none) is configured in Product Page Settings
// =============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Gift, Truck, Percent, Clock, ShoppingCart } from 'lucide-react';
import { useThemeMiniCart, DEFAULT_THEME_MINI_CART, ThemeMiniCartConfig, CartActionType } from '@/hooks/useThemeSettings';

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
  const handleChange = useCallback((key: keyof ThemeMiniCartConfig, value: boolean | number | CartActionType) => {
    setLocalConfig(prev => {
      const updated = { ...prev, [key]: value };
      
      onConfigChange?.(updated);
      
      // Immediate save for booleans/strings, debounced for numbers
      if (typeof value === 'number') {
        debouncedSave({ [key]: value });
      } else {
        updateMiniCart(updated);
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

  // Check if mini-cart mode is enabled (cart action configured in product page settings)
  const isMiniCartMode = localConfig.cartActionType === 'miniCart';

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configure o comportamento do carrinho ao adicionar produtos.
      </p>

      {/* Cart action type toggle - MAIN control */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm flex items-center gap-1.5 font-medium">
              <ShoppingCart className="h-3.5 w-3.5" />
              Ação do Carrinho
            </Label>
            <p className="text-xs text-muted-foreground">O que acontece ao adicionar produto</p>
          </div>
          <Switch
            checked={localConfig.cartActionType !== 'none'}
            onCheckedChange={(checked) => {
              const newType: CartActionType = checked ? 'miniCart' : 'none';
              handleChange('cartActionType', newType);
            }}
          />
        </div>

        {/* Radio buttons to choose cart action type */}
        {localConfig.cartActionType !== 'none' && (
          <RadioGroup
            value={localConfig.cartActionType === 'goToCart' ? 'goToCart' : 'miniCart'}
            onValueChange={(value: 'miniCart' | 'goToCart') => {
              handleChange('cartActionType', value);
            }}
            className="grid grid-cols-2 gap-2"
          >
            <div className="flex items-center space-x-2 border rounded-md p-2 cursor-pointer hover:bg-muted/50 bg-background">
              <RadioGroupItem value="miniCart" id="mini-cart-option" />
              <Label htmlFor="mini-cart-option" className="text-xs cursor-pointer flex-1">
                Carrinho suspenso
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-md p-2 cursor-pointer hover:bg-muted/50 bg-background">
              <RadioGroupItem value="goToCart" id="go-to-cart-option" />
              <Label htmlFor="go-to-cart-option" className="text-xs cursor-pointer flex-1">
                Ir para carrinho
              </Label>
            </div>
          </RadioGroup>
        )}

        {localConfig.cartActionType === 'none' && (
          <p className="text-xs text-muted-foreground italic">
            Desativado: o botão apenas mostrará "Adicionado" ao clicar.
          </p>
        )}
      </div>

      {/* Mini-cart specific features - only when miniCart mode is selected */}
      {isMiniCartMode && (
        <>
          <Separator />
          <h4 className="text-sm font-medium">Funcionalidades do Mini-Cart</h4>

          <div className="space-y-3">
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
              <p className="pl-6 text-[10px] text-muted-foreground italic">
                O valor mínimo é definido em Logística → Conversão de Carrinho
              </p>
            )}

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
        </>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2">
        {isSaving ? '💾 Salvando...' : '✓ Configurações salvas automaticamente neste template'}
      </p>
    </div>
  );
}
