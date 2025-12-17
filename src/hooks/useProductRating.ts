// =============================================
// USE PRODUCT RATING - Hook to fetch product rating stats
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProductRating {
  average: number;
  count: number;
}

/**
 * Fetch rating stats for a single product
 */
export function useProductRating(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-rating', productId],
    queryFn: async (): Promise<ProductRating> => {
      if (!productId) return { average: 0, count: 0 };

      const { data, error } = await supabase
        .from('product_reviews')
        .select('rating')
        .eq('product_id', productId)
        .eq('status', 'approved');

      if (error) throw error;

      if (!data || data.length === 0) {
        return { average: 0, count: 0 };
      }

      const sum = data.reduce((acc, review) => acc + review.rating, 0);
      const average = sum / data.length;

      return {
        average: Math.round(average * 10) / 10, // Round to 1 decimal
        count: data.length,
      };
    },
    enabled: !!productId,
    staleTime: 30000, // Cache for 30 seconds
  });
}

/**
 * Fetch rating stats for multiple products at once (batch)
 */
export function useProductRatings(productIds: string[]) {
  return useQuery({
    queryKey: ['product-ratings-batch', productIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, ProductRating>> => {
      if (!productIds.length) return new Map();

      const { data, error } = await supabase
        .from('product_reviews')
        .select('product_id, rating')
        .in('product_id', productIds)
        .eq('status', 'approved');

      if (error) throw error;

      // Group by product_id and calculate stats
      const ratingsMap = new Map<string, ProductRating>();
      
      // Initialize all products with zero ratings
      productIds.forEach(id => {
        ratingsMap.set(id, { average: 0, count: 0 });
      });

      if (data && data.length > 0) {
        // Group reviews by product
        const groupedReviews = data.reduce((acc, review) => {
          if (!acc[review.product_id]) {
            acc[review.product_id] = [];
          }
          acc[review.product_id].push(review.rating);
          return acc;
        }, {} as Record<string, number[]>);

        // Calculate average for each product
        Object.entries(groupedReviews).forEach(([productId, ratings]) => {
          const sum = ratings.reduce((a, b) => a + b, 0);
          const average = sum / ratings.length;
          ratingsMap.set(productId, {
            average: Math.round(average * 10) / 10,
            count: ratings.length,
          });
        });
      }

      return ratingsMap;
    },
    enabled: productIds.length > 0,
    staleTime: 30000,
  });
}
