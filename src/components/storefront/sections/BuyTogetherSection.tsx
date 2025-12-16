// =============================================
// BUY TOGETHER SECTION - Renders "Compre Junto" on product page
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicProductUrl } from '@/lib/publicUrls';

interface BuyTogetherSectionProps {
  productId: string;
  tenantSlug: string;
}

export function BuyTogetherSection({ productId, tenantSlug }: BuyTogetherSectionProps) {
  const { data: rule, isLoading } = useQuery({
    queryKey: ['buy-together-rule', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buy_together_rules')
        .select(`
          id,
          title,
          discount_type,
          discount_value,
          suggested_product_id
        `)
        .eq('trigger_product_id', productId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !data) return null;
      
      // Fetch suggested product
      const { data: suggestedProduct, error: productError } = await supabase
        .from('products')
        .select(`
          id, name, slug, price, compare_at_price,
          product_images (url, is_primary, sort_order)
        `)
        .eq('id', data.suggested_product_id)
        .eq('status', 'active')
        .single();
      
      if (productError || !suggestedProduct) return null;
      
      return {
        ...data,
        suggestedProduct,
      };
    },
    enabled: !!productId,
  });

  if (isLoading || !rule || !rule.suggestedProduct) {
    return null;
  }

  const suggestedProduct = rule.suggestedProduct;
  const primaryImage = suggestedProduct.product_images?.find((img: any) => img.is_primary) 
    || suggestedProduct.product_images?.[0];

  // Calculate discount
  const originalPrice = suggestedProduct.price;
  let discountedPrice = originalPrice;
  
  if (rule.discount_type === 'percentage' && rule.discount_value) {
    discountedPrice = originalPrice * (1 - rule.discount_value / 100);
  } else if (rule.discount_type === 'fixed' && rule.discount_value) {
    discountedPrice = originalPrice - rule.discount_value;
  }
  
  const hasDiscount = discountedPrice < originalPrice;

  return (
    <section className="py-8 border-t">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" />
        {rule.title || 'Compre Junto'}
      </h2>
      
      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-muted/30 rounded-lg">
        {/* Suggested product */}
        <div className="flex items-center gap-3 flex-1">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {primaryImage?.url ? (
              <img
                src={primaryImage.url}
                alt={suggestedProduct.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                Sem imagem
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <a 
              href={getPublicProductUrl(tenantSlug, suggestedProduct.slug) || '#'}
              className="font-medium hover:underline line-clamp-2"
            >
              {suggestedProduct.name}
            </a>
            <div className="flex items-center gap-2 mt-1">
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
                  R$ {originalPrice.toFixed(2).replace('.', ',')}
                </span>
              )}
              <span className="font-bold text-primary">
                R$ {discountedPrice.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        </div>

        {/* Plus icon */}
        <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
          <Plus className="h-4 w-4 text-primary" />
        </div>

        {/* Add button */}
        <Button className="w-full sm:w-auto">
          Adicionar Juntos
        </Button>
      </div>
    </section>
  );
}
