// =============================================
// RELATED PRODUCTS SECTION - Renders related products on product page
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link2 } from 'lucide-react';

interface RelatedProductsSectionProps {
  productId: string;
  tenantSlug: string;
}

export function RelatedProductsSection({ productId, tenantSlug }: RelatedProductsSectionProps) {
  const { data: relatedProducts, isLoading } = useQuery({
    queryKey: ['related-products-public', productId],
    queryFn: async () => {
      // First get related product IDs
      const { data: relations, error: relError } = await supabase
        .from('related_products')
        .select('related_product_id, position')
        .eq('product_id', productId)
        .order('position');
      
      if (relError || !relations?.length) return [];
      
      const relatedIds = relations.map(r => r.related_product_id);
      
      // Fetch related products
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select(`
          id, name, slug, price, compare_at_price,
          product_images (url, is_primary, sort_order)
        `)
        .in('id', relatedIds)
        .eq('status', 'active');
      
      if (prodError || !products) return [];
      
      // Sort by original position
      return relatedIds
        .map(id => products.find(p => p.id === id))
        .filter(Boolean);
    },
    enabled: !!productId,
  });

  if (isLoading || !relatedProducts?.length) {
    return null;
  }

  return (
    <section className="py-8 border-t">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Link2 className="h-5 w-5" />
        Produtos Relacionados
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {relatedProducts.map((product: any) => {
          const primaryImage = product.product_images?.find((img: any) => img.is_primary)
            || product.product_images?.[0];
          const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
          
          return (
            <a
              key={product.id}
              href={`/store/${tenantSlug}/product/${product.slug}`}
              className="group block bg-card rounded-lg overflow-hidden border hover:border-primary/50 transition-colors"
            >
              {/* Image */}
              <div className="aspect-square bg-muted overflow-hidden">
                {primaryImage?.url ? (
                  <img
                    src={primaryImage.url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Sem imagem
                  </div>
                )}
              </div>
              
              {/* Info */}
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
          );
        })}
      </div>
    </section>
  );
}
