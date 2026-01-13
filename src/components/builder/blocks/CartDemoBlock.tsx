// =============================================
// CART DEMO BLOCK - Demo cart with Cross-sell
// Bloco de demonstração do carrinho para uso no Builder
// Props editáveis via UI - sem conteúdo hardcoded
// =============================================

import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Tag, ShoppingBag, Truck, Shield, CreditCard, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { demoProducts } from '@/lib/builder/demoData';

interface CartDemoBlockProps {
  // Layout & Display
  showCrossSell?: boolean;
  showCouponField?: boolean;
  showTrustBadges?: boolean;
  // Textos editáveis
  title?: string;
  checkoutButtonText?: string;
  continueShoppingText?: string;
  couponPlaceholder?: string;
  couponButtonText?: string;
  // Frete grátis
  freeShippingThreshold?: number;
  freeShippingLabel?: string;
  // Trust badges
  trustBadge1Label?: string;
  trustBadge2Label?: string;
  trustBadge3Label?: string;
  // Editor
  isEditing?: boolean;
}

export function CartDemoBlock({
  showCrossSell = true,
  showCouponField = true,
  showTrustBadges = true,
  title = 'Carrinho de Compras',
  checkoutButtonText = 'Finalizar Compra',
  continueShoppingText = 'Continuar Comprando',
  couponPlaceholder = 'Cupom de desconto',
  couponButtonText = 'Aplicar',
  freeShippingThreshold = 199,
  freeShippingLabel = 'Frete Grátis',
  trustBadge1Label = 'Frete Grátis',
  trustBadge2Label = 'Compra Segura',
  trustBadge3Label = '12x s/ juros',
  isEditing,
}: CartDemoBlockProps) {
  // Demo cart items (2 products from demo data)
  const cartItems = [
    { ...demoProducts[0], quantity: 2 },
    { ...demoProducts[2], quantity: 1 },
  ];

  // Demo cross-sell products (máximo 4)
  const crossSellProducts = demoProducts.slice(4, 8);

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = 0;
  const shipping = subtotal >= 199 ? 0 : 19.90;
  const total = subtotal - discount + shipping;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <ShoppingCart className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Carrinho de Compras</h1>
        <Badge variant="secondary" className="ml-2">{cartItems.length} itens</Badge>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Seus Produtos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cartItems.map((item, index) => (
                <div key={item.id}>
                  <div className="flex gap-4">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm md:text-base line-clamp-2">{item.name}</h3>
                      {item.compare_at_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          R$ {item.compare_at_price.toFixed(2)}
                        </span>
                      )}
                      <p className="text-primary font-bold text-base md:text-lg">
                        R$ {item.price.toFixed(2)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border rounded-lg">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="font-bold">R$ {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                  {index < cartItems.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Cross-sell - ÚNICO tipo de oferta no carrinho */}
          {showCrossSell && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Você também pode gostar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {crossSellProducts.map((product) => (
                    <div key={product.id} className="group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <p className="text-xs font-medium line-clamp-2 mb-1">{product.name}</p>
                      <p className="text-sm font-bold text-primary">R$ {product.price.toFixed(2)}</p>
                      <Button size="sm" variant="outline" className="w-full mt-2 h-8 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coupon input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cupom de desconto"
                    className="w-full h-10 pl-9 pr-3 border rounded-lg text-sm bg-background"
                  />
                </div>
                <Button variant="secondary" size="sm" className="h-10">
                  Aplicar
                </Button>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto</span>
                    <span>-R$ {discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  {shipping === 0 ? (
                    <span className="text-green-600 font-medium">Grátis</span>
                  ) : (
                    <span>R$ {shipping.toFixed(2)}</span>
                  )}
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
                Finalizar Compra
              </Button>

              <Button variant="outline" className="w-full">
                Continuar Comprando
              </Button>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t">
                <div className="text-center">
                  <Truck className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[10px] text-muted-foreground">Frete Grátis</p>
                </div>
                <div className="text-center">
                  <Shield className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[10px] text-muted-foreground">Compra Segura</p>
                </div>
                <div className="text-center">
                  <CreditCard className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[10px] text-muted-foreground">12x s/ juros</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isEditing && (
        <p className="text-center text-xs text-muted-foreground mt-8">
          [Prévia do carrinho com Cross-sell]
        </p>
      )}
    </div>
  );
}
