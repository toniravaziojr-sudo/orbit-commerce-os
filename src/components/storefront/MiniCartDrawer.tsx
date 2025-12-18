// =============================================
// MINI CART DRAWER - Opens when adding to cart
// Uses ResponsiveDrawerLayout for anti-regression mobile CSS
// Reflects same Conversion configs as /cart (benefit/shipping)
// =============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, X, ShoppingCart, Truck, Check, Gift, Loader2 } from 'lucide-react';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useBenefit, useShipping } from '@/contexts/StorefrontConfigContext';
import { getPublicCheckoutUrl, getPublicCartUrl } from '@/lib/publicUrls';
import { ResponsiveDrawerLayout } from '@/components/ui/responsive-drawer-layout';
import { calculateCartTotals, formatCurrency } from '@/lib/cartTotals';
import { Progress } from '@/components/ui/progress';

interface MiniCartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  isPreview?: boolean;
}

export function MiniCartDrawer({ 
  open, 
  onOpenChange, 
  tenantSlug,
  isPreview,
}: MiniCartDrawerProps) {
  const navigate = useNavigate();
  const { items, shipping, subtotal, updateQuantity, removeItem, setShippingCep, setShippingOptions, selectShipping } = useCart();

  // Use centralized totals calculation
  const totals = calculateCartTotals({
    items,
    selectedShipping: shipping.selected,
    discountAmount: 0,
  });

  const handleCheckout = () => {
    onOpenChange(false);
    const checkoutUrl = getPublicCheckoutUrl(tenantSlug, isPreview);
    navigate(checkoutUrl);
  };

  const handleGoToCart = () => {
    onOpenChange(false);
    const cartUrl = getPublicCartUrl(tenantSlug, isPreview);
    navigate(cartUrl);
  };

  const handleContinueShopping = () => {
    onOpenChange(false);
  };

  // Header component
  const Header = (
    <SheetHeader className="border-b px-4 py-4">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" />
        <SheetTitle className="text-base font-semibold">Carrinho</SheetTitle>
      </div>
    </SheetHeader>
  );

  // Body component - scrollable items list
  const Body = (
    <div className="px-4 py-4">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
          <ShoppingCart className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-sm">Seu carrinho está vazio</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Benefit Progress Bar - Same as /cart */}
          <MiniCartBenefitBar subtotal={totals.subtotal} />
          
          {/* Cart Items */}
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
          
          {/* Shipping Calculator - Same state as /cart */}
          <MiniCartShipping 
            subtotal={subtotal}
            shipping={shipping}
            items={items}
            setShippingCep={setShippingCep}
            setShippingOptions={setShippingOptions}
            selectShipping={selectShipping}
          />
        </div>
      )}
    </div>
  );

  // Footer component - summary + CTAs
  const Footer = (
    <div className="border-t px-4 py-4 space-y-4 bg-background">
      {/* Summary */}
      {items.length > 0 && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
          </div>
          
          {/* Shipping status */}
          <div className="flex justify-between">
            <span>Frete:</span>
            {shipping.selected ? (
              shipping.selected.isFree ? (
                <span className="text-green-600 font-medium">Grátis</span>
              ) : (
                <span className="font-medium">{formatCurrency(totals.shippingTotal)}</span>
              )
            ) : (
              <span className="text-muted-foreground text-xs">Calcule acima</span>
            )}
          </div>
          
          <div className="flex justify-between text-base font-bold pt-2 border-t">
            <span>Total:</span>
            <span>{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-2">
        <Button 
          onClick={handleCheckout}
          disabled={items.length === 0}
          className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm"
        >
          Iniciar Compra
        </Button>
        <Button
          variant="outline"
          onClick={handleGoToCart}
          disabled={items.length === 0}
          className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm"
        >
          Ir para o Carrinho
        </Button>
        <Button
          variant="ghost"
          onClick={handleContinueShopping}
          className="w-full h-10 rounded-full font-semibold uppercase tracking-wide text-xs"
        >
          Continuar Comprando
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="p-0 w-full sm:w-[400px] sm:max-w-md"
        side="right"
      >
        <ResponsiveDrawerLayout
          header={Header}
          body={Body}
          footer={Footer}
        />
      </SheetContent>
    </Sheet>
  );
}

// Mini Benefit Progress Bar - Compact version for drawer
function MiniCartBenefitBar({ subtotal }: { subtotal: number }) {
  const { config, getProgress, isLoading } = useBenefit();

  if (isLoading) return null;

  const { enabled, progress, remaining, achieved, label } = getProgress(subtotal);

  if (!enabled) return null;

  const Icon = config.mode === 'gift' ? Gift : Truck;

  return (
    <div 
      className="p-3 rounded-lg border text-sm mb-2"
      style={{ 
        backgroundColor: achieved ? `${config.progressColor}10` : 'hsl(var(--muted))',
        borderColor: achieved ? config.progressColor : 'hsl(var(--border))'
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div 
          className="p-1.5 rounded-full"
          style={{ backgroundColor: achieved ? config.progressColor : 'hsl(var(--muted-foreground) / 0.2)' }}
        >
          {achieved ? (
            <Check className="h-3 w-3 text-white" />
          ) : (
            <Icon className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 text-xs">
          {achieved ? (
            <p className="font-semibold" style={{ color: config.progressColor }}>
              {label}
            </p>
          ) : (
            <p>
              Faltam{' '}
              <span className="font-semibold">
                R$ {remaining.toFixed(2).replace('.', ',')}
              </span>{' '}
              para {label.toLowerCase()}
            </p>
          )}
        </div>
      </div>

      <Progress 
        value={progress} 
        className="h-1.5"
        style={{ 
          '--progress-background': config.progressColor 
        } as React.CSSProperties}
      />
    </div>
  );
}

// Compact Shipping Calculator for MiniCart - uses same CartContext state
function MiniCartShipping({ 
  subtotal, 
  shipping, 
  setShippingCep, 
  setShippingOptions, 
  selectShipping,
  items,
}: {
  subtotal: number;
  shipping: { cep: string; options: any[]; selected: any | null };
  setShippingCep: (cep: string) => void;
  setShippingOptions: (options: any[]) => void;
  selectShipping: (option: any) => void;
  items: any[];
}) {
  const { config, quote, quoteAsync, isLoading: configLoading } = useShipping();
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCep = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return digits;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setShippingCep(formatted);
    setError(null);
  };

  const handleCalculate = async () => {
    const cepDigits = shipping.cep.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      setError('CEP inválido. Digite 8 dígitos.');
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      let options;
      
      // Use async quote for Frenet provider
      if (config.provider === 'frenet') {
        const cartItems = items.map(item => ({
          weight: 0.3,
          height: 10,
          width: 10,
          length: 10,
          quantity: item.quantity,
          price: item.price,
        }));
        options = await quoteAsync(cepDigits, subtotal, cartItems);
      } else {
        options = quote(cepDigits, subtotal);
      }
      
      if (!options || options.length === 0) {
        setError('Não encontramos opções de frete para este CEP.');
        setShippingOptions([]);
      } else {
        setShippingOptions(options);
        // Auto-select first option
        selectShipping(options[0]);
      }
    } catch (err) {
      console.error('MiniCart shipping quote error:', err);
      setError('Erro ao calcular frete. Tente novamente.');
      setShippingOptions([]);
    } finally {
      setIsCalculating(false);
    }
  };

  if (configLoading) return null;

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <span>Calcular frete</span>
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="00000-000"
          value={shipping.cep}
          onChange={handleCepChange}
          maxLength={9}
          className="font-mono text-sm h-9"
        />
        <Button
          onClick={handleCalculate}
          disabled={isCalculating || shipping.cep.replace(/\D/g, '').length < 8}
          variant="outline"
          size="sm"
          className="h-9 px-3"
        >
          {isCalculating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Calcular'
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Shipping options */}
      {shipping.options.length > 0 && (
        <div className="space-y-2">
          {shipping.options.map((option, index) => (
            <button
              key={index}
              onClick={() => selectShipping(option)}
              className={`w-full flex items-center justify-between p-2 text-xs border rounded transition-colors ${
                shipping.selected?.label === option.label 
                  ? 'border-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="text-left">
                <p className="font-medium">{option.label}</p>
                <p className="text-muted-foreground">{option.deliveryDays} dia(s)</p>
              </div>
              {option.isFree ? (
                <span className="font-semibold text-green-600">Grátis</span>
              ) : (
                <span className="font-semibold">
                  R$ {option.price.toFixed(2).replace('.', ',')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selected shipping summary */}
      {shipping.selected && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 flex items-center gap-1">
          <Check className="h-3 w-3 text-green-600" />
          <span>
            {shipping.selected.label} • {shipping.selected.deliveryDays} dia(s)
            {shipping.selected.isFree ? ' • Grátis' : ` • R$ ${shipping.selected.price.toFixed(2).replace('.', ',')}`}
          </span>
        </div>
      )}
    </div>
  );
}

// Cart Item Row Component
function CartItemRow({ 
  item, 
  onUpdateQuantity, 
  onRemove 
}: { 
  item: CartItem;
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-3 py-2">
      {/* Image */}
      <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt={item.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ShoppingCart className="h-6 w-6 opacity-50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
          <button 
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Remover item"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <p className="text-sm text-primary font-medium mt-1">
          R$ {item.price.toFixed(2).replace('.', ',')}
        </p>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center border rounded-full">
            <button
              onClick={() => onUpdateQuantity(Math.max(0, item.quantity - 1))}
              className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors rounded-l-full"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors rounded-r-full"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
