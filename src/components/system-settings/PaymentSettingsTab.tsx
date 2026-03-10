import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, CreditCard, FileText, Info, Save } from 'lucide-react';
import { usePaymentMethodDiscounts, PaymentMethodDiscount } from '@/hooks/usePaymentMethodDiscounts';
import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';

const METHODS_META = {
  pix: { label: 'PIX', icon: QrCode, color: 'text-emerald-600', showInstallments: false },
  credit_card: { label: 'Cartão de Crédito', icon: CreditCard, color: 'text-blue-600', showInstallments: true },
  boleto: { label: 'Boleto Bancário', icon: FileText, color: 'text-muted-foreground', showInstallments: false },
} as const;

export function PaymentSettingsTab() {
  const { discounts, isLoading, saveDiscount, isSaving } = usePaymentMethodDiscounts();
  const [localDiscounts, setLocalDiscounts] = useState<PaymentMethodDiscount[]>([]);

  useEffect(() => {
    if (discounts.length > 0) {
      setLocalDiscounts(discounts);
    }
  }, [discounts]);

  const updateLocal = (method: string, updates: Partial<PaymentMethodDiscount>) => {
    setLocalDiscounts(prev =>
      prev.map(d => d.payment_method === method ? { ...d, ...updates } : d)
    );
  };

  const handleSave = (method: string) => {
    const discount = localDiscounts.find(d => d.payment_method === method);
    if (discount) saveDiscount(discount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription>
          Configure aqui os <strong>descontos reais</strong> aplicados por forma de pagamento e o número máximo de parcelas.
          Essas configurações afetam o valor final cobrado do cliente. As configurações visuais (labels, badges) do Builder são apenas informativas.
        </AlertDescription>
      </Alert>

      {(['pix', 'credit_card', 'boleto'] as const).map(method => {
        const meta = METHODS_META[method];
        const Icon = meta.icon;
        const discount = localDiscounts.find(d => d.payment_method === method);
        if (!discount) return null;

        return (
          <Card key={method}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icon className={`h-5 w-5 ${meta.color}`} />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{meta.label}</CardTitle>
                  <CardDescription>
                    {method === 'pix' && 'Configure desconto para pagamentos instantâneos via PIX'}
                    {method === 'credit_card' && 'Configure parcelas e desconto para pagamento à vista no cartão'}
                    {method === 'boleto' && 'Configure desconto para pagamentos via boleto bancário'}
                  </CardDescription>
                </div>
                <Switch
                  checked={discount.is_enabled}
                  onCheckedChange={(checked) => updateLocal(method, { is_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Discount section */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-sm">Tipo de desconto</Label>
                  <Select
                    value={discount.discount_type}
                    onValueChange={(v) => updateLocal(method, { discount_type: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">
                    Valor do desconto {discount.discount_type === 'percentage' ? '(%)' : '(R$)'}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={discount.discount_type === 'percentage' ? 100 : undefined}
                    step={discount.discount_type === 'percentage' ? 0.5 : 0.01}
                    value={discount.discount_value}
                    onChange={(e) => updateLocal(method, { discount_value: parseFloat(e.target.value) || 0 })}
                    className="mt-1"
                    placeholder={discount.discount_type === 'percentage' ? '5' : '10.00'}
                  />
                </div>
                <div>
                  <Label className="text-sm">Descrição (opcional)</Label>
                  <Input
                    value={discount.description || ''}
                    onChange={(e) => updateLocal(method, { description: e.target.value })}
                    className="mt-1"
                    placeholder="Ex: Desconto especial via PIX"
                  />
                </div>
              </div>

              {/* Installments for credit card */}
              {meta.showInstallments && (
                <>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-sm">Parcelas máximas</Label>
                      <Select
                        value={String(discount.installments_max)}
                        onValueChange={(v) => updateLocal(method, { installments_max: parseInt(v) })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                            <SelectItem key={n} value={String(n)}>
                              {n}x {n === 1 ? '(à vista)' : 'sem juros'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">Valor mínimo por parcela (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={(discount.installments_min_value_cents / 100).toFixed(2)}
                        onChange={(e) => updateLocal(method, {
                          installments_min_value_cents: Math.round(parseFloat(e.target.value || '0') * 100)
                        })}
                        className="mt-1"
                        placeholder="5.00"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => handleSave(method)}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Salvar {meta.label}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
