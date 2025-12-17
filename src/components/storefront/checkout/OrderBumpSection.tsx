// =============================================
// ORDER BUMP SECTION - Adds special offer to cart
// =============================================

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOffers } from '@/contexts/StorefrontConfigContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Gift } from 'lucide-react';

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
  const { config, isLoading: configLoading } = useOffers();
  const { items, addItem, removeItem } = useCart();
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const orderBumpConfig = config.orderBump;

  // Get order bump products
  const { data: products, isLoading } = useQuery({
    queryKey: ['order-bump-products', tenantId, orderBumpConfig.productIds],
    queryFn: async () => {
      if (!orderBumpConfig.enabled || orderBumpConfig.productIds.length === 0) {
        return [];
      }

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
        .in('id', orderBumpConfig.productIds)
        .limit(2);

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
    enabled: !!tenantId && orderBumpConfig.enabled && orderBumpConfig.productIds.length > 0,
  });

  // Sync checked state with cart on mount
  useEffect(() => {
    if (!products) return;
    
    const cartProductIds = new Set(items.map(i => i.product_id));
    const initialChecked = new Set<string>();
    
    products.forEach(p => {
      if (cartProductIds.has(p.id)) {
        initialChecked.add(p.id);
      }
    });
    
    // Check by default if configured
    if (orderBumpConfig.defaultChecked && initialChecked.size === 0) {
      products.forEach(p => {
        if (!cartProductIds.has(p.id)) {
          initialChecked.add(p.id);
          const discountedPrice = p.price * (1 - orderBumpConfig.discountPercent / 100);
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
  }, [products]);

  const handleToggle = (product: OrderBumpProduct, checked: boolean) => {
    const newChecked = new Set(checkedItems);
    
    if (checked) {
      newChecked.add(product.id);
      const discountedPrice = product.price * (1 - orderBumpConfig.discountPercent / 100);
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

  if (configLoading || isLoading) return null;
  if (!orderBumpConfig.enabled) return null;
  if (!products || products.length === 0) return null;

  return (
    <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{orderBumpConfig.title}</h3>
      </div>

      {orderBumpConfig.description && (
        <p className="text-sm text-muted-foreground mb-4">{orderBumpConfig.description}</p>
      )}

      <div className="space-y-3">
        {products.map(product => {
          const originalPrice = product.price;
          const discountedPrice = originalPrice * (1 - orderBumpConfig.discountPercent / 100);
          const isChecked = checkedItems.has(product.id);

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
                  <span className="text-sm text-muted-foreground line-through">
                    R$ {originalPrice.toFixed(2).replace('.', ',')}
                  </span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                    -{orderBumpConfig.discountPercent}%
                  </Badge>
                </div>
              </div>
            </Label>
          );
        })}
      </div>
    </div>
  );
}
