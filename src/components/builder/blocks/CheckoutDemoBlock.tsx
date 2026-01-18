// =============================================
// CHECKOUT DEMO BLOCK - Demo checkout with order bump
// Bloco de demonstração do checkout para uso no Builder
// Props editáveis via UI - SEM IMPORT de demoData
// Dados demo são passados via props/defaultProps do registry
// =============================================

import React from 'react';
import { CreditCard, Truck, User, MapPin, Lock, Shield, BadgeCheck, Sparkles, ChevronRight, Check, Package, Tag, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { CheckoutTestimonials } from '@/components/storefront/checkout/CheckoutTestimonials';

interface DemoCartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

interface DemoOrderBump {
  id: string;
  name: string;
  description: string;
  price: number;
  compare_at_price?: number | null;
  image: string;
  discountLabel: string;
}

type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

interface CheckoutDemoBlockProps {
  // Layout & Display
  showOrderBump?: boolean;
  showTimeline?: boolean;
  showPaymentOptions?: boolean;
  showTrustBadges?: boolean;
  showCouponField?: boolean;
  showTestimonials?: boolean;
  // Tenant ID for fetching real testimonials
  tenantId?: string;
  // Textos editáveis
  contactTitle?: string;
  shippingTitle?: string;
  paymentTitle?: string;
  orderSummaryTitle?: string;
  checkoutButtonText?: string;
  // Steps labels
  stepContactLabel?: string;
  stepShippingLabel?: string;
  stepPaymentLabel?: string;
  // Payment options - NEW: dynamic order and labels from config
  paymentMethodsOrder?: PaymentMethod[];
  paymentMethodLabels?: Record<string, string>;
  // Legacy props (kept for compatibility, overridden by paymentMethodLabels)
  creditCardLabel?: string;
  pixLabel?: string;
  boletoLabel?: string;
  pixDiscount?: string;
  // Demo items (via props, não hardcoded)
  demoCartItems?: DemoCartItem[];
  demoOrderBump?: DemoOrderBump;
  // Editor
  isEditing?: boolean;
}

// Default demo items
const defaultCartItems: DemoCartItem[] = [
  {
    id: 'checkout-1',
    name: 'Produto Exemplo 1',
    price: 89.90,
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop',
    quantity: 1,
  },
  {
    id: 'checkout-2',
    name: 'Produto Exemplo 2',
    price: 59.90,
    image: 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=200&h=200&fit=crop',
    quantity: 1,
  },
];

const defaultOrderBump: DemoOrderBump = {
  id: 'bump-1',
  name: 'Kit Viagem Completo',
  description: 'Tamanho ideal para viagem',
  price: 29.90,
  compare_at_price: 49.90,
  image: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=200&h=200&fit=crop',
  discountLabel: '-40%',
};

export function CheckoutDemoBlock({
  showOrderBump = true,
  showTimeline = true,
  showPaymentOptions = true,
  showTrustBadges = true,
  showCouponField = true,
  showTestimonials = true,
  tenantId,
  contactTitle = 'Informações de Contato',
  shippingTitle = 'Endereço de Entrega',
  paymentTitle = 'Forma de Pagamento',
  orderSummaryTitle = 'Resumo do Pedido',
  checkoutButtonText = 'Finalizar Compra',
  stepContactLabel = 'Contato',
  stepShippingLabel = 'Entrega',
  stepPaymentLabel = 'Pagamento',
  // NEW: Dynamic payment methods order and labels from config
  paymentMethodsOrder = ['pix', 'credit_card', 'boleto'],
  paymentMethodLabels = {},
  // Legacy props (fallback)
  creditCardLabel = 'Cartão de Crédito',
  pixLabel = 'PIX',
  boletoLabel = 'Boleto Bancário',
  pixDiscount = '5% OFF',
  demoCartItems = defaultCartItems,
  demoOrderBump = defaultOrderBump,
  isEditing,
}: CheckoutDemoBlockProps) {
  const cartItems = demoCartItems;
  const orderBumpProduct = demoOrderBump;

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shipping = 0; // Free
  const total = subtotal + shipping;

  const steps = [
    { id: 'contact', label: stepContactLabel, icon: User, completed: true },
    { id: 'shipping', label: stepShippingLabel, icon: Truck, completed: true },
    { id: 'payment', label: stepPaymentLabel, icon: CreditCard, completed: false, active: true },
  ];

  // Payment methods config - order from props, labels from config or fallback
  const PAYMENT_METHODS_CONFIG: Record<PaymentMethod, { label: string; icon: React.ReactNode; sublabel?: string }> = {
    pix: { 
      label: 'PIX', 
      icon: <span className="text-lg">⚡</span>,
      sublabel: paymentMethodLabels.pix || undefined,
    },
    credit_card: { 
      label: 'Cartão de Crédito', 
      icon: <CreditCard className="h-4 w-4" />,
      sublabel: paymentMethodLabels.credit_card || 'até 12x sem juros',
    },
    boleto: { 
      label: 'Boleto Bancário', 
      icon: <span className="text-lg">📄</span>,
      sublabel: paymentMethodLabels.boleto || undefined,
    },
  };

  // Get ordered methods based on config
  const orderedMethods = paymentMethodsOrder.filter(m => PAYMENT_METHODS_CONFIG[m]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Progress Steps */}
      {showTimeline && (
        <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap",
                step.completed && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                step.active && "bg-primary text-primary-foreground",
                !step.completed && !step.active && "bg-muted text-muted-foreground"
              )}>
                {step.completed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
                <span className="font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Checkout Layout - uses sf-checkout-layout for container query responsiveness */}
      <div className="sf-checkout-layout">
        {/* Checkout Form - main column */}
        <div className="space-y-6 min-w-0">
          {/* Contact Info (completed) */}
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="h-3 w-3 text-green-600" />
                </div>
                {contactTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">Cliente Exemplo</p>
                  <p className="text-muted-foreground">cliente@email.com • (11) 99999-9999</p>
                </div>
                <Button variant="ghost" size="sm">Alterar</Button>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address (completed) */}
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="h-3 w-3 text-green-600" />
                </div>
                {shippingTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Rua Exemplo, 123 - Apto 45</p>
                    <p className="text-muted-foreground">Centro, São Paulo - SP, 01310-100</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">Alterar</Button>
              </div>
              
              {/* Shipping method */}
              <Separator className="my-4" />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">Entrega Express</p>
                    <p className="text-muted-foreground">Receba em até 3 dias úteis</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-green-600">Grátis</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Payment (active step) */}
          {showPaymentOptions && (
            <Card className="border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <CreditCard className="h-3 w-3 text-primary-foreground" />
                  </div>
                  {paymentTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup defaultValue={orderedMethods[0]} className="space-y-3">
                  {orderedMethods.map((method, index) => {
                    const config = PAYMENT_METHODS_CONFIG[method];
                    const isFirst = index === 0;
                    return (
                      <div 
                        key={method}
                        className={cn(
                          "flex items-center space-x-3 border rounded-lg p-3",
                          isFirst && "bg-primary/5 border-primary"
                        )}
                      >
                        <RadioGroupItem value={method} id={method} />
                        <Label htmlFor={method} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {config.icon}
                              <span className="font-medium">{config.label}</span>
                            </div>
                            {config.sublabel && (
                              method === 'pix' || method === 'boleto' ? (
                                <Badge variant="secondary" className="text-green-600 text-xs">
                                  {config.sublabel}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">{config.sublabel}</span>
                              )
                            )}
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>

                {/* Credit card form - uses sf-checkout-form-grid for responsiveness */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="sf-checkout-form-grid">
                    <div className="col-span-2">
                      <Label htmlFor="card-number">Número do Cartão</Label>
                      <Input id="card-number" placeholder="0000 0000 0000 0000" />
                    </div>
                    <div>
                      <Label htmlFor="expiry">Validade</Label>
                      <Input id="expiry" placeholder="MM/AA" />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="card-name">Nome no Cartão</Label>
                      <Input id="card-name" placeholder="Como está no cartão" />
                    </div>
                  </div>

                  <div>
                    <Label>Parcelas</Label>
                    <select className="w-full h-10 border rounded-lg px-3 mt-1 bg-background">
                      <option>1x de R$ {total.toFixed(2)} sem juros</option>
                      <option>2x de R$ {(total / 2).toFixed(2)} sem juros</option>
                      <option>3x de R$ {(total / 3).toFixed(2)} sem juros</option>
                      <option>6x de R$ {(total / 6).toFixed(2)} sem juros</option>
                      <option>12x de R$ {(total / 12).toFixed(2)} sem juros</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Bump */}
          {showOrderBump && orderBumpProduct && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Checkbox id="checkout-bump" className="mt-1" />
                  <label htmlFor="checkout-bump" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                        ADICIONE E ECONOMIZE!
                      </span>
                      <Badge className="bg-amber-500 text-white text-xs">{orderBumpProduct.discountLabel}</Badge>
                    </div>
                    <div className="flex gap-3">
                      <img
                        src={orderBumpProduct.image}
                        alt={orderBumpProduct.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-medium text-sm">{orderBumpProduct.name}</p>
                        <p className="text-xs text-muted-foreground">{orderBumpProduct.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {orderBumpProduct.compare_at_price && (
                            <span className="text-xs line-through text-muted-foreground">
                              R$ {orderBumpProduct.compare_at_price.toFixed(2)}
                            </span>
                          )}
                          <span className="font-bold text-amber-600">
                            + R$ {orderBumpProduct.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary - sidebar */}
        <div className="sf-checkout-summary-desktop min-w-0">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                {orderSummaryTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cart items */}
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{item.name}</p>
                      <p className="text-sm text-primary font-bold">R$ {item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Field */}
              {showCouponField && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Cupom de desconto"
                        className="pl-9"
                      />
                    </div>
                    <Button variant="secondary" size="sm">
                      Aplicar
                    </Button>
                  </div>
                </>
              )}

              <Separator />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  <span className="text-green-600 font-medium">Grátis</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                ou 12x de R$ {(total / 12).toFixed(2)} sem juros
              </p>

              <Button className="w-full" size="lg">
                <Lock className="h-4 w-4 mr-2" />
                {checkoutButtonText}
              </Button>


              {/* Testimonials - uses real CheckoutTestimonials component */}
              {/* Component handles fallback to demo testimonials when no real data exists */}
              {showTestimonials && (
                <CheckoutTestimonials tenantId={tenantId} />
              )}

              {/* Payment icons */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <span className="text-xl">💳</span>
                <span className="text-xl">📱</span>
                <span className="text-xl">🏦</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isEditing && (
        <p className="text-center text-xs text-muted-foreground mt-8">
          [Prévia do checkout - edite as props para personalizar]
        </p>
      )}
    </div>
  );
}
