// =============================================
// PAYMENT SETTINGS TAB - Unified view with gateway dropdown per method
// Each payment method (PIX, Card, Boleto) has its own gateway selector
// Plus optional MP Redirect section
// =============================================

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, CreditCard, FileText, Info, Save, AlertTriangle, ExternalLink } from 'lucide-react';
import { usePaymentMethodDiscounts, PaymentMethodDiscount } from '@/hooks/usePaymentMethodDiscounts';
import { usePaymentProviders } from '@/hooks/usePaymentProviders';
import { usePaymentGatewayMap } from '@/hooks/usePaymentGatewayMap';
import { useState, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';

const METHODS_META = {
  pix: { label: 'PIX', icon: QrCode, color: 'text-emerald-600', showInstallments: false, description: 'Pagamento instantâneo via PIX' },
  credit_card: { label: 'Cartão de Crédito', icon: CreditCard, color: 'text-blue-600', showInstallments: true, description: 'Pagamento via cartão de crédito' },
  boleto: { label: 'Boleto Bancário', icon: FileText, color: 'text-muted-foreground', showInstallments: false, description: 'Pagamento via boleto bancário' },
} as const;

const PROVIDER_LABELS: Record<string, string> = {
  pagarme: 'Pagar.me',
  mercado_pago: 'Mercado Pago',
  mercadopago: 'Mercado Pago',
  pagbank: 'PagBank',
};

type MethodKey = 'pix' | 'credit_card' | 'boleto';

interface MethodGatewayConfig {
  payment_method: MethodKey;
  provider: string;
  is_enabled: boolean;
}

function MethodPaymentCard({
  method,
  activeProviders,
  gatewayConfig,
  onGatewayChange,
  discount,
  onDiscountChange,
  onSave,
  isSaving,
}: {
  method: MethodKey;
  activeProviders: { provider: string }[];
  gatewayConfig: MethodGatewayConfig;
  onGatewayChange: (updates: Partial<MethodGatewayConfig>) => void;
  discount: PaymentMethodDiscount | null;
  onDiscountChange: (updates: Partial<PaymentMethodDiscount>) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const meta = METHODS_META[method];
  const Icon = meta.icon;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className={`h-5 w-5 ${meta.color}`} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{meta.label}</CardTitle>
            <CardDescription>{meta.description}</CardDescription>
          </div>
          <Switch
            checked={gatewayConfig.is_enabled}
            onCheckedChange={(checked) => onGatewayChange({ is_enabled: checked })}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gateway selector */}
        <div className="bg-muted/50 rounded-lg p-3">
          <Label className="text-sm font-medium">Intermediadora responsável</Label>
          <Select
            value={gatewayConfig.provider}
            onValueChange={(v) => onGatewayChange({ provider: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione o gateway" />
            </SelectTrigger>
            <SelectContent>
              {activeProviders.map(p => (
                <SelectItem key={p.provider} value={p.provider}>
                  {PROVIDER_LABELS[p.provider] || p.provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Gateway que processará pagamentos via {meta.label} de forma transparente no checkout
          </p>
        </div>

        {/* Discount & installment settings */}
        {discount && (
          <>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label className="text-sm">Tipo de desconto</Label>
                <Select
                  value={discount.discount_type}
                  onValueChange={(v) => onDiscountChange({ discount_type: v })}
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
                  onChange={(e) => onDiscountChange({ discount_value: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                  placeholder={discount.discount_type === 'percentage' ? '5' : '10.00'}
                />
              </div>
              <div>
                <Label className="text-sm">Descrição (opcional)</Label>
                <Input
                  value={discount.description || ''}
                  onChange={(e) => onDiscountChange({ description: e.target.value })}
                  className="mt-1"
                  placeholder="Ex: Desconto especial via PIX"
                />
              </div>
            </div>

            {/* PIX Expiration */}
            {method === 'pix' && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm">Tempo de expiração do PIX</Label>
                  <Select
                    value={String(discount.pix_expiration_minutes)}
                    onValueChange={(v) => onDiscountChange({ pix_expiration_minutes: parseInt(v) })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="60">1 hora</SelectItem>
                      <SelectItem value="120">2 horas</SelectItem>
                      <SelectItem value="360">6 horas</SelectItem>
                      <SelectItem value="720">12 horas</SelectItem>
                      <SelectItem value="1440">24 horas</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo de validade do QR Code/código PIX após a geração
                  </p>
                </div>
              </>
            )}

            {/* Boleto Expiration */}
            {method === 'boleto' && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm">Prazo de vencimento do Boleto</Label>
                  <Select
                    value={String(discount.boleto_expiration_days)}
                    onValueChange={(v) => onDiscountChange({ boleto_expiration_days: parseInt(v) })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 dia</SelectItem>
                      <SelectItem value="2">2 dias</SelectItem>
                      <SelectItem value="3">3 dias</SelectItem>
                      <SelectItem value="5">5 dias</SelectItem>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dias úteis para pagamento após a emissão do boleto
                  </p>
                </div>
              </>
            )}

            {/* Credit Card Installments */}
            {meta.showInstallments && (
              <>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label className="text-sm">Parcelas máximas</Label>
                    <Select
                      value={String(discount.installments_max)}
                      onValueChange={(v) => onDiscountChange({ installments_max: parseInt(v) })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x {n === 1 ? '(à vista)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Parcelas sem juros</Label>
                    <Select
                      value={String(discount.free_installments)}
                      onValueChange={(v) => onDiscountChange({ free_installments: parseInt(v) })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: discount.installments_max }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x {n === 1 ? '(à vista)' : 'sem juros'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Até quantas parcelas o cliente não paga juros
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm">Valor mínimo por parcela (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={(discount.installments_min_value_cents / 100).toFixed(2)}
                      onChange={(e) => onDiscountChange({
                        installments_min_value_cents: Math.round(parseFloat(e.target.value || '0') * 100)
                      })}
                      className="mt-1"
                      placeholder="5.00"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            Salvar {meta.label}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentSettingsTab() {
  const { providers, isLoading: loadingProviders } = usePaymentProviders();
  const { entries: gatewayMap, saveEntry, isSaving: savingMap } = usePaymentGatewayMap();
  const activeProviders = providers.filter(p => p.is_enabled);

  // Local state for gateway configs per method
  const [localGatewayConfigs, setLocalGatewayConfigs] = useState<Record<MethodKey, MethodGatewayConfig>>({
    pix: { payment_method: 'pix', provider: '', is_enabled: false },
    credit_card: { payment_method: 'credit_card', provider: '', is_enabled: false },
    boleto: { payment_method: 'boleto', provider: '', is_enabled: false },
  });

  // Local state for discounts - keyed by method, loads from the selected provider's discounts
  const [localDiscounts, setLocalDiscounts] = useState<Record<MethodKey, PaymentMethodDiscount | null>>({
    pix: null,
    credit_card: null,
    boleto: null,
  });

  // Load discount data for each method based on its selected provider
  const pixProvider = localGatewayConfigs.pix.provider;
  const cardProvider = localGatewayConfigs.credit_card.provider;
  const boletoProvider = localGatewayConfigs.boleto.provider;

  // Get unique providers being used
  const usedProviders = [...new Set([pixProvider, cardProvider, boletoProvider].filter(Boolean))];
  
  // Load discounts for each used provider
  const { discounts: allDiscounts, saveDiscount, isSaving: savingDiscount } = usePaymentMethodDiscounts();

  // Initialize gateway configs from DB
  useEffect(() => {
    if (gatewayMap.length > 0 || activeProviders.length > 0) {
      const defaultProvider = activeProviders[0]?.provider || '';
      setLocalGatewayConfigs(prev => {
        const newConfigs = { ...prev };
        for (const method of ['pix', 'credit_card', 'boleto'] as MethodKey[]) {
          const existing = gatewayMap.find(e => e.payment_method === method);
          if (existing) {
            newConfigs[method] = {
              payment_method: method,
              provider: existing.provider,
              is_enabled: existing.is_enabled,
            };
          } else {
            newConfigs[method] = {
              payment_method: method,
              provider: defaultProvider,
              is_enabled: false,
            };
          }
        }
        return newConfigs;
      });
    }
  }, [gatewayMap, activeProviders]);

  // Initialize discounts from DB
  useEffect(() => {
    if (allDiscounts.length > 0) {
      setLocalDiscounts(prev => {
        const newDiscounts = { ...prev };
        for (const method of ['pix', 'credit_card', 'boleto'] as MethodKey[]) {
          const provider = localGatewayConfigs[method].provider;
          const found = allDiscounts.find(d => d.payment_method === method && d.provider === provider);
          if (found) {
            newDiscounts[method] = found;
          } else if (provider) {
            newDiscounts[method] = {
              tenant_id: '',
              provider,
              payment_method: method,
              discount_type: 'percentage',
              discount_value: 0,
              is_enabled: false,
              installments_max: method === 'credit_card' ? 12 : 1,
              installments_min_value_cents: method === 'credit_card' ? 500 : 0,
              free_installments: method === 'credit_card' ? 12 : 1,
              pix_expiration_minutes: 60,
              boleto_expiration_days: 3,
              description: null,
            };
          }
        }
        return newDiscounts;
      });
    }
  }, [allDiscounts, localGatewayConfigs]);

  const handleGatewayChange = (method: MethodKey, updates: Partial<MethodGatewayConfig>) => {
    setLocalGatewayConfigs(prev => ({
      ...prev,
      [method]: { ...prev[method], ...updates },
    }));
  };

  const handleDiscountChange = (method: MethodKey, updates: Partial<PaymentMethodDiscount>) => {
    setLocalDiscounts(prev => ({
      ...prev,
      [method]: prev[method] ? { ...prev[method]!, ...updates } : null,
    }));
  };

  const handleSaveMethod = (method: MethodKey) => {
    const config = localGatewayConfigs[method];
    // Save gateway mapping
    saveEntry({
      payment_method: config.payment_method,
      provider: config.provider,
      is_enabled: config.is_enabled,
    });

    // Save discount config for the selected provider
    const discount = localDiscounts[method];
    if (discount && config.provider) {
      saveDiscount({
        ...discount,
        provider: config.provider,
        payment_method: method,
      });
    }
  };

  // MP Redirect toggle
  const mpProvider = providers.find(p => p.provider === 'mercado_pago' || p.provider === 'mercadopago');
  const [mpRedirectEnabled, setMpRedirectEnabled] = useState(false);

  useEffect(() => {
    if (mpProvider) {
      setMpRedirectEnabled(!!(mpProvider as any).mp_redirect_enabled);
    }
  }, [mpProvider]);

  const handleMpRedirectToggle = async (checked: boolean) => {
    setMpRedirectEnabled(checked);
    if (mpProvider) {
      const { supabase: _unused, ...rest } = mpProvider as any;
      // Update the mp_redirect_enabled flag
      const { error } = await (await import('@/integrations/supabase/client')).supabase
        .from('payment_providers')
        .update({ mp_redirect_enabled: checked } as any)
        .eq('id', mpProvider.id);
      
      if (error) {
        console.error('Error updating MP redirect:', error);
        setMpRedirectEnabled(!checked);
      }
    }
  };

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
            <strong>Nenhum gateway de pagamento ativo.</strong> Para configurar métodos de pagamento, 
            você precisa ativar pelo menos um operador em{' '}
            <Link to="/integrations" className="underline font-medium hover:text-destructive">
              Integrações
            </Link>.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription>
          Selecione qual <strong>intermediadora</strong> será responsável por cada método de pagamento no checkout.
          Configure também os <strong>descontos reais</strong> e parcelamentos. As configurações visuais (labels, badges) do Builder são apenas informativas.
        </AlertDescription>
      </Alert>

      {hasActiveGateway && (
        <div className="space-y-4">
          {(['pix', 'credit_card', 'boleto'] as MethodKey[]).map(method => (
            <MethodPaymentCard
              key={method}
              method={method}
              activeProviders={activeProviders}
              gatewayConfig={localGatewayConfigs[method]}
              onGatewayChange={(updates) => handleGatewayChange(method, updates)}
              discount={localDiscounts[method]}
              onDiscountChange={(updates) => handleDiscountChange(method, updates)}
              onSave={() => handleSaveMethod(method)}
              isSaving={savingMap || savingDiscount}
            />
          ))}

          {/* MP Redirect Section */}
          {mpProvider && mpProvider.is_enabled && (
            <>
              <Separator className="my-6" />
              <Card className="border-amber-500/30">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-500/10 p-2">
                      <ExternalLink className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">Mercado Pago (Checkout Externo)</CardTitle>
                      <CardDescription>
                        Habilita o Mercado Pago como opção adicional no checkout. O cliente é redirecionado para o ambiente do Mercado Pago para concluir o pagamento.
                      </CardDescription>
                    </div>
                    <Switch
                      checked={mpRedirectEnabled}
                      onCheckedChange={handleMpRedirectToggle}
                    />
                  </div>
                </CardHeader>
                {mpRedirectEnabled && (
                  <CardContent>
                    <Alert className="border-amber-500/30 bg-amber-500/5">
                      <Info className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="text-sm">
                        Quando ativado, o cliente verá <strong>"Pagar com Mercado Pago"</strong> como uma 4ª opção no checkout.
                        Ele será redirecionado para o checkout do Mercado Pago, e o pedido será criado automaticamente após a confirmação do pagamento.
                        Este modo é independente dos métodos transparentes acima.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
