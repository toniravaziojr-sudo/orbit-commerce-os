// =============================================
// CHECKOUT DEMO BLOCK - Demo checkout with order bump and upsell
// =============================================

import React from 'react';
import { CreditCard, Truck, User, MapPin, Lock, Shield, BadgeCheck, Sparkles, ChevronRight, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { demoProducts } from '@/lib/builder/demoData';
import { cn } from '@/lib/utils';

interface CheckoutDemoBlockProps {
  showOrderBump?: boolean;
  showTimeline?: boolean;
  isEditing?: boolean;
}

export function CheckoutDemoBlock({
  showOrderBump = true,
  showTimeline = true,
  isEditing,
}: CheckoutDemoBlockProps) {
  // Demo cart items
  const cartItems = [
    { ...demoProducts[0], quantity: 1 },
    { ...demoProducts[2], quantity: 1 },
  ];

  // Demo order bump
  const orderBumpProduct = demoProducts[5]; // Mini tamanho viagem

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shipping = 0; // Free
  const total = subtotal + shipping;

  const steps = [
    { id: 'contact', label: 'Contato', icon: User, completed: true },
    { id: 'shipping', label: 'Entrega', icon: Truck, completed: true },
    { id: 'payment', label: 'Pagamento', icon: CreditCard, completed: false, active: true },
  ];

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

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Checkout Form */}
        <div className="lg:col-span-3 space-y-6">
          {/* Contact Info (completed) */}
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="h-3 w-3 text-green-600" />
                </div>
                Informações de Contato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">Maria Silva</p>
                  <p className="text-muted-foreground">maria@email.com • (11) 99999-9999</p>
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
                Endereço de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Rua das Flores, 123 - Apto 45</p>
                    <p className="text-muted-foreground">Jardim Paulista, São Paulo - SP, 01310-100</p>
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
          <Card className="border-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <CreditCard className="h-3 w-3 text-primary-foreground" />
                </div>
                Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup defaultValue="credit" className="space-y-3">
                <div className="flex items-center space-x-3 border rounded-lg p-3 bg-primary/5 border-primary">
                  <RadioGroupItem value="credit" id="credit" />
                  <Label htmlFor="credit" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span className="font-medium">Cartão de Crédito</span>
                      </div>
                      <span className="text-xs text-muted-foreground">até 12x sem juros</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-3">
                  <RadioGroupItem value="pix" id="pix" />
                  <Label htmlFor="pix" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚡</span>
                        <span className="font-medium">PIX</span>
                      </div>
                      <Badge variant="secondary" className="text-green-600 text-xs">5% OFF</Badge>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 border rounded-lg p-3">
                  <RadioGroupItem value="boleto" id="boleto" />
                  <Label htmlFor="boleto" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📄</span>
                      <span className="font-medium">Boleto Bancário</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {/* Credit card form */}
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
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

          {/* Order Bump */}
          {showOrderBump && (
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
                      <Badge className="bg-amber-500 text-white text-xs">-40%</Badge>
                    </div>
                    <div className="flex gap-3">
                      <img
                        src={orderBumpProduct.image}
                        alt={orderBumpProduct.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-medium text-sm">{orderBumpProduct.name}</p>
                        <p className="text-xs text-muted-foreground">Kit completo para viagem</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs line-through text-muted-foreground">
                            R$ {orderBumpProduct.compare_at_price?.toFixed(2)}
                          </span>
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

        {/* Order Summary */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Resumo do Pedido
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
                Finalizar Compra
              </Button>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>SSL</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Seguro</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BadgeCheck className="h-3 w-3" />
                  <span>Verificado</span>
                </div>
              </div>

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
          [Prévia do checkout com Order Bump e Timeline de progresso]
        </p>
      )}
    </div>
  );
}
