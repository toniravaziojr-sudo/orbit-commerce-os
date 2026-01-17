// =============================================
// CART DEMO BLOCK - Demo cart with Cross-sell
// Bloco de demonstração do carrinho para uso no Builder
// Props editáveis via UI - SEM IMPORT de demoData
// Dados demo são passados via props/defaultProps do registry
// =============================================

import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Tag, ShoppingBag, Truck, Shield, CreditCard, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DemoCartItem {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number | null;
  image: string;
  quantity: number;
}

interface DemoProduct {
  id: string;
  name: string;
  price: number;
  image: string;
}

interface CartDemoBlockProps {
  // Layout & Display
  showCrossSell?: boolean;
  showCouponField?: boolean;
  showTrustBadges?: boolean;
  showShippingCalculator?: boolean;
  showPromoBanner?: boolean;
  // Banner props - URLs e configurações reais
  bannerDesktopUrl?: string | null;
  bannerMobileUrl?: string | null;
  bannerLink?: string | null;
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
  // Demo items (via props, não hardcoded)
  demoCartItems?: DemoCartItem[];
  demoCrossSellProducts?: DemoProduct[];
  // Editor
  isEditing?: boolean;
}

// Default demo items - usando placeholders neutros (NÃO cosméticos)
// Estes são usados apenas no editor quando não há conteúdo real
const defaultCartItems: DemoCartItem[] = [
  {
    id: 'cart-1',
    name: 'Produto Exemplo 1',
    price: 89.90,
    compare_at_price: 129.90,
    // Placeholder neutro - sem referência a categoria específica
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EProduto%3C/text%3E%3C/svg%3E',
    quantity: 2,
  },
  {
    id: 'cart-2',
    name: 'Produto Exemplo 2',
    price: 59.90,
    image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EProduto%3C/text%3E%3C/svg%3E',
    quantity: 1,
  },
];

// Placeholders neutros para cross-sell (NÃO cosméticos)
const defaultCrossSellProducts: DemoProduct[] = [
  { id: 'cs-1', name: 'Sugestão 1', price: 39.90, image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="12" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ESugestão%3C/text%3E%3C/svg%3E' },
  { id: 'cs-2', name: 'Sugestão 2', price: 49.90, image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="12" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ESugestão%3C/text%3E%3C/svg%3E' },
  { id: 'cs-3', name: 'Sugestão 3', price: 29.90, image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="12" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ESugestão%3C/text%3E%3C/svg%3E' },
  { id: 'cs-4', name: 'Sugestão 4', price: 69.90, image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="12" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ESugestão%3C/text%3E%3C/svg%3E' },
];

export function CartDemoBlock({
  showCrossSell = true,
  showCouponField = true,
  showTrustBadges = true,
  showShippingCalculator = true,
  showPromoBanner = true,
  bannerDesktopUrl,
  bannerMobileUrl,
  bannerLink,
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
  demoCartItems = defaultCartItems,
  demoCrossSellProducts = defaultCrossSellProducts,
  isEditing,
}: CartDemoBlockProps) {
  const cartItems = demoCartItems;
  const crossSellProducts = demoCrossSellProducts.slice(0, 4);

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const discount = 0;
  const shipping = subtotal >= freeShippingThreshold ? 0 : 19.90;
  const total = subtotal - discount + shipping;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Promo Banner - exibe imagem real se configurada */}
      {showPromoBanner && (bannerDesktopUrl || bannerMobileUrl) && (
        <div className="mb-6">
          {bannerLink ? (
            <a 
              href={bannerLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:opacity-90 transition-opacity"
            >
              {/* Mobile banner */}
              {bannerMobileUrl && (
                <img
                  src={bannerMobileUrl}
                  alt="Promoção"
                  className="w-full h-auto object-cover rounded-lg sf-hidden sf-block-mobile"
                  loading="lazy"
                />
              )}
              {/* Desktop banner */}
              {bannerDesktopUrl && (
                <img
                  src={bannerDesktopUrl}
                  alt="Promoção"
                  className="w-full h-auto object-cover rounded-lg sf-block sf-hidden-mobile"
                  loading="lazy"
                />
              )}
            </a>
          ) : (
            <>
              {/* Mobile banner */}
              {bannerMobileUrl && (
                <img
                  src={bannerMobileUrl}
                  alt="Promoção"
                  className="w-full h-auto object-cover rounded-lg sf-hidden sf-block-mobile"
                  loading="lazy"
                />
              )}
              {/* Desktop banner */}
              {bannerDesktopUrl && (
                <img
                  src={bannerDesktopUrl}
                  alt="Promoção"
                  className="w-full h-auto object-cover rounded-lg sf-block sf-hidden-mobile"
                  loading="lazy"
                />
              )}
            </>
          )}
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-8">
        <ShoppingCart className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <Badge variant="secondary" className="ml-2">{cartItems.length} itens</Badge>
      </div>

      {/* Cart Layout - uses sf-cart-layout for container query responsiveness */}
      <div className="sf-cart-layout">
        {/* Cart Items - main column */}
        <div className="space-y-6 min-w-0">
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

          {/* Shipping Calculator - Demo placeholder */}
          {showShippingCalculator && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Calcular Frete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Digite seu CEP"
                    className="flex-1 h-10 px-3 border rounded-lg text-sm bg-background"
                    maxLength={9}
                  />
                  <Button variant="secondary" size="sm" className="h-10">
                    Calcular
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cross-sell */}
          {showCrossSell && crossSellProducts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Você também pode gostar</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Grid uses sf-offers-grid for container-based responsiveness */}
                <div className="sf-offers-grid">
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

        {/* Order Summary - sidebar */}
        <div className="sf-cart-summary min-w-0">
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coupon input */}
              {showCouponField && (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={couponPlaceholder}
                      className="w-full h-10 pl-9 pr-3 border rounded-lg text-sm bg-background"
                    />
                  </div>
                  <Button variant="secondary" size="sm" className="h-10">
                    {couponButtonText}
                  </Button>
                </div>
              )}

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
                    <span className="text-green-600 font-medium">{freeShippingLabel}</span>
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
                {checkoutButtonText}
              </Button>

              <Button variant="outline" className="w-full">
                {continueShoppingText}
              </Button>

              {/* Trust badges */}
              {showTrustBadges && (
                <div className="grid grid-cols-3 gap-2 pt-4 border-t">
                  <div className="text-center">
                    <Truck className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-[10px] text-muted-foreground">{trustBadge1Label}</p>
                  </div>
                  <div className="text-center">
                    <Shield className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-[10px] text-muted-foreground">{trustBadge2Label}</p>
                  </div>
                  <div className="text-center">
                    <CreditCard className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-[10px] text-muted-foreground">{trustBadge3Label}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {isEditing && (
        <p className="text-center text-xs text-muted-foreground mt-8">
          [Prévia do carrinho - edite as props para personalizar]
        </p>
      )}
    </div>
  );
}
