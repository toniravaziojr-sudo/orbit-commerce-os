import { Tag } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrency } from '@/lib/cartTotals';
import { PaymentMethodSelector } from '../PaymentMethodSelector';
import type { PaymentMethod, CardData } from '@/hooks/useCheckoutPayment';

interface Step4Props {
  disabled: boolean;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  cardData: CardData;
  onCardDataChange: (data: CardData) => void;
  methodsOrder?: PaymentMethod[];
  customLabels?: Partial<Record<PaymentMethod, string>>;
  showPix?: boolean;
  showBoleto?: boolean;
  showCreditCard?: boolean;
  showMercadoPagoRedirect?: boolean;
  maxInstallments: number;
  freeInstallments: number;
  selectedInstallments: number;
  onInstallmentsChange: (n: number) => void;
  grandTotal: number;
  paymentMethodDiscountAmount: number;
  pixDiscountPercent: number;
}

// Step 4: Payment - Real payment method selection
export function Step4Payment({
  disabled,
  paymentMethod,
  onPaymentMethodChange,
  cardData,
  onCardDataChange,
  methodsOrder,
  customLabels,
  showPix,
  showBoleto,
  showCreditCard,
  showMercadoPagoRedirect,
  maxInstallments,
  freeInstallments,
  selectedInstallments,
  onInstallmentsChange,
  grandTotal,
  paymentMethodDiscountAmount,
  pixDiscountPercent,
}: Step4Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Pagamento</h2>
        <p className="text-sm text-muted-foreground">Escolha como deseja pagar</p>
      </div>

      <PaymentMethodSelector
        selectedMethod={paymentMethod}
        onMethodChange={onPaymentMethodChange}
        cardData={cardData}
        onCardDataChange={onCardDataChange}
        disabled={disabled}
        methodsOrder={methodsOrder}
        customLabels={customLabels}
        showPix={showPix}
        showBoleto={showBoleto}
        showCreditCard={showCreditCard}
        showMercadoPagoRedirect={showMercadoPagoRedirect}
        freeInstallments={freeInstallments}
        maxInstallments={maxInstallments}
        pixDiscountPercent={pixDiscountPercent}
      />

      {/* Payment method discount info */}
      {paymentMethodDiscountAmount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: 'var(--theme-accent-color, hsl(var(--primary)))', backgroundColor: 'hsl(var(--primary) / 0.05)' }}>
          <Tag className="h-4 w-4" style={{ color: 'var(--theme-accent-color, hsl(var(--primary)))' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--theme-accent-color, hsl(var(--primary)))' }}>
            Desconto de {formatCurrency(paymentMethodDiscountAmount)} aplicado!
          </span>
        </div>
      )}

      {/* Installments selector for credit card */}
      {paymentMethod === 'credit_card' && maxInstallments > 1 && (
        <div className="border rounded-lg p-4">
          <Label className="text-sm font-semibold mb-2 block">Parcelas</Label>
          <RadioGroup
            value={String(selectedInstallments)}
            onValueChange={(v) => onInstallmentsChange(parseInt(v))}
            className="space-y-2"
            disabled={disabled}
          >
            {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(n => {
              const installmentValue = grandTotal / n;
              return (
                <Label
                  key={n}
                  htmlFor={`installment-${n}`}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value={String(n)} id={`installment-${n}`} disabled={disabled} />
                  <span className="flex-1 text-sm">
                    {n}x de {formatCurrency(installmentValue)} {n === 1 ? '(à vista)' : n <= freeInstallments ? 'sem juros' : 'com juros'}
                  </span>
                  {n === 1 && <span className="text-xs font-medium text-muted-foreground">{formatCurrency(grandTotal)}</span>}
                </Label>
              );
            })}
          </RadioGroup>
        </div>
      )}
    </div>
  );
}
