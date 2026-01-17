// =============================================
// MINI CART SETTINGS - Unified cart action configuration
// Uses centralized useThemeSettings hook (template-wide)
// =============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ShoppingBag, Gift, Truck, Percent, Clock, ShoppingCart, ArrowRight } from 'lucide-react';
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
      
      // When cartActionType changes to a non-none value, force showAddToCartButton to true
      if (key === 'cartActionType' && value !== 'none') {
        updated.showAddToCartButton = true;
      }
      
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

  const isCartActionDisabled = localConfig.cartActionType === 'none';
  const isMiniCartMode = localConfig.cartActionType === 'miniCart';

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configure o comportamento do botão "Adicionar ao carrinho" na página de produto.
      </p>

      {/* Main Toggle - Cart Action Enabled */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <div>
            <Label className="text-sm font-medium">Ação do Carrinho</Label>
            <p className="text-xs text-muted-foreground">
              O que acontece ao adicionar produto
            </p>
          </div>
        </div>
        <Switch
          checked={localConfig.cartActionType !== 'none'}
          onCheckedChange={(enabled) => 
            handleChange('cartActionType', enabled ? 'miniCart' : 'none')
          }
        />
      </div>

      {/* Cart Action Type Selection - only shows when enabled */}
      {!isCartActionDisabled && (
        <div className="space-y-3 pl-2">
          <Label className="text-xs text-muted-foreground">Tipo de ação:</Label>
          <RadioGroup
            value={localConfig.cartActionType}
            onValueChange={(value: CartActionType) => handleChange('cartActionType', value)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="miniCart" id="action-miniCart" />
              <div className="flex items-center gap-2 flex-1">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="action-miniCart" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Carrinho Suspenso</span>
                  <p className="text-xs text-muted-foreground font-normal">
                    Abre o mini-carrinho lateral
                  </p>
                </Label>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="goToCart" id="action-goToCart" />
              <div className="flex items-center gap-2 flex-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="action-goToCart" className="text-sm cursor-pointer flex-1">
                  <span className="font-medium">Ir para Carrinho</span>
                  <p className="text-xs text-muted-foreground font-normal">
                    Redireciona para a página do carrinho
                  </p>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Disabled state message */}
      {isCartActionDisabled && (
        <div className="p-3 rounded-lg bg-muted/30 border border-dashed">
          <p className="text-xs text-muted-foreground text-center">
            Com a ação desativada, o botão apenas mostra "Adicionado" ao clicar.
          </p>
        </div>
      )}

      {/* Show Add to Cart Button - Required when cart action is enabled */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <Label className="text-xs">Mostrar "Adicionar ao carrinho"</Label>
            {!isCartActionDisabled && (
              <p className="text-[10px] text-amber-600">Obrigatório quando ação está ativa</p>
            )}
          </div>
        </div>
        <Switch
          checked={localConfig.showAddToCartButton}
          onCheckedChange={(v) => handleChange('showAddToCartButton', v)}
          disabled={!isCartActionDisabled}
        />
      </div>

      <Separator />

      {/* Mini-cart specific features - only when miniCart mode is selected */}
      {isMiniCartMode && (
        <>
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
