// =============================================
// PAYMENT METHOD SELECTOR - Choose between PIX, Boleto, Credit Card
// Supports dynamic ordering via methodsOrder prop
// =============================================

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { QrCode, Barcode, CreditCard } from 'lucide-react';
import { PaymentMethod, CardData } from '@/hooks/useCheckoutPayment';

interface PaymentMethodConfig {
  value: PaymentMethod;
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}

const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodConfig> = {
  pix: {
    value: 'pix',
    id: 'payment-pix',
    icon: <QrCode className="h-5 w-5 text-green-600" />,
    label: 'PIX',
    description: 'Pagamento instantâneo',
  },
  boleto: {
    value: 'boleto',
    id: 'payment-boleto',
    icon: <Barcode className="h-5 w-5 text-blue-600" />,
    label: 'Boleto Bancário',
    description: 'Vencimento em 3 dias úteis',
  },
  credit_card: {
    value: 'credit_card',
    id: 'payment-card',
    icon: <CreditCard className="h-5 w-5 text-purple-600" />,
    label: 'Cartão de Crédito',
    description: 'Em até 12x sem juros',
  },
};

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  cardData: CardData;
  onCardDataChange: (data: CardData) => void;
  disabled?: boolean;
  methodsOrder?: PaymentMethod[];
  customLabels?: Record<string, string>;
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  cardData,
  onCardDataChange,
  disabled = false,
  methodsOrder = ['pix', 'credit_card', 'boleto'],
  customLabels = {},
}: PaymentMethodSelectorProps) {
  const formatCardNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  // Get ordered methods based on methodsOrder prop
  const orderedMethods = useMemo(() => {
    return methodsOrder
      .filter(method => PAYMENT_METHODS[method])
      .map(method => PAYMENT_METHODS[method]);
  }, [methodsOrder]);

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-4">Forma de pagamento</h3>

      <RadioGroup
        value={selectedMethod}
        onValueChange={(value) => onMethodChange(value as PaymentMethod)}
        className="space-y-3"
        disabled={disabled}
      >
        {orderedMethods.map((method) => (
          <Label
            key={method.value}
            htmlFor={method.id}
            className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <RadioGroupItem value={method.value} id={method.id} disabled={disabled} />
            {method.icon}
            <div className="flex-1">
              <p className="font-medium">{method.label}</p>
              <p className="text-sm text-muted-foreground">{method.description}</p>
            </div>
            {customLabels[method.value] && (
              <span className="text-xs font-semibold bg-primary text-primary-foreground px-2 py-1 rounded">
                {customLabels[method.value]}
              </span>
            )}
          </Label>
        ))}
      </RadioGroup>

      {/* Credit Card Form */}
      {selectedMethod === 'credit_card' && (
        <div className="mt-4 pt-4 border-t space-y-4">
          <div>
            <Label htmlFor="card-number">Número do cartão</Label>
            <Input
              id="card-number"
              type="text"
              placeholder="0000 0000 0000 0000"
              value={cardData.number}
              onChange={(e) => onCardDataChange({ ...cardData, number: formatCardNumber(e.target.value) })}
              disabled={disabled}
              maxLength={19}
              className="font-mono"
            />
          </div>

          <div>
            <Label htmlFor="card-holder">Nome no cartão</Label>
            <Input
              id="card-holder"
              type="text"
              placeholder="NOME COMO ESTÁ NO CARTÃO"
              value={cardData.holderName}
              onChange={(e) => onCardDataChange({ ...cardData, holderName: e.target.value.toUpperCase() })}
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="card-expiry">Validade</Label>
              <Input
                id="card-expiry"
                type="text"
                placeholder="MM/AA"
                value={cardData.expMonth && cardData.expYear ? `${cardData.expMonth}/${cardData.expYear}` : ''}
                onChange={(e) => {
                  const formatted = formatExpiry(e.target.value);
                  const [month, year] = formatted.split('/');
                  onCardDataChange({ 
                    ...cardData, 
                    expMonth: month || '', 
                    expYear: year || '',
                  });
                }}
                disabled={disabled}
                maxLength={5}
              />
            </div>

            <div>
              <Label htmlFor="card-cvv">CVV</Label>
              <Input
                id="card-cvv"
                type="text"
                placeholder="123"
                value={cardData.cvv}
                onChange={(e) => onCardDataChange({ ...cardData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                disabled={disabled}
                maxLength={4}
                className="font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
