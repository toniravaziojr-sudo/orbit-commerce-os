// =============================================
// CROSS-SELL SLOT BLOCK - Cross-sell offers in Cart
// Source of truth: Aumentar Ticket (/offers) module
// Shows real offers when configured, or empty state with CTA
// NO DEMO DATA - preview via props only
// =============================================

import { ShoppingBag, Plus, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/cartTotals';
import { useCart } from '@/contexts/CartContext';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useActiveOfferRules, OfferRule } from '@/hooks/useOfferRules';
import { toast } from 'sonner';

interface CrossSellSlotBlockProps {
  title?: string;
  subtitle?: string;
  maxItems?: number;
  showWhenEmpty?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  isEditing?: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  sku: string;
  image_url?: string;
}

export function CrossSellSlotBlock({
  title = 'Você também pode gostar',
  subtitle,
  maxItems = 4,
  showWhenEmpty = true,
  ctaLabel = 'Configurar em Aumentar Ticket',
  ctaHref = '/offers',
  isEditing = false,
}: CrossSellSlotBlockProps) {
  const tenantSlug = useTenantSlug();
  const { items, addItem } = useCart();

  // Fetch active cross-sell rules
  const { data: crossSellRules = [], isLoading: rulesLoading } = useActiveOfferRules('cross_sell', tenantSlug || '');
  
  const activeRule: OfferRule | undefined = crossSellRules[0];

  // Fetch products from the suggested_product_ids
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['cross-sell-products', activeRule?.suggested_product_ids],
    queryFn: async () => {
      if (!activeRule?.suggested_product_ids?.length) return [];

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          price,
          sku,
          product_images(url, is_primary, sort_order)
        `)
        .in('id', activeRule.suggested_product_ids)
        .eq('status', 'active')
        .limit(maxItems);

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        sku: p.sku,
        image_url: p.product_images?.sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return (a.sort_order || 0) - (b.sort_order || 0);
        })[0]?.url,
      }));
    },
    enabled: !!activeRule?.suggested_product_ids?.length && !isEditing,
  });

  const isLoading = rulesLoading || productsLoading;

  // In editing mode, show empty state placeholder (no demo data)
  if (isEditing) {
    return (
      <section className="py-6">
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="p-6 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              [Slot de Cross-sell] Sugestões aparecem aqui quando configuradas em Aumentar Ticket.
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

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No rule or no products
  if (!activeRule || products.length === 0) {
    if (!showWhenEmpty) return null;

    return (
      <section className="py-6">
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="p-6 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Sugestões no Carrinho</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure ofertas de cross-sell para sugerir produtos complementares.
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

  // Filter out products already in cart
  const cartProductIds = new Set(items.map(i => i.product_id));
  const availableProducts = products.filter(p => !cartProductIds.has(p.id));

  if (availableProducts.length === 0) return null;

  const handleAddToCart = (product: Product) => {
    addItem({
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity: 1,
      image_url: product.image_url,
    });
    toast.success(`${product.name} adicionado ao carrinho`);
  };

  return (
    <section className="py-6">
      <h3 className="font-semibold text-lg mb-4">{activeRule.title || title}</h3>
      {(activeRule.description || subtitle) && (
        <p className="text-sm text-muted-foreground mb-4">{activeRule.description || subtitle}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {availableProducts.slice(0, maxItems).map(product => (
          <div
            key={product.id}
            className="border rounded-lg p-3 hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-muted rounded-md mb-2 overflow-hidden">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  Sem imagem
                </div>
              )}
            </div>
            <p className="text-sm font-medium line-clamp-2 mb-1">{product.name}</p>
            <p className="text-sm font-semibold mb-2">
              {formatCurrency(product.price)}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => handleAddToCart(product)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
