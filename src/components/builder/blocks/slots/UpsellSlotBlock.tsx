// =============================================
// UPSELL SLOT BLOCK - Post-purchase upsell offers
// Source of truth: Aumentar Ticket (/offers) module
// Shows real offers when configured, or empty state with CTA
// Appears ONLY on Thank You page
// NO DEMO DATA - preview via props only
// =============================================

import { Gift, ShoppingCart, ArrowRight, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/cartTotals';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useActiveOfferRules, OfferRule } from '@/hooks/useOfferRules';
import { Link } from 'react-router-dom';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';

interface UpsellSlotBlockProps {
  title?: string;
  subtitle?: string;
  maxItems?: number;
  showWhenEmpty?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  isEditing?: boolean;
}

interface UpsellProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  slug: string;
}

export function UpsellSlotBlock({
  title = 'Oferta Especial para Você!',
  subtitle,
  maxItems = 4,
  showWhenEmpty = true,
  ctaLabel = 'Configurar em Aumentar Ticket',
  ctaHref = '/offers',
  isEditing = false,
}: UpsellSlotBlockProps) {
  const tenantSlug = useTenantSlug();
  const urls = useStorefrontUrls(tenantSlug);

  // Fetch active upsell rules
  const { data: upsellRules = [], isLoading: rulesLoading } = useActiveOfferRules('upsell', tenantSlug || '');

  const activeRule: OfferRule | undefined = upsellRules[0];

  // Fetch products from the suggested_product_ids
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['upsell-products', activeRule?.suggested_product_ids],
    queryFn: async () => {
      if (!activeRule?.suggested_product_ids?.length) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, compare_at_price, slug')
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
      })) as UpsellProduct[];
    },
    enabled: !!activeRule?.suggested_product_ids?.length && !isEditing,
  });

  const isLoading = rulesLoading || productsLoading;

  // Calculate discounts
  const getDiscountedPrice = (product: UpsellProduct) => {
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

  // In editing mode, show EXAMPLE CARD demonstration (visual preview)
  if (isEditing) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent my-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">{title}</h3>
            <Badge variant="destructive" className="ml-auto">-20%</Badge>
          </div>

          <p className="text-sm text-muted-foreground mb-4">Aproveite esta oferta exclusiva pós-compra!</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].slice(0, maxItems).map((i) => (
              <Card key={i} className="overflow-hidden h-full">
                <div className="aspect-square relative bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm line-clamp-2 mb-2 text-muted-foreground">
                    Produto Upsell {i}
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground line-through">
                      R$ {(99.90 + i * 20).toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-base font-bold text-primary">
                      R$ {((99.90 + i * 20) * 0.8).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <p className="text-xs text-center text-muted-foreground mt-4">
            [Exemplo demonstrativo] Configure ofertas reais em{' '}
            <a href={ctaHref} className="text-primary underline hover:no-underline">
              Aumentar Ticket
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No active upsell rule or no products
  if (!activeRule || products.length === 0) {
    if (!showWhenEmpty) return null;

    return (
      <Card className="border-dashed border-2 bg-muted/20 my-6">
        <CardContent className="p-6 text-center">
          <Gift className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Oferta Pós-Compra</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configure ofertas de upsell para aumentar vendas após a compra.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href={ctaHref}>
              <Settings className="h-4 w-4 mr-2" />
              {ctaLabel}
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Render real upsell offers
  const discountLabel = activeRule.discount_type === 'percent'
    ? `-${activeRule.discount_value}%`
    : activeRule.discount_type === 'fixed' && activeRule.discount_value > 0
      ? `-${formatCurrency(activeRule.discount_value)}`
      : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent my-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">
            {activeRule.title || title}
          </h3>
          {discountLabel && (
            <Badge variant="destructive" className="ml-auto">{discountLabel}</Badge>
          )}
        </div>

        {activeRule.description && (
          <p className="text-sm text-muted-foreground mb-4">
            {activeRule.description}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => {
            const finalPrice = getDiscountedPrice(product);
            const hasSavings = finalPrice < product.price;

            return (
              <Link
                key={product.id}
                to={urls.product(product.slug)}
                className="group block"
              >
                <Card className="overflow-hidden h-full transition-shadow hover:shadow-md">
                  <div className="aspect-square relative bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingCart className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-sm line-clamp-2 mb-2">
                      {product.name}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {hasSavings && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(product.price)}
                        </span>
                      )}
                      <span className="text-base font-bold text-primary">
                        {formatCurrency(finalPrice)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
