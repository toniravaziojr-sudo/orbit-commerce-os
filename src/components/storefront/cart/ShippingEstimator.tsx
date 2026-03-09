// =============================================
// SHIPPING ESTIMATOR - CEP input and shipping options
// Uses shipping-quote Edge Function for multi-provider (Frenet/Correios/Loggi)
// =============================================

import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useShipping } from '@/contexts/StorefrontConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Truck, AlertCircle } from 'lucide-react';

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

export function ShippingEstimator() {
  const { items, subtotal, shipping, setShippingCep, setShippingOptions, selectShipping } = useCart();
  const { config, quote, quoteAsync, isLoading: configLoading } = useShipping();
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      
      // Check if ALL items in cart have product-level free_shipping
      const allItemsFreeShipping = items.length > 0 && items.every(item => item.free_shipping === true);

      // Use async quote for multi-provider or Frenet
      if (config.provider === 'frenet' || config.provider === 'multi') {
        const cartItems = items.map(item => ({
          weight: 0.3, // Default weight - could be fetched from product
          height: 10,
          width: 10,
          length: 10,
          quantity: item.quantity,
          price: item.price,
          product_id: item.id,
          free_shipping: item.free_shipping || false,
          free_shipping_method: (item as any).free_shipping_method || null,
        }));
        options = await quoteAsync(cepDigits, subtotal, cartItems);
      } else {
        // Sync quote for mock/manual providers
        options = quote(cepDigits, subtotal);
      }
      
      // Note: Product-level free shipping is now handled server-side in shipping-quote
      // The API returns is_free=true and price=0 for the configured method
      // Legacy fallback: if all items free shipping and no API-level handling
      if (allItemsFreeShipping && options.length > 0 && !options.some(opt => opt.isFree)) {
        options = options.map(opt => ({ ...opt, price: 0, isFree: true }));
      }

      if (options.length === 0) {
        setError('Não encontramos opções de frete para este CEP.');
        setShippingOptions([]);
      } else {
        setShippingOptions(options);
      }
    } catch (err) {
      console.error('Shipping quote error:', err);
      setError('Erro ao calcular frete. Tente novamente.');
      setShippingOptions([]);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSelectOption = (index: string) => {
    const option = shipping.options[parseInt(index, 10)];
    selectShipping(option);
  };

  if (configLoading) {
    return (
      <div className="p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Calcular frete</h3>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="00000-000"
            value={shipping.cep}
            onChange={handleCepChange}
            maxLength={9}
            className="font-mono"
          />
        </div>
        <Button
          onClick={handleCalculate}
          disabled={isCalculating || shipping.cep.replace(/\D/g, '').length < 8}
          variant="outline"
        >
          {isCalculating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Calcular'
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {shipping.options.length > 0 && (
        <RadioGroup
          value={shipping.selected ? String(shipping.options.indexOf(shipping.selected)) : undefined}
          onValueChange={handleSelectOption}
          className="space-y-2"
        >
          {shipping.options.map((option, index) => (
            <Label
              key={index}
              htmlFor={`shipping-${index}`}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 ${
                option.isFree ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={String(index)} id={`shipping-${index}`} />
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {option.label}
                    {option.isFree && (
                      <span className="sf-checkout-flag inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: 'var(--theme-flags-color, var(--theme-accent-color, #22c55e))' }}>
                        FRETE GRÁTIS
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {option.deliveryDays} {option.deliveryDays === 1 ? 'dia útil' : 'dias úteis'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {option.isFree ? (
                  <div className="flex flex-col items-end">
                    {option.originalPrice != null && option.originalPrice > 0 && (
                      <span className="text-xs text-muted-foreground line-through">
                        R$ {option.originalPrice.toFixed(2).replace('.', ',')}
                      </span>
                    )}
                    <span className="font-semibold" style={{ color: 'var(--theme-flags-color, var(--theme-accent-color, #22c55e))' }}>Grátis</span>
                  </div>
                ) : (
                  <span className="font-semibold">
                    R$ {option.price.toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>
            </Label>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}
