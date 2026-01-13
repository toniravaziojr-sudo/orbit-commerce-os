// =============================================
// ORDER BUMP SLOT BLOCK - Order bump offers in Checkout
// Source of truth: Aumentar Ticket (/offers) module
// Shows real offers when configured, or empty state with CTA
// NO DEMO DATA - preview via props only
// =============================================

import { Zap, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/cartTotals';
import { useCart } from '@/contexts/CartContext';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useActiveOfferRules, OfferRule } from '@/hooks/useOfferRules';
import { useState, useEffect } from 'react';

interface OrderBumpSlotBlockProps {
  title?: string;
  subtitle?: string;
  maxItems?: number;
  showWhenEmpty?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  isEditing?: boolean;
  onBumpChange?: (products: { id: string; price: number }[]) => void;
}

interface BumpProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  sku: string;
  image_url: string | null;
}

export function OrderBumpSlotBlock({
  title = 'Adicione à sua compra',
  subtitle,
  maxItems = 2,
  showWhenEmpty = true,
  ctaLabel = 'Configurar em Aumentar Ticket',
  ctaHref = '/offers',
  isEditing = false,
  onBumpChange,
}: OrderBumpSlotBlockProps) {
  const tenantSlug = useTenantSlug();
  const { items } = useCart();
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());

  // Fetch active order bump rules
  const { data: orderBumpRules = [], isLoading: rulesLoading } = useActiveOfferRules('order_bump', tenantSlug || '');

  const activeRule: OfferRule | undefined = orderBumpRules[0];

  // Fetch products from the suggested_product_ids
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['order-bump-products', activeRule?.suggested_product_ids],
    queryFn: async () => {
      if (!activeRule?.suggested_product_ids?.length) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, compare_at_price, sku')
        .in('id', activeRule.suggested_product_ids)
        .eq('status', 'active')
        .limit(maxItems);

      if (error) throw error;

      // Fetch images separately
      const productIds = data.map(p => p.id);
      const { data: images } = await supabase
        .from('product_images')
        .select('product_id, url')
        .in('product_id', productIds)
        .eq('is_primary', true);

      const imageMap = new Map(images?.map(img => [img.product_id, img.url]) || []);

      return data.map(p => ({
        ...p,
        image_url: imageMap.get(p.id) || null,
      })) as BumpProduct[];
    },
    enabled: !!activeRule?.suggested_product_ids?.length && !isEditing,
  });

  // Auto-select if default_checked is true
  useEffect(() => {
    if (activeRule?.default_checked && products.length > 0) {
      setSelectedBumps(new Set(products.map(p => p.id)));
    }
  }, [activeRule?.default_checked, products]);

  // Notify parent of bump changes
  useEffect(() => {
    if (onBumpChange) {
      const selected = products.filter(p => selectedBumps.has(p.id));
      const bumpData = selected.map(p => ({
        id: p.id,
        price: getDiscountedPrice(p),
      }));
      onBumpChange(bumpData);
    }
  }, [selectedBumps, products, onBumpChange]);

  const isLoading = rulesLoading || productsLoading;

  const getDiscountedPrice = (product: BumpProduct) => {
    if (!activeRule || activeRule.discount_type === 'none') {
      return product.price;
    }

    if (activeRule.discount_type === 'percent') {
      return product.price * (1 - activeRule.discount_value / 100);
    }

    if (activeRule.discount_type === 'fixed') {
      return Math.max(0, product.price - activeRule.discount_value);
    }

    return product.price;
  };

  const toggleBump = (productId: string) => {
    setSelectedBumps(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // In editing mode, show EXAMPLE CARD demonstration (visual preview)
  if (isEditing) {
    return (
      <section className="py-4 space-y-3">
        {/* Demo Order Bump Card */}
        <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Checkbox checked disabled className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Oferta Especial!</span>
                  <Badge variant="destructive" className="text-xs">-15%</Badge>
                </div>
                <p className="text-sm font-medium line-clamp-1">Produto Adicional Premium</p>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">Aproveite esta oferta exclusiva!</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground line-through">R$ 59,90</span>
                  <span className="text-sm font-bold text-primary">R$ 50,90</span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6 text-muted-foreground/50" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <p className="text-xs text-center text-muted-foreground">
          [Exemplo demonstrativo] Configure ofertas reais em{' '}
          <a href={ctaHref} className="text-primary underline hover:no-underline">
            Aumentar Ticket
          </a>
        </p>
      </section>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filter out products already in cart
  const cartProductIds = new Set(items.map(i => i.product_id));
  const availableProducts = products.filter(p => !cartProductIds.has(p.id));

  // No rule or no products
  if (!activeRule || availableProducts.length === 0) {
    if (!showWhenEmpty) return null;

    return (
      <section className="py-4">
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="p-4 text-center">
            <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <h3 className="font-semibold text-sm mb-1">Oferta no Checkout</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Configure ofertas de Order Bump para aumentar vendas no checkout.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={ctaHref}>
                <Settings className="h-4 w-4 mr-2" />
                {ctaLabel}
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  // Get discount label
  const discountLabel = activeRule.discount_type === 'percent'
    ? `-${activeRule.discount_value}%`
    : activeRule.discount_type === 'fixed' && activeRule.discount_value > 0
      ? `-${formatCurrency(activeRule.discount_value)}`
      : null;

  return (
    <section className="py-4 space-y-3">
      {availableProducts.slice(0, maxItems).map(product => {
        const finalPrice = getDiscountedPrice(product);
        const hasSavings = finalPrice < product.price;
        const isSelected = selectedBumps.has(product.id);

        return (
          <Card
            key={product.id}
            className={`overflow-hidden cursor-pointer transition-all ${
              isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-primary/30'
            } bg-gradient-to-r from-primary/5 to-transparent`}
            onClick={() => toggleBump(product.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox checked={isSelected} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{activeRule.title || 'Oferta Especial!'}</span>
                    {discountLabel && (
                      <Badge variant="destructive" className="text-xs">{discountLabel}</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium line-clamp-1">{product.name}</p>
                  {activeRule.description && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{activeRule.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {hasSavings && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                    <span className="text-sm font-bold text-primary">
                      {formatCurrency(finalPrice)}
                    </span>
                  </div>
                </div>
                {product.image_url && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
