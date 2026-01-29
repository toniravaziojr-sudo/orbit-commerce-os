// =============================================
// CHECKOUT SHIPPING - Reuses shipping from CartContext
// Uses Frenet Edge Function when provider is 'frenet'
// =============================================

import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useShipping } from '@/contexts/StorefrontConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, Check, Edit2 } from 'lucide-react';
import { formatPrice } from '@/lib/cartTotals';

interface CheckoutShippingProps {
  disabled?: boolean;
}

export function CheckoutShipping({ disabled = false }: CheckoutShippingProps) {
  const { items, subtotal, shipping, setShippingCep, setShippingOptions, selectShipping } = useCart();
  const { config, quote, quoteAsync, isLoading: configLoading } = useShipping();
  const [isEditing, setIsEditing] = useState(false);
  const [tempCep, setTempCep] = useState(shipping.cep);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasShipping = shipping.cep && shipping.selected;

  const formatCep = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return digits;
  };

  const handleCalculate = async () => {
    const cepDigits = tempCep.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      setError('CEP inválido');
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      let options;
      
      // Use async quote for multi-provider or Frenet
      if (config.provider === 'frenet' || config.provider === 'multi') {
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
      
      if (options.length === 0) {
        setError('Não encontramos opções de frete para este CEP.');
      } else {
        setShippingCep(tempCep);
        setShippingOptions(options);
        setIsEditing(false);
      }
    } catch (err) {
      setError('Erro ao calcular frete.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSelectOption = (index: string) => {
    const option = shipping.options[parseInt(index, 10)];
    selectShipping(option);
  };

  // If shipping is already set and not editing, show summary
  if (hasShipping && !isEditing) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div 
              className="p-2 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--theme-accent-color, #22c55e) 20%, transparent)' }}
            >
              <Check className="h-4 w-4" style={{ color: 'var(--theme-accent-color, #22c55e)' }} />
            </div>
            <h3 className="font-semibold">Frete selecionado</h3>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(true)}
            disabled={disabled}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Alterar
          </Button>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{shipping.selected?.label}</p>
              <p className="text-sm text-muted-foreground">
                CEP: {shipping.cep} • {shipping.selected?.deliveryDays} dias úteis
              </p>
            </div>
            <div className="text-right">
              {shipping.selected?.isFree ? (
                <Badge 
                  variant="secondary" 
                  className="sf-tag-success"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--theme-accent-color, #22c55e) 15%, transparent)',
                    color: 'var(--theme-accent-color, #22c55e)',
                  }}
                >
                  Grátis
                </Badge>
              ) : (
                <span className="font-semibold">
                  R$ {formatPrice(shipping.selected?.price)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Shipping form (no shipping set or editing)
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Frete</h3>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="00000-000"
              value={tempCep}
              onChange={(e) => {
                setTempCep(formatCep(e.target.value));
                setError(null);
              }}
              maxLength={9}
              className="font-mono"
              disabled={disabled || isCalculating}
            />
          </div>
          <Button
            onClick={handleCalculate}
            disabled={disabled || isCalculating || tempCep.replace(/\D/g, '').length < 8}
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
          <p className="text-sm text-destructive">{error}</p>
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
                htmlFor={`checkout-shipping-${index}`}
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem 
                    value={String(index)} 
                    id={`checkout-shipping-${index}`}
                    disabled={disabled}
                  />
                  <div>
                    <p className="font-medium">
                      {option.label}
                      {option.carrier && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({option.carrier})
                        </span>
                      )}
                      {option.sourceProvider && (
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                          via {option.sourceProvider}
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
                    <span className="font-semibold" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>Grátis</span>
                  ) : (
                    <span className="font-semibold">
                      R$ {formatPrice(option.price)}
                    </span>
                  )}
                </div>
              </Label>
            ))}
          </RadioGroup>
        )}

        {isEditing && hasShipping && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setIsEditing(false);
              setTempCep(shipping.cep);
            }}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
