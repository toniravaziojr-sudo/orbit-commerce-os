import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter';
import { Loader2, Search, ArrowLeft } from 'lucide-react';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { getLogoImageUrl } from '@/lib/imageTransform';

function usePublicSearchProducts(tenantId: string | undefined, query: string) {
  return useQuery({
    queryKey: ['public-search-products', tenantId, query],
    queryFn: async () => {
      if (!tenantId || !query.trim()) return [];
      const searchTerm = query.trim();
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, price, compare_at_price, product_images(url, position)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .ilike('name', `%${searchTerm}%`)
        .order('name')
        .limit(60);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!query.trim(),
    staleTime: 30 * 1000,
  });
}

export default function StorefrontSearch() {
  const tenantSlug = useTenantSlug();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const basePath = getStoreBaseUrl(tenantSlug || '');

  const { tenant, storeSettings } = usePublicStorefront(tenantSlug || '');
  const { data: products, isLoading } = usePublicSearchProducts(tenant?.id, query);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  return (
    <>
      <StorefrontHeader />
      <div className="min-h-[60vh] px-4 py-8 max-w-6xl mx-auto">
        {/* Back + Title */}
        <div className="mb-6">
          <Link to={basePath || '/'} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            {query ? (
              <>Resultados para "<span className="text-primary">{query}</span>"</>
            ) : (
              'Busca'
            )}
          </h1>
          {!isLoading && products && (
            <p className="text-sm text-muted-foreground mt-1">
              {products.length === 0 ? 'Nenhum produto encontrado' : `${products.length} produto${products.length !== 1 ? 's' : ''} encontrado${products.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && products?.length === 0 && query && (
          <div className="text-center py-16">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Nenhum produto encontrado para "{query}"</p>
            <p className="text-sm text-gray-400">Tente buscar por outro termo</p>
          </div>
        )}

        {/* Product grid */}
        {!isLoading && products && products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => {
              const imageUrl = product.product_images
                ?.sort((a: any, b: any) => (a.position || 0) - (b.position || 0))?.[0]?.url;
              const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;

              return (
                <Link
                  key={product.id}
                  to={`${basePath}/p/${product.slug}`}
                  className="group block border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={getLogoImageUrl(imageUrl, 400)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Search className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">{product.name}</h3>
                    <div className="flex items-center gap-2">
                      {hasDiscount && (
                        <span className="text-xs text-gray-400 line-through">
                          {formatPrice(product.compare_at_price!)}
                        </span>
                      )}
                      <span className="text-sm font-bold text-gray-900">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <StorefrontFooter />
    </>
  );
}
