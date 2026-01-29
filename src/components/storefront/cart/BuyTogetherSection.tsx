// =============================================
// BUY TOGETHER SECTION - Contextual product combinations
// =============================================

import { useQuery } from '@tanstack/react-query';
import { useOffers } from '@/contexts/StorefrontConfigContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface BuyTogetherRule {
  id: string;
  title: string;
  trigger_product: {
    id: string;
    name: string;
    price: number;
    sku: string;
    image_url?: string;
  };
  suggested_product: {
    id: string;
    name: string;
    price: number;
    sku: string;
    image_url?: string;
  };
  discount_type: string | null;
  discount_value: number | null;
}

export function BuyTogetherSection({ tenantId }: { tenantId: string }) {
  const { config, isLoading: configLoading } = useOffers();
  const { items, addItem } = useCart();

  const buyTogetherConfig = config.buyTogether;

  // Get buy together rules based on cart items
  const cartProductIds = items.map(i => i.product_id);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['buy-together-rules', tenantId, cartProductIds],
    queryFn: async () => {
      if (!buyTogetherConfig.enabled || !buyTogetherConfig.useExistingRules || cartProductIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('buy_together_rules')
        .select(`
          id,
          title,
          discount_type,
          discount_value,
          trigger_product:products!buy_together_rules_trigger_product_id_fkey(
            id, name, price, sku,
            product_images(url, is_primary, sort_order)
          ),
          suggested_product:products!buy_together_rules_suggested_product_id_fkey(
            id, name, price, sku,
            product_images(url, is_primary, sort_order)
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('trigger_product_id', cartProductIds);

      if (error) throw error;

      return (data || []).map(rule => ({
        id: rule.id,
        title: rule.title,
        discount_type: rule.discount_type,
        discount_value: rule.discount_value,
        trigger_product: {
          id: (rule.trigger_product as any)?.id,
          name: (rule.trigger_product as any)?.name,
          price: (rule.trigger_product as any)?.price,
          sku: (rule.trigger_product as any)?.sku,
          image_url: (rule.trigger_product as any)?.product_images?.sort((a: any, b: any) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return (a.sort_order || 0) - (b.sort_order || 0);
          })[0]?.url,
        },
        suggested_product: {
          id: (rule.suggested_product as any)?.id,
          name: (rule.suggested_product as any)?.name,
          price: (rule.suggested_product as any)?.price,
          sku: (rule.suggested_product as any)?.sku,
          image_url: (rule.suggested_product as any)?.product_images?.sort((a: any, b: any) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return (a.sort_order || 0) - (b.sort_order || 0);
          })[0]?.url,
        },
      })) as BuyTogetherRule[];
    },
    enabled: !!tenantId && buyTogetherConfig.enabled && buyTogetherConfig.useExistingRules && cartProductIds.length > 0,
  });

  if (configLoading || isLoading) return null;
  if (!buyTogetherConfig.enabled) return null;
  if (!rules || rules.length === 0) return null;

  // Filter out rules where suggested product is already in cart
  const availableRules = rules.filter(
    rule => !cartProductIds.includes(rule.suggested_product.id)
  );

  if (availableRules.length === 0) return null;

  const handleAddSuggested = (rule: BuyTogetherRule) => {
    let price = rule.suggested_product.price;
    
    // Apply discount if configured
    if (rule.discount_type === 'percentage' && rule.discount_value) {
      price = price * (1 - rule.discount_value / 100);
    } else if (rule.discount_type === 'fixed' && rule.discount_value) {
      price = Math.max(0, price - rule.discount_value);
    }

    addItem({
      product_id: rule.suggested_product.id,
      name: rule.suggested_product.name,
      sku: rule.suggested_product.sku,
      price: price,
      quantity: 1,
      image_url: rule.suggested_product.image_url,
    });
    toast.success(`${rule.suggested_product.name} adicionado ao carrinho`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-lg">Compre junto</h3>
      </div>
      
      <div className="space-y-3">
        {availableRules.slice(0, 3).map(rule => {
          const hasDiscount = rule.discount_type && rule.discount_value;
          let discountedPrice = rule.suggested_product.price;
          
          if (rule.discount_type === 'percentage' && rule.discount_value) {
            discountedPrice = rule.suggested_product.price * (1 - rule.discount_value / 100);
          } else if (rule.discount_type === 'fixed' && rule.discount_value) {
            discountedPrice = Math.max(0, rule.suggested_product.price - rule.discount_value);
          }

          return (
            <div 
              key={rule.id}
              className="flex items-center gap-4 p-3 border rounded-lg"
            >
              <div className="w-16 h-16 bg-muted rounded-md overflow-hidden shrink-0">
                {rule.suggested_product.image_url ? (
                  <img 
                    src={rule.suggested_product.image_url} 
                    alt={rule.suggested_product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Sem img
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-1">{rule.suggested_product.name}</p>
                {rule.title && (
                  <p className="text-sm text-muted-foreground">{rule.title}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-semibold">
                    R$ {discountedPrice.toFixed(2).replace('.', ',')}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-sm text-muted-foreground line-through">
                        R$ {rule.suggested_product.price.toFixed(2).replace('.', ',')}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--theme-accent-color, #22c55e) 15%, transparent)',
                          color: 'var(--theme-accent-color, #22c55e)',
                        }}
                      >
                        -{rule.discount_type === 'percentage' ? `${rule.discount_value}%` : `R$ ${rule.discount_value}`}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleAddSuggested(rule)}
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
