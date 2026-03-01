// =============================================
// RELATED PRODUCTS SECTION - Renders related products as a horizontal slider
// Uses shared ProductCard to respect categorySettings from theme
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPublicProductUrl } from '@/lib/publicUrls';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { ProductCard, formatPrice, getProductImage } from '@/components/builder/blocks/shared/ProductCard';
import { useProductRatings } from '@/hooks/useProductRating';
import { useProductBadgesForProducts } from '@/hooks/useProductBadges';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { useState, useCallback, useMemo } from 'react';
import type { CategorySettings } from '@/hooks/usePageSettings';

interface RelatedProductsSectionProps {
  productId: string;
  tenantSlug: string;
  isEditing?: boolean;
  title?: string;
  categorySettings?: Partial<CategorySettings>;
}

export function RelatedProductsSection({ 
  productId, 
  tenantSlug, 
  isEditing = false, 
  title = 'Produtos Relacionados',
  categorySettings = {},
}: RelatedProductsSectionProps) {
  const { data: relatedProducts, isLoading } = useQuery({
    queryKey: ['related-products-public', productId],
    queryFn: async () => {
      const { data: relations, error: relError } = await supabase
        .from('related_products')
        .select('related_product_id, position')
        .eq('product_id', productId)
        .order('position');
      
      if (relError || !relations?.length) return [];
      
      const relatedIds = relations.map(r => r.related_product_id);
      
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select(`
          id, name, slug, price, compare_at_price,
          product_images (url, is_primary, sort_order)
        `)
        .in('id', relatedIds)
        .eq('status', 'active');
      
      if (prodError || !products) return [];
      
      return relatedIds
        .map(id => products.find(p => p.id === id))
        .filter(Boolean);
    },
    enabled: !!productId,
  });

  // Batch fetch ratings and badges
  const productIds = useMemo(() => relatedProducts?.map((p: any) => p.id) || [], [relatedProducts]);
  const { data: ratingsMap } = useProductRatings(productIds);
  const { data: badgesMap } = useProductBadgesForProducts(productIds);

  // Cart
  const { addItem: addToCart } = useCart();
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  const handleAddToCart = useCallback((e: React.MouseEvent, product: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;
    
    const primaryImage = product.product_images?.find((img: any) => img.is_primary)?.url || product.product_images?.[0]?.url;
    
    addToCart({
      product_id: product.id,
      name: product.name,
      sku: product.slug,
      price: product.price,
      quantity: 1,
      image_url: primaryImage,
    });
    
    setAddedProducts(prev => new Set(prev).add(product.id));
    toast.success('Produto adicionado ao carrinho!');
    
    setTimeout(() => {
      setAddedProducts(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  }, [addToCart, isEditing]);

  if (isLoading || !relatedProducts?.length) {
    if (isEditing) {
      return (
        <section className="py-8 border-t">
          <h2 className="text-xl font-bold mb-6">{title}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card rounded-lg overflow-hidden border">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">Produto {i}</span>
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm">Produto Exemplo {i}</p>
                  <p className="font-bold mt-1 sf-price-color" style={{ color: 'var(--theme-price-color, var(--theme-text-primary, currentColor))' }}>R$ 99,90</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground mt-4">
            [Exemplo demonstrativo] Configure produtos relacionados no painel de cada produto
          </p>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="py-8 border-t">
      <h2 className="text-xl font-bold mb-6">{title}</h2>
      
      <Carousel
        opts={{
          align: 'start',
          loop: relatedProducts.length > 2,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {relatedProducts.map((product: any) => {
            const rating = ratingsMap?.get(product.id);
            const badges = badgesMap?.get(product.id);
            
            return (
              <CarouselItem
                key={product.id}
                className="pl-3 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
              >
                <ProductCard
                  product={product}
                  tenantSlug={tenantSlug}
                  isEditing={isEditing}
                  settings={categorySettings}
                  rating={rating}
                  badges={badges}
                  isAddedToCart={addedProducts.has(product.id)}
                  onAddToCart={handleAddToCart}
                  variant="compact"
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>
        {relatedProducts.length > 2 && (
          <>
            <CarouselPrevious className="hidden md:flex -left-4" />
            <CarouselNext className="hidden md:flex -right-4" />
          </>
        )}
      </Carousel>
    </section>
  );
}
