// =============================================
// SHIPPING ESTIMATOR - CEP input and shipping options
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
  const { subtotal, shipping, setShippingCep, setShippingOptions, selectShipping } = useCart();
  const { config, quote, isLoading: configLoading } = useShipping();
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
      // Simulate async call for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const options = quote(cepDigits, subtotal);
      
      if (options.length === 0) {
        setError('Não encontramos opções de frete para este CEP.');
        setShippingOptions([]);
      } else {
        setShippingOptions(options);
      }
    } catch (err) {
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
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={String(index)} id={`shipping-${index}`} />
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {option.deliveryDays} {option.deliveryDays === 1 ? 'dia útil' : 'dias úteis'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {option.isFree ? (
                  <span className="font-semibold text-green-600">Grátis</span>
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
