import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCode, CreditCard, FileText, Info, Save, AlertTriangle } from 'lucide-react';
import { usePaymentMethodDiscounts, PaymentMethodDiscount } from '@/hooks/usePaymentMethodDiscounts';
import { usePaymentProviders } from '@/hooks/usePaymentProviders';
import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';

const METHODS_META = {
  pix: { label: 'PIX', icon: QrCode, color: 'text-emerald-600', showInstallments: false },
  credit_card: { label: 'Cartão de Crédito', icon: CreditCard, color: 'text-blue-600', showInstallments: true },
  boleto: { label: 'Boleto Bancário', icon: FileText, color: 'text-muted-foreground', showInstallments: false },
} as const;

const PROVIDER_LABELS: Record<string, string> = {
  pagarme: 'Pagar.me',
  mercadopago: 'Mercado Pago',
  pagbank: 'PagBank',
};

function ProviderPaymentConfig({ provider }: { provider: string }) {
  const { discounts, isLoading, saveDiscount, isSaving } = usePaymentMethodDiscounts(provider);
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
    if (discount) saveDiscount({ ...discount, provider });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

export function PaymentSettingsTab() {
  const { providers, isLoading: loadingProviders } = usePaymentProviders();
  const activeProviders = providers.filter(p => p.is_enabled);
  const [activeTab, setActiveTab] = useState('');

  // Set default tab to first active provider
  useEffect(() => {
    if (activeProviders.length > 0 && !activeTab) {
      setActiveTab(activeProviders[0].provider);
    }
  }, [activeProviders, activeTab]);

  if (loadingProviders) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const hasActiveGateway = activeProviders.length > 0;

  return (
    <div className="space-y-6">
      {!hasActiveGateway && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Nenhum gateway de pagamento ativo.</strong> Para configurar descontos e parcelamentos, 
            você precisa ativar pelo menos um operador de pagamento em{' '}
            <Link to="/integrations" className="underline font-medium hover:text-destructive">
              Integrações
            </Link>.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription>
          Configure os <strong>descontos reais</strong> e parcelamentos por forma de pagamento para cada gateway ativo.
          Cada operadora pode ter regras diferentes. As configurações visuais (labels, badges) do Builder são apenas informativas.
        </AlertDescription>
      </Alert>

      {hasActiveGateway && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {activeProviders.map(p => (
              <TabsTrigger key={p.provider} value={p.provider}>
                {PROVIDER_LABELS[p.provider] || p.provider}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeProviders.map(p => (
            <TabsContent key={p.provider} value={p.provider} className="mt-4">
              <ProviderPaymentConfig provider={p.provider} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
