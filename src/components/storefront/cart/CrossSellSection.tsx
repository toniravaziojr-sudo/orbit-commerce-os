// =============================================
// CROSS-SELL SECTION - Product recommendations in cart
// UNIFICADO: Usa offer_rules via query direta com tenant_id
// =============================================

import { useQuery } from '@tanstack/react-query';
import { OfferRule } from '@/hooks/useOfferRules';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  sku: string;
  image_url?: string;
}

interface CrossSellSectionProps {
  tenantId: string;
}

export function CrossSellSection({ tenantId }: CrossSellSectionProps) {
  const { items, addItem } = useCart();

  // Fetch active cross-sell rules from offer_rules table using tenantId directly
  const { data: crossSellRules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['cross-sell-rules', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('offer_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('type', 'cross_sell')
        .eq('is_active', true)
        .order('priority', { ascending: true });
      
      if (error) throw error;
      return data as OfferRule[];
    },
    enabled: !!tenantId,
  });

  // Get the first active rule (highest priority)
  const activeRule: OfferRule | undefined = crossSellRules[0];

  // Fetch products from the suggested_product_ids
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['cross-sell-products', tenantId, activeRule?.suggested_product_ids],
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
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .in('id', activeRule.suggested_product_ids)
        .limit(activeRule.max_items || 4);

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
      })) as Product[];
    },
    enabled: !!tenantId && !!activeRule?.suggested_product_ids?.length,
  });

  const isLoading = rulesLoading || productsLoading;

  // Calculate discounted price based on rule
  const getDiscountedPrice = (product: Product): number => {
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No active rule or no products - don't render
  if (!activeRule || products.length === 0) return null;

  // Filter out products already in cart
  const cartProductIds = new Set(items.map(i => i.product_id));
  const availableProducts = products.filter(p => !cartProductIds.has(p.id));

  if (availableProducts.length === 0) return null;

  const handleAddToCart = (product: Product) => {
    const finalPrice = getDiscountedPrice(product);
    addItem({
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      price: finalPrice,
      quantity: 1,
      image_url: product.image_url,
    });
    toast.success(`${product.name} adicionado ao carrinho`);
  };

  // Discount label for badge
  const discountLabel = activeRule.discount_type === 'percent' && activeRule.discount_value > 0
    ? `-${activeRule.discount_value}%`
    : activeRule.discount_type === 'fixed' && activeRule.discount_value > 0
    ? `-R$ ${activeRule.discount_value.toFixed(2)}`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-lg">
          {activeRule.title || 'Você também pode gostar'}
        </h3>
        {discountLabel && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
            {discountLabel}
          </Badge>
        )}
      </div>

      {activeRule.description && (
        <p className="text-sm text-muted-foreground">{activeRule.description}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {availableProducts.slice(0, activeRule.max_items || 4).map(product => {
          const finalPrice = getDiscountedPrice(product);
          const hasSavings = finalPrice < product.price;

          return (
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
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                <span className="text-sm font-semibold">
                  R$ {finalPrice.toFixed(2).replace('.', ',')}
                </span>
                {hasSavings && (
                  <span className="text-xs text-muted-foreground line-through">
                    R$ {product.price.toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>
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
          );
        })}
      </div>
    </div>
  );
}
