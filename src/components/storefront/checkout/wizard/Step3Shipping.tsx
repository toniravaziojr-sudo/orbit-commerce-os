import { Loader2, Truck } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/cartTotals';

interface Step3Props {
  shippingOptions: any[];
  selectedShipping: any;
  onSelectShipping: (option: any) => void;
  isCalculating: boolean;
  disabled: boolean;
}

// Step 3: Shipping
export function Step3Shipping({
  shippingOptions,
  selectedShipping,
  onSelectShipping,
  isCalculating,
  disabled,
}: Step3Props) {
  if (isCalculating) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Calculando opções de frete...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Escolha a entrega</h2>
        <p className="text-sm text-muted-foreground">Selecione como deseja receber seu pedido</p>
      </div>

      {shippingOptions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma opção de frete disponível.</p>
          <p className="text-sm">Volte e verifique o endereço informado.</p>
        </div>
      ) : (
        <RadioGroup
          value={selectedShipping?.label || ''}
          onValueChange={(value) => {
            const option = shippingOptions.find(o => o.label === value);
            if (option) onSelectShipping(option);
          }}
          disabled={disabled}
        >
          <div className="space-y-3">
            {shippingOptions.map((option, index) => (
              <label
                key={index}
                className={cn(
                  "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors",
                  selectedShipping?.label === option.label
                    ? "border-primary bg-primary/5"
                    : option.isFree
                    ? "border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={option.label} id={`shipping-${index}`} />
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
                      Entrega em até {option.deliveryDays} dia(s) úteis
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {option.isFree ? (
                    <div className="flex flex-col items-end">
                      {option.originalPrice != null && option.originalPrice > 0 && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(option.originalPrice)}
                        </span>
                      )}
                      <span className="sf-flag-text font-semibold" style={{ color: 'var(--theme-flags-color, var(--theme-accent-color, #22c55e))' }}>Grátis</span>
                    </div>
                  ) : (
                    <span className="font-semibold">{formatCurrency(option.price)}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </RadioGroup>
      )}
    </div>
  );
}
