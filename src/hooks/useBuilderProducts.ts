// =============================================
// SHARED HOOK FOR BUILDER PRODUCT QUERIES
// Used by ProductGrid, ProductCarousel, FeaturedProducts
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BuilderProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  is_featured: boolean;
  product_images: { url: string; is_primary: boolean }[];
}

export type ProductSource = 'all' | 'featured' | 'category' | 'newest' | 'bestsellers';

interface UseBuilderProductsOptions {
  tenantSlug: string;
  tenantId?: string; // Optional: if provided, skips tenant lookup query
  source?: ProductSource;
  categoryId?: string;
  limit?: number;
  productIds?: string[]; // For fetching specific products by ID
}

/**
 * Fetches tenant ID from slug
 */
export function useTenantId(tenantSlug: string) {
  return useQuery({
    queryKey: ['tenant-by-slug', tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();
      if (error) throw error;
      return data?.id || null;
    },
    enabled: !!tenantSlug,
  });
}

/**
 * Shared hook for fetching products in builder blocks
 * Reused by ProductGrid, ProductCarousel, FeaturedProducts
 */
export function useBuilderProducts({
  tenantSlug,
  tenantId: providedTenantId,
  source = 'all',
  categoryId,
  limit = 8,
  productIds,
}: UseBuilderProductsOptions) {
  // Use provided tenantId if available, otherwise fetch from slug
  const { data: fetchedTenantId, isLoading: tenantLoading } = useTenantId(tenantSlug);
  const tenantId = providedTenantId || fetchedTenantId;

  // Determine if query should be enabled
  const hasProductIds = productIds && productIds.length > 0;
  const hasCategoryId = source === 'category' && !!categoryId;
  const isOtherSource = source !== 'category' || hasProductIds;
  const queryEnabled = !!tenantId && (isOtherSource || hasCategoryId);

  const productsQuery = useQuery({
    queryKey: ['builder-products', tenantId, source, categoryId, limit, productIds?.join(',')],
    queryFn: async () => {
      if (!tenantId) return [];

      // Priority 1: If productIds is provided, fetch those specific products
      if (hasProductIds) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, slug, price, compare_at_price, is_featured, product_images(url, is_primary)')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .in('id', productIds!);

        if (error) throw error;

        // Preserve order from productIds
        const productMap = new Map((data || []).map(p => [p.id, p]));
        const orderedProducts = productIds!
          .map(id => productMap.get(id))
          .filter(Boolean) as BuilderProduct[];

        return orderedProducts;
      }

      // Priority 2: Category source - needs join with product_categories
      if (source === 'category' && categoryId) {
        const { data: productCategories, error: pcError } = await supabase
          .from('product_categories')
          .select('product_id, position')
          .eq('category_id', categoryId)
          .order('position', { ascending: true });

        if (pcError) throw pcError;
        if (!productCategories?.length) return [];

        const productIdsList = productCategories.map(pc => pc.product_id);
        const positionMap = new Map(productCategories.map(pc => [pc.product_id, pc.position]));

        const { data: prods, error } = await supabase
          .from('products')
          .select('id, name, slug, price, compare_at_price, is_featured, product_images(url, is_primary)')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .in('id', productIdsList)
          .limit(limit);

        if (error) throw error;

        // Sort by position from product_categories
        const sortedProducts = (prods || []).sort((a, b) => {
          const posA = positionMap.get(a.id) ?? 999999;
          const posB = positionMap.get(b.id) ?? 999999;
          return posA - posB;
        });

        return sortedProducts as BuilderProduct[];
      }

      // Priority 3: All other sources (featured, newest, all)
      let query = supabase
        .from('products')
        .select('id, name, slug, price, compare_at_price, is_featured, product_images(url, is_primary)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .limit(limit);

      if (source === 'featured') {
        query = query.eq('is_featured', true);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BuilderProduct[];
    },
    enabled: queryEnabled,
    staleTime: 0, // Always refetch on key change
  });

  return {
    products: productsQuery.data || [],
    isLoading: tenantLoading || productsQuery.isLoading,
    error: productsQuery.error,
    tenantId,
  };
}

// Helper functions
export function getProductImage(product: BuilderProduct): string {
  const primary = product.product_images?.find(img => img.is_primary);
  return primary?.url || product.product_images?.[0]?.url || '/placeholder.svg';
}

export function formatProductPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
}
