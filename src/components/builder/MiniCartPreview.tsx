// =============================================
// MINI CART PREVIEW - Preview-only overlay for builder canvas
// Shows mock data without CartContext dependency
// Renders as an overlay inside the builder canvas (not a global Sheet)
// Reflects active configuration options from MiniCartSettings
// Free shipping threshold comes from Logistics > Cart Conversion settings (benefit_config)
// =============================================

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Truck, Check, X, Clock, Tag, Plus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { MiniCartConfig, DEFAULT_MINI_CART_CONFIG } from './theme-settings/MiniCartSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface MiniCartPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewport?: 'desktop' | 'mobile';
  config?: MiniCartConfig;
}

// Mock cart item for preview
const MOCK_ITEMS = [
  {
    id: '1',
    name: 'Produto Exemplo',
    price: 149.90,
    quantity: 2,
    image_url: null,
  },
  {
    id: '2',
    name: 'Outro Produto de Exemplo',
    price: 89.90,
    quantity: 1,
    image_url: null,
  },
];

// Mock cross-sell products
const MOCK_CROSS_SELL = [
  { id: 'cs1', name: 'Produto Sugerido', price: 59.90 },
  { id: 'cs2', name: 'Outro Sugerido', price: 39.90 },
];

// Default threshold fallback
const DEFAULT_FREE_SHIPPING_THRESHOLD = 199;

export function MiniCartPreview({ 
  open, 
  onOpenChange,
  viewport = 'desktop',
  config = DEFAULT_MINI_CART_CONFIG,
}: MiniCartPreviewProps) {
  const { currentTenant } = useAuth();
  const currentTenantId = currentTenant?.id;
  
  // Fetch benefit_config from store_settings (Logistics > Cart Conversion)
  const { data: benefitConfig } = useQuery({
    queryKey: ['benefit-config-for-minicart', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return null;
      const { data, error } = await supabase
        .from('store_settings')
        .select('benefit_config')
        .eq('tenant_id', currentTenantId)
        .maybeSingle();
      if (error) throw error;
      if (data?.benefit_config) {
        const parsed = typeof data.benefit_config === 'string' 
          ? JSON.parse(data.benefit_config) 
          : data.benefit_config;
        return parsed;
      }
      return null;
    },
    enabled: !!currentTenantId && open,
    staleTime: 30000,
  });
  
  const subtotal = MOCK_ITEMS.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = config.showShippingCalculator ? 15.90 : 0;
  const total = subtotal + shipping;
  
  // Use threshold from Logistics settings (benefit_config), fallback to default
  const freeShippingThreshold = benefitConfig?.thresholdValue || DEFAULT_FREE_SHIPPING_THRESHOLD;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);
  const hasFreeShipping = subtotal >= freeShippingThreshold;

  if (!open) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/40 z-40 transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Drawer panel - slides in from right, inside the canvas */}
      <div 
        className={cn(
          "absolute top-0 right-0 h-full bg-background border-l shadow-xl z-50 flex flex-col transition-transform duration-300",
          viewport === 'mobile' ? 'w-full' : 'w-[380px] max-w-[90%]'
        )}
      >
        {/* Disabled banner */}
        {!config.miniCartEnabled && (
          <div className="bg-orange-100 text-orange-700 text-xs px-4 py-2 text-center font-medium">
            ⚠️ Carrinho suspenso desativado na loja
          </div>
        )}
        
        {/* Header */}
        <div className="border-b px-4 py-4 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="text-base font-semibold">Carrinho</span>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Free Shipping Progress Bar */}
          {config.showFreeShippingProgress && (
            <div className="p-3 rounded-lg border bg-muted/50 text-sm mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "p-1.5 rounded-full",
                  hasFreeShipping ? "bg-green-100" : "bg-muted-foreground/20"
                )}>
                  <Truck className={cn(
                    "h-3 w-3",
                    hasFreeShipping ? "text-green-600" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1 text-xs">
                  {hasFreeShipping ? (
                    <p className="text-green-600 font-medium">🎉 Parabéns! Você tem frete grátis!</p>
                  ) : (
                    <p>
                      Faltam <span className="font-semibold">R$ {remainingForFreeShipping.toFixed(2).replace('.', ',')}</span> para frete grátis
                    </p>
                  )}
                </div>
              </div>
              <Progress value={freeShippingProgress} className="h-1.5" />
            </div>
          )}

          {/* Stock Reservation Timer */}
          {config.showStockReservationTimer && (
            <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 text-sm mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-xs text-orange-700">
                  Reserva de estoque expira em <strong>{config.stockReservationMinutes}:00</strong>
                </span>
              </div>
            </div>
          )}

          {/* Mock Cart Items */}
          <div className="space-y-4">
            {MOCK_ITEMS.map((item) => (
              <div key={item.id} className="flex gap-3 py-2">
                {/* Image placeholder */}
                <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 opacity-30" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-semibold">
                      R$ {item.price.toFixed(2).replace('.', ',')}
                    </p>
                    <div className="flex items-center gap-2 border rounded-full px-2 py-0.5">
                      <button className="text-muted-foreground hover:text-foreground p-0.5">−</button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <button className="text-muted-foreground hover:text-foreground p-0.5">+</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cross-sell Section */}
          {config.showCrossSell && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Você também pode gostar
              </p>
              <div className="space-y-2">
                {MOCK_CROSS_SELL.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <ShoppingCart className="h-4 w-4 opacity-30" />
                      </div>
                      <div>
                        <p className="text-xs font-medium line-clamp-1">{product.name}</p>
                        <p className="text-xs text-muted-foreground">R$ {product.price.toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coupon Field */}
          {config.showCoupon && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Cupom de desconto" 
                    className="pl-9 h-9 text-sm"
                    disabled
                  />
                </div>
                <Button size="sm" variant="secondary" className="h-9">
                  Aplicar
                </Button>
              </div>
            </div>
          )}

          {/* Shipping Calculator */}
          {config.showShippingCalculator && (
            <div className="border rounded-lg p-3 mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>Calcular frete</span>
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="00000-000" 
                  className="h-8 text-sm flex-1"
                  disabled
                />
                <Button size="sm" variant="secondary" className="h-8">
                  Calcular
                </Button>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 flex items-center gap-1">
                <Check className="h-3 w-3 text-green-600" />
                <span>PAC • 5 dia(s) • R$ 15,90</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-4 space-y-4 bg-background flex-shrink-0">
          {/* Summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            {config.showShippingCalculator && (
              <div className="flex justify-between">
                <span>Frete:</span>
                <span className="font-medium">R$ {shipping.toFixed(2).replace('.', ',')}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t">
              <span>Total:</span>
              <span>R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            <Button 
              className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm"
              onClick={() => onOpenChange(false)}
            >
              Iniciar Compra
            </Button>
            {config.showGoToCartButton && (
              <Button
                variant="outline"
                className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm"
                onClick={() => onOpenChange(false)}
              >
                Ir para o Carrinho
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full h-10 rounded-full font-semibold uppercase tracking-wide text-xs"
              onClick={() => onOpenChange(false)}
            >
              Continuar Comprando
            </Button>
          </div>
        </div>

      </div>
    </>
  );
}
