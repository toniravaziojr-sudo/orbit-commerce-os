// =============================================
// CHECKOUT CONFIG TAB - Checkout settings configuration
// =============================================

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { useStoreConfig } from '@/hooks/useStoreConfig';
import { CheckoutConfig, PaymentMethod, PaymentMethodCustomLabels, defaultCheckoutConfig } from '@/lib/storeConfigTypes';
import { TestimonialsManager } from './TestimonialsManager';
import { 
  CreditCard, 
  Percent, 
  Zap, 
  MessageSquare,
  GripVertical,
  Loader2,
  Save,
  BarChart3,
  Settings2
} from 'lucide-react';

// Payment method labels
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  pix: { label: 'PIX', icon: <Zap className="h-4 w-4 text-green-500" /> },
  credit_card: { label: 'Cartão de Crédito', icon: <CreditCard className="h-4 w-4 text-blue-500" /> },
  boleto: { label: 'Boleto Bancário', icon: <CreditCard className="h-4 w-4 text-orange-500" /> },
};

export function CheckoutConfigTab() {
  const { config, isLoading, updateCheckoutConfig } = useStoreConfig();
  const [form, setForm] = useState<CheckoutConfig>(defaultCheckoutConfig);
  const [hasChanges, setHasChanges] = useState(false);
  const [draggedMethod, setDraggedMethod] = useState<PaymentMethod | null>(null);
  const [showTestimonialsManager, setShowTestimonialsManager] = useState(false);

  useEffect(() => {
    if (config?.checkoutConfig) {
      setForm(config.checkoutConfig);
    }
  }, [config?.checkoutConfig]);

  const handleChange = <K extends keyof CheckoutConfig>(key: K, value: CheckoutConfig[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateCheckoutConfig.mutateAsync(form);
    setHasChanges(false);
  };

  // Drag and drop handlers for payment methods
  const handleDragStart = (method: PaymentMethod) => {
    setDraggedMethod(method);
  };

  const handleDragOver = (e: React.DragEvent, targetMethod: PaymentMethod) => {
    e.preventDefault();
    if (!draggedMethod || draggedMethod === targetMethod) return;

    const newOrder = [...form.paymentMethodsOrder];
    const draggedIndex = newOrder.indexOf(draggedMethod);
    const targetIndex = newOrder.indexOf(targetMethod);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedMethod);

    handleChange('paymentMethodsOrder', newOrder);
  };

  const handleDragEnd = () => {
    setDraggedMethod(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Funcionalidades do Checkout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Funcionalidades do Checkout
          </CardTitle>
          <CardDescription>
            Ative ou desative recursos no checkout
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Cupom de desconto</Label>
                <p className="text-sm text-muted-foreground">
                  Campo para aplicar cupom no checkout
                </p>
              </div>
            </div>
            <Switch
              checked={form.couponEnabled}
              onCheckedChange={(checked) => handleChange('couponEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Depoimentos</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe avaliações de clientes no checkout
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {form.testimonialsEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTestimonialsManager(!showTestimonialsManager)}
                >
                  <Settings2 className="h-4 w-4 mr-1" />
                  Gerenciar
                </Button>
              )}
              <Switch
                checked={form.testimonialsEnabled}
                onCheckedChange={(checked) => handleChange('testimonialsEnabled', checked)}
              />
            </div>
          </div>

          {/* Testimonials Manager (collapsible) */}
          {form.testimonialsEnabled && showTestimonialsManager && (
            <div className="pl-7 pt-4 border-t mt-4">
              <TestimonialsManager />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ordem das Formas de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Ordem das Formas de Pagamento
          </CardTitle>
          <CardDescription>
            Arraste para reorganizar a ordem de exibição no checkout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {form.paymentMethodsOrder.map((method, index) => (
              <div key={method} className="space-y-2">
                <div
                  draggable
                  onDragStart={() => handleDragStart(method)}
                  onDragOver={(e) => handleDragOver(e, method)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border bg-card
                    cursor-move hover:bg-muted/50 transition-colors
                    ${draggedMethod === method ? 'opacity-50 border-primary' : ''}
                  `}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                  {PAYMENT_METHOD_LABELS[method].icon}
                  <span className="font-medium flex-1">{PAYMENT_METHOD_LABELS[method].label}</span>
                </div>
                {/* Custom label input for each method */}
                <div className="ml-10 pb-2">
                  <Input
                    placeholder={`Ex: 5% OFF, até 12x sem juros...`}
                    value={form.paymentMethodLabels?.[method] || ''}
                    onChange={(e) => {
                      const newLabels: PaymentMethodCustomLabels = {
                        ...form.paymentMethodLabels,
                        [method]: e.target.value || undefined,
                      };
                      // Remove empty values
                      if (!e.target.value) delete newLabels[method];
                      handleChange('paymentMethodLabels', newLabels);
                    }}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Texto personalizado (badge) - opcional
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Evento Purchase para Pixels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Evento Purchase nos Pixels
          </CardTitle>
          <CardDescription>
            Configure quando o evento de compra deve ser disparado para os pixels de marketing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={form.purchaseEventTiming}
            onValueChange={(value) => handleChange('purchaseEventTiming', value as 'all_orders' | 'paid_only')}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="all_orders" id="all_orders" className="mt-1" />
              <div className="space-y-0.5">
                <Label htmlFor="all_orders" className="cursor-pointer font-medium">
                  Todos os pedidos gerados
                </Label>
                <p className="text-sm text-muted-foreground">
                  Dispara o evento Purchase assim que o pedido é criado, independente do pagamento
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="paid_only" id="paid_only" className="mt-1" />
              <div className="space-y-0.5">
                <Label htmlFor="paid_only" className="cursor-pointer font-medium">
                  Apenas pedidos pagos/confirmados
                </Label>
                <p className="text-sm text-muted-foreground">
                  Dispara o evento Purchase somente após a confirmação do pagamento
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updateCheckoutConfig.isPending}
          className="min-w-32"
        >
          {updateCheckoutConfig.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Checkout
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
