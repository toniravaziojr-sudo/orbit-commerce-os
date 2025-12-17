// =============================================
// PRODUCT REVIEWS SECTION - Renders approved reviews on product page
// With customer-facing review form
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Star, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReviewForm } from './ReviewForm';

interface ProductReviewsSectionProps {
  productId: string;
  tenantId?: string;
}

export function ProductReviewsSection({ productId, tenantId }: ProductReviewsSectionProps) {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['product-reviews-public', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('id, customer_name, rating, title, content, created_at, is_verified_purchase, tenant_id')
        .eq('product_id', productId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId,
  });

  if (isLoading) {
    return null;
  }

  // Get tenant_id from first review if not provided
  const effectiveTenantId = tenantId || reviews?.[0]?.tenant_id;

  // Calculate average rating
  const avgRating = reviews?.length 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 0;

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="py-8 border-t" id="reviews-section">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Avaliações
        </h2>
        
        {reviews && reviews.length > 0 && (
          <div className="flex items-center gap-2">
            {renderStars(Math.round(avgRating))}
            <span className="text-sm text-muted-foreground">
              ({reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'})
            </span>
          </div>
        )}
      </div>
      
      {!reviews || reviews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
          <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Ainda não há avaliações para este produto.</p>
          <p className="text-sm mt-1">Seja o primeiro a avaliar!</p>
          
          {/* Review Form for empty state */}
          {effectiveTenantId && (
            <div className="mt-4 max-w-md mx-auto text-left">
              <ReviewForm 
                productId={productId} 
                tenantId={effectiveTenantId}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 bg-card border rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {renderStars(review.rating)}
                      {review.is_verified_purchase && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Compra verificada
                        </span>
                      )}
                    </div>
                    
                    {review.title && (
                      <h4 className="font-semibold text-sm">{review.title}</h4>
                    )}
                    
                    {review.content && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {review.content}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span className="font-medium">{review.customer_name}</span>
                  <span>•</span>
                  <span>
                    {format(new Date(review.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Review Form after existing reviews */}
          {effectiveTenantId && (
            <div className="mt-6">
              <ReviewForm 
                productId={productId} 
                tenantId={effectiveTenantId}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
