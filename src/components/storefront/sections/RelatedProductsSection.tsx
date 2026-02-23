// =============================================
// RELATED PRODUCTS SECTION - Renders related products as a horizontal slider
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

interface RelatedProductsSectionProps {
  productId: string;
  tenantSlug: string;
  isEditing?: boolean;
  title?: string;
}

export function RelatedProductsSection({ productId, tenantSlug, isEditing = false, title = 'Produtos Relacionados' }: RelatedProductsSectionProps) {
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
                  <p className="font-bold text-primary mt-1">R$ 99,90</p>
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
            const primaryImage = product.product_images?.find((img: any) => img.is_primary)
              || product.product_images?.[0];
            const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
            
            return (
              <CarouselItem
                key={product.id}
                className="pl-3 basis-1/2 sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
              >
                <a
                  href={getPublicProductUrl(tenantSlug, product.slug) || '#'}
                  className="group block bg-card rounded-lg overflow-hidden border hover:border-primary/50 transition-colors h-full"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {primaryImage?.url ? (
                      <img
                        src={primaryImage.url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        Sem imagem
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <div className="mt-2">
                      {hasDiscount && (
                        <span className="text-xs text-muted-foreground line-through mr-2">
                          R$ {product.compare_at_price.toFixed(2).replace('.', ',')}
                        </span>
                      )}
                      <span className="font-bold text-primary">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </a>
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
