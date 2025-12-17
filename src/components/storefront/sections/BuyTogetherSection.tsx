// =============================================
// BUY TOGETHER SECTION - Renders "Compre Junto" on product page
// Shows: Current product + Suggested product with combined price
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicProductUrl } from '@/lib/publicUrls';
import { useCart } from '@/hooks/useCart';
import { toast } from 'sonner';
import { useState } from 'react';

interface BuyTogetherSectionProps {
  productId: string;
  tenantSlug: string;
  // Current product data for display
  currentProduct?: {
    id: string;
    name: string;
    price: number;
    compare_at_price?: number;
    sku: string;
    images?: { url: string; alt?: string }[];
  };
}

export function BuyTogetherSection({ productId, tenantSlug, currentProduct }: BuyTogetherSectionProps) {
  const { addItem } = useCart(tenantSlug);
  const [isAdding, setIsAdding] = useState(false);

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
          id, name, slug, sku, price, compare_at_price,
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

  if (isLoading || !rule || !rule.suggestedProduct || !currentProduct) {
    return null;
  }

  const suggestedProduct = rule.suggestedProduct;
  
  // Get primary images
  const currentProductImage = currentProduct.images?.[0]?.url;
  const suggestedProductImage = suggestedProduct.product_images?.find((img: any) => img.is_primary)?.url 
    || suggestedProduct.product_images?.[0]?.url;

  // Calculate prices
  const currentPrice = currentProduct.price;
  const suggestedOriginalPrice = suggestedProduct.price;
  
  // Apply discount to suggested product
  let suggestedDiscountedPrice = suggestedOriginalPrice;
  if (rule.discount_type === 'percentage' && rule.discount_value) {
    suggestedDiscountedPrice = suggestedOriginalPrice * (1 - rule.discount_value / 100);
  } else if (rule.discount_type === 'fixed' && rule.discount_value) {
    suggestedDiscountedPrice = suggestedOriginalPrice - rule.discount_value;
  }
  
  // Total prices
  const totalOriginal = currentPrice + suggestedOriginalPrice;
  const totalDiscounted = currentPrice + suggestedDiscountedPrice;
  const savings = totalOriginal - totalDiscounted;
  const hasDiscount = savings > 0;

  // Format price
  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Handle adding both items to cart
  const handleAddTogether = async () => {
    setIsAdding(true);
    try {
      // Add current product
      addItem({
        product_id: currentProduct.id,
        name: currentProduct.name,
        sku: currentProduct.sku,
        price: currentProduct.price,
        quantity: 1,
        image_url: currentProductImage,
      });

      // Add suggested product with discounted price
      addItem({
        product_id: suggestedProduct.id,
        name: suggestedProduct.name,
        sku: suggestedProduct.sku,
        price: suggestedDiscountedPrice,
        quantity: 1,
        image_url: suggestedProductImage,
      });

      toast.success('Produtos adicionados ao carrinho!');
    } catch (error) {
      toast.error('Erro ao adicionar produtos');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <section className="py-6 md:py-8">
      <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" />
        {rule.title || 'Compre junto e economize'}
      </h2>
      
      <div className="bg-muted/30 rounded-lg p-4 md:p-6">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center gap-6">
          {/* Current Product Card */}
          <div className="flex-1 flex items-center gap-4 p-4 bg-background rounded-lg border">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {currentProductImage ? (
                <img
                  src={currentProductImage}
                  alt={currentProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  Sem imagem
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium line-clamp-2 text-sm">{currentProduct.name}</p>
              <p className="text-primary font-bold text-lg mt-1">
                {formatPrice(currentPrice)}
              </p>
            </div>
          </div>

          {/* Plus Sign */}
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 flex-shrink-0">
            <Plus className="h-6 w-6 text-primary" />
          </div>

          {/* Suggested Product Card */}
          <div className="flex-1 flex items-center gap-4 p-4 bg-background rounded-lg border">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {suggestedProductImage ? (
                <img
                  src={suggestedProductImage}
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
                className="font-medium hover:underline line-clamp-2 text-sm"
              >
                {suggestedProduct.name}
              </a>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatPrice(suggestedOriginalPrice)}
                  </span>
                )}
                <span className="text-primary font-bold text-lg">
                  {formatPrice(suggestedDiscountedPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Price Summary & CTA */}
          <div className="flex flex-col items-center gap-2 pl-6 border-l border-border min-w-[180px]">
            {hasDiscount && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Preço Total:</p>
                <p className="text-sm text-muted-foreground line-through">
                  {formatPrice(totalOriginal)}
                </p>
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium">COMPRANDO JUNTO:</p>
              <p className="text-2xl font-bold text-primary">
                {formatPrice(totalDiscounted)}
              </p>
            </div>
            {hasDiscount && (
              <p className="text-sm text-green-600 font-medium">
                Economize {formatPrice(savings)}
              </p>
            )}
            <Button 
              onClick={handleAddTogether} 
              disabled={isAdding}
              className="w-full mt-2"
              size="lg"
            >
              {isAdding ? 'Adicionando...' : 'Adquirir oferta'}
            </Button>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="flex flex-col gap-4 md:hidden">
          {/* Current Product Card */}
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {currentProductImage ? (
                <img
                  src={currentProductImage}
                  alt={currentProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  Sem imagem
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium line-clamp-2 text-sm">{currentProduct.name}</p>
              <p className="text-primary font-bold mt-1">
                {formatPrice(currentPrice)}
              </p>
            </div>
          </div>

          {/* Plus Sign */}
          <div className="flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
          </div>

          {/* Suggested Product Card */}
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {suggestedProductImage ? (
                <img
                  src={suggestedProductImage}
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
                className="font-medium hover:underline line-clamp-2 text-sm"
              >
                {suggestedProduct.name}
              </a>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through">
                    {formatPrice(suggestedOriginalPrice)}
                  </span>
                )}
                <span className="text-primary font-bold">
                  {formatPrice(suggestedDiscountedPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Price Summary & CTA */}
          <div className="flex flex-col items-center gap-2 pt-4 border-t border-border">
            {hasDiscount && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Preço Total:</p>
                <p className="text-sm text-muted-foreground line-through">
                  {formatPrice(totalOriginal)}
                </p>
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-medium">COMPRANDO JUNTO:</p>
              <p className="text-2xl font-bold text-primary">
                {formatPrice(totalDiscounted)}
              </p>
            </div>
            {hasDiscount && (
              <p className="text-sm text-green-600 font-medium">
                Economize {formatPrice(savings)}
              </p>
            )}
            <Button 
              onClick={handleAddTogether} 
              disabled={isAdding}
              className="w-full mt-2"
              size="lg"
            >
              {isAdding ? 'Adicionando...' : 'Adquirir oferta'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
