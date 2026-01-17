// =============================================
// ORDER BUMP SECTION - Adds special offer to cart
// UNIFICADO: Usa offer_rules via useActiveOfferRules
// =============================================

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveOfferRules, OfferRule } from '@/hooks/useOfferRules';
import { useCart } from '@/contexts/CartContext';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Gift, Loader2 } from 'lucide-react';

interface OrderBumpProduct {
  id: string;
  name: string;
  price: number;
  sku: string;
  image_url?: string;
}

interface OrderBumpSectionProps {
  tenantId: string;
  disabled?: boolean;
}

export function OrderBumpSection({ tenantId, disabled = false }: OrderBumpSectionProps) {
  const tenantSlug = useTenantSlug();
  const { items, addItem, removeItem } = useCart();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Fetch active order bump rules from offer_rules table
  const { data: orderBumpRules = [], isLoading: rulesLoading } = useActiveOfferRules(
    'order_bump',
    tenantSlug || ''
  );

  // Get the first active rule (highest priority)
  const activeRule: OfferRule | undefined = orderBumpRules[0];

  // Fetch products from the suggested_product_ids
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['order-bump-products', tenantId, activeRule?.suggested_product_ids],
    queryFn: async () => {
      if (!activeRule?.suggested_product_ids?.length) return [];

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          sku,
          product_images(url, is_primary, sort_order)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .in('id', activeRule.suggested_product_ids)
        .limit(activeRule.max_items || 2);

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        sku: p.sku,
        image_url: p.product_images?.sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return (a.sort_order || 0) - (b.sort_order || 0);
        })[0]?.url,
      })) as OrderBumpProduct[];
    },
    enabled: !!tenantId && !!activeRule?.suggested_product_ids?.length,
  });

  const isLoading = rulesLoading || productsLoading;

  // Calculate discounted price based on rule
  const getDiscountedPrice = (product: OrderBumpProduct): number => {
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

  // Sync checked state with cart on mount and handle default_checked
  useEffect(() => {
    if (!products.length || initialized) return;

    const cartProductIds = new Set(items.map(i => i.product_id));
    const initialChecked = new Set<string>();

    products.forEach(p => {
      if (cartProductIds.has(p.id)) {
        initialChecked.add(p.id);
      }
    });

    // Auto-add if default_checked is true and product not in cart
    if (activeRule?.default_checked && initialChecked.size === 0) {
      products.forEach(p => {
        if (!cartProductIds.has(p.id)) {
          initialChecked.add(p.id);
          const discountedPrice = getDiscountedPrice(p);
          addItem({
            product_id: p.id,
            name: p.name,
            sku: p.sku,
            price: discountedPrice,
            quantity: 1,
            image_url: p.image_url,
          });
        }
      });
    }

    setCheckedItems(initialChecked);
    setInitialized(true);
  }, [products, activeRule, initialized]);

  const handleToggle = (product: OrderBumpProduct, checked: boolean) => {
    const newChecked = new Set(checkedItems);

    if (checked) {
      newChecked.add(product.id);
      const discountedPrice = getDiscountedPrice(product);
      addItem({
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        price: discountedPrice,
        quantity: 1,
        image_url: product.image_url,
      });
    } else {
      newChecked.delete(product.id);
      const cartItem = items.find(i => i.product_id === product.id);
      if (cartItem) {
        removeItem(cartItem.id);
      }
    }

    setCheckedItems(newChecked);
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

  // Discount label for badge
  const discountLabel = activeRule.discount_type === 'percent' && activeRule.discount_value > 0
    ? `-${activeRule.discount_value}%`
    : activeRule.discount_type === 'fixed' && activeRule.discount_value > 0
    ? `-R$ ${activeRule.discount_value.toFixed(2)}`
    : null;

  return (
    <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{activeRule.title || 'Oferta Especial!'}</h3>
        {discountLabel && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs ml-auto">
            {discountLabel}
          </Badge>
        )}
      </div>

      {activeRule.description && (
        <p className="text-sm text-muted-foreground mb-4">{activeRule.description}</p>
      )}

      <div className="space-y-3">
        {products.map(product => {
          const originalPrice = product.price;
          const discountedPrice = getDiscountedPrice(product);
          const isChecked = checkedItems.has(product.id);
          const hasSavings = discountedPrice < originalPrice;

          return (
            <Label
              key={product.id}
              htmlFor={`order-bump-${product.id}`}
              className="flex items-center gap-4 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <Checkbox
                id={`order-bump-${product.id}`}
                checked={isChecked}
                onCheckedChange={(checked) => handleToggle(product, !!checked)}
                disabled={disabled}
              />

              <div className="w-12 h-12 bg-muted rounded-md overflow-hidden shrink-0">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-1">{product.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-semibold text-primary">
                    R$ {discountedPrice.toFixed(2).replace('.', ',')}
                  </span>
                  {hasSavings && (
                    <>
                      <span className="text-sm text-muted-foreground line-through">
                        R$ {originalPrice.toFixed(2).replace('.', ',')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Label>
          );
        })}
      </div>
    </div>
  );
}
