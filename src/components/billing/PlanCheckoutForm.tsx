import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, QrCode, Package, Info } from 'lucide-react';
import { Plan, formatCurrency, useActivateSubscription } from '@/hooks/usePlans';
import { toast } from 'sonner';

interface PlanCheckoutFormProps {
  plan: Plan;
  tenantId: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ADDONS = [
  {
    addon_key: 'setup_essential',
    name: 'Setup Assistido – Essencial',
    price_cents: 49700,
    description: 'Migração e configuração básica com nossa equipe',
  },
  {
    addon_key: 'setup_complete',
    name: 'Setup Assistido – Completo',
    price_cents: 149000,
    description: 'Migração completa, personalização e treinamento',
  },
];

export function PlanCheckoutForm({ plan, tenantId, utm, onSuccess, onCancel }: PlanCheckoutFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix_validation'>(
    plan.plan_key === 'free' ? 'card' : 'card'
  );
  const [cardData, setCardData] = useState({
    number: '',
    holder_name: '',
    exp_month: '',
    exp_year: '',
    cvv: '',
  });
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  
  const activateSubscription = useActivateSubscription();

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const groups = digits.match(/.{1,4}/g);
    return groups ? groups.join(' ').slice(0, 19) : '';
  };

  const handleCardChange = (field: keyof typeof cardData, value: string) => {
    if (field === 'number') {
      setCardData(prev => ({ ...prev, [field]: formatCardNumber(value) }));
    } else if (field === 'exp_month' || field === 'exp_year') {
      setCardData(prev => ({ ...prev, [field]: value.replace(/\D/g, '').slice(0, 2) }));
    } else if (field === 'cvv') {
      setCardData(prev => ({ ...prev, [field]: value.replace(/\D/g, '').slice(0, 4) }));
    } else {
      setCardData(prev => ({ ...prev, [field]: value }));
    }
  };

  const toggleAddon = (addonKey: string) => {
    setSelectedAddons(prev =>
      prev.includes(addonKey)
        ? prev.filter(k => k !== addonKey)
        : [...prev, addonKey]
    );
  };

  const calculateTotal = () => {
    let total = plan.monthly_fee_cents;
    selectedAddons.forEach(key => {
      const addon = ADDONS.find(a => a.addon_key === key);
      if (addon) total += addon.price_cents;
    });
    return total;
  };

  const handleSubmit = async () => {
    if (paymentMethod === 'card') {
      // Validar campos do cartão
      if (!cardData.number || !cardData.holder_name || !cardData.exp_month || !cardData.exp_year || !cardData.cvv) {
        toast.error('Preencha todos os dados do cartão');
        return;
      }
    }

    const addonsToSubmit = selectedAddons.map(key => {
      const addon = ADDONS.find(a => a.addon_key === key)!;
      return {
        addon_key: addon.addon_key,
        name: addon.name,
        price_cents: addon.price_cents,
      };
    });

    try {
      const result = await activateSubscription.mutateAsync({
        tenant_id: tenantId,
        plan_key: plan.plan_key,
        payment_method_type: paymentMethod,
        card_data: paymentMethod === 'card' ? {
          ...cardData,
          number: cardData.number.replace(/\s/g, ''),
        } : undefined,
        addons: addonsToSubmit.length > 0 ? addonsToSubmit : undefined,
        utm,
      });

      if (result.status === 'active') {
        onSuccess?.();
      } else if (result.status === 'pending_pix') {
        // TODO: Mostrar QR Code do Pix
        toast.info('Escaneie o QR Code para completar a ativação');
      }
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Ativar Plano {plan.name}</CardTitle>
        <CardDescription>
          {plan.monthly_fee_cents === 0 
            ? 'Configure seu método de pagamento para ativar'
            : `${formatCurrency(plan.monthly_fee_cents)}/mês + ${(plan.fee_bps / 100).toFixed(1)}% por venda`
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Método de pagamento */}
        <div className="space-y-4">
          <Label>Método de pagamento</Label>
          
          <RadioGroup
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as 'card' | 'pix_validation')}
          >
            <div className="flex items-center space-x-2 p-3 border rounded-lg">
              <RadioGroupItem value="card" id="card" />
              <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                <CreditCard className="h-4 w-4" />
                Cartão de Crédito
              </Label>
            </div>

            {plan.plan_key === 'free' && (
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="pix_validation" id="pix" />
                <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer flex-1">
                  <QrCode className="h-4 w-4" />
                  Não tenho cartão (Pix de validação)
                </Label>
              </div>
            )}
          </RadioGroup>
        </div>

        {/* Formulário do cartão */}
        {paymentMethod === 'card' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-number">Número do cartão</Label>
              <Input
                id="card-number"
                placeholder="0000 0000 0000 0000"
                value={cardData.number}
                onChange={(e) => handleCardChange('number', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="holder-name">Nome no cartão</Label>
              <Input
                id="holder-name"
                placeholder="Como está escrito no cartão"
                value={cardData.holder_name}
                onChange={(e) => handleCardChange('holder_name', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exp-month">Mês</Label>
                <Input
                  id="exp-month"
                  placeholder="MM"
                  value={cardData.exp_month}
                  onChange={(e) => handleCardChange('exp_month', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-year">Ano</Label>
                <Input
                  id="exp-year"
                  placeholder="AA"
                  value={cardData.exp_year}
                  onChange={(e) => handleCardChange('exp_year', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  placeholder="123"
                  type="password"
                  value={cardData.cvv}
                  onChange={(e) => handleCardChange('cvv', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Info Pix validação */}
        {paymentMethod === 'pix_validation' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-1">Validação via Pix</p>
              <p className="text-sm text-muted-foreground">
                Será gerado um Pix de R$ 100,00 para validar sua conta. 
                Você pode solicitar reembolso gratuito em até 24 horas.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Add-ons */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Implantação Assistida (opcional)
          </Label>

          {ADDONS.map((addon) => (
            <div
              key={addon.addon_key}
              className="flex items-start space-x-3 p-3 border rounded-lg"
            >
              <Checkbox
                id={addon.addon_key}
                checked={selectedAddons.includes(addon.addon_key)}
                onCheckedChange={() => toggleAddon(addon.addon_key)}
              />
              <div className="flex-1">
                <Label htmlFor={addon.addon_key} className="cursor-pointer">
                  <span className="font-medium">{addon.name}</span>
                  <span className="ml-2 text-primary">{formatCurrency(addon.price_cents)}</span>
                </Label>
                <p className="text-sm text-muted-foreground">{addon.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Resumo */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Mensalidade</span>
            <span>{formatCurrency(plan.monthly_fee_cents)}</span>
          </div>
          {selectedAddons.map(key => {
            const addon = ADDONS.find(a => a.addon_key === key)!;
            return (
              <div key={key} className="flex justify-between text-sm">
                <span>{addon.name}</span>
                <span>{formatCurrency(addon.price_cents)}</span>
              </div>
            );
          })}
          <Separator />
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>{formatCurrency(calculateTotal())}</span>
          </div>
          {plan.fee_bps > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              + {(plan.fee_bps / 100).toFixed(1)}% sobre cada venda
            </p>
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={activateSubscription.isPending}
            className="flex-1"
          >
            {activateSubscription.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {paymentMethod === 'pix_validation' ? 'Gerar Pix' : 'Ativar Plano'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
