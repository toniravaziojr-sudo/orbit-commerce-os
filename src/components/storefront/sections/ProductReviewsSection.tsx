// =============================================
// PRODUCT REVIEWS SECTION - Renders approved reviews on product page
// With customer-facing review form and rating summary
// =============================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Star, MessageSquare, Play, X, CheckCircle2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReviewForm } from './ReviewForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ProductReviewsSectionProps {
  productId: string;
  tenantId?: string;
}

export function ProductReviewsSection({ productId, tenantId }: ProductReviewsSectionProps) {
  const [lightboxMedia, setLightboxMedia] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['product-reviews-public', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('id, customer_name, rating, title, content, created_at, is_verified_purchase, tenant_id, media_urls')
        .eq('product_id', productId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId,
  });

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov)$/i);
  };

  // Calculate rating distribution
  const ratingStats = useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    const total = reviews.length;
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / total;
    const distribution = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
      percent: (reviews.filter(r => r.rating === star).length / total) * 100,
    }));
    return { avg, total, distribution };
  }, [reviews]);

  if (isLoading) {
    return null;
  }

  const effectiveTenantId = tenantId || reviews?.[0]?.tenant_id;
  const visibleReviews = reviews?.slice(0, visibleCount) || [];
  const hasMore = (reviews?.length || 0) > visibleCount;

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const diff = rating - star + 1;
          let fillPercent = 0;
          if (diff >= 1) fillPercent = 100;
          else if (diff > 0) fillPercent = Math.round(diff * 100);

          return (
            <div key={star} className="relative">
              <Star className={cn(sizeClass, 'text-muted-foreground/20')} />
              {fillPercent > 0 && (
                <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
                  <Star className={cn(sizeClass, 'text-yellow-400 fill-yellow-400')} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="py-10 border-t" id="reviews-section">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="h-5 w-5 text-foreground" />
        <h2 className="text-xl font-bold">Avaliações</h2>
        {ratingStats && (
          <div className="flex items-center gap-1.5 ml-auto">
            {renderStars(ratingStats.avg, 'md')}
            <span className="text-sm text-muted-foreground">
              ({ratingStats.total} {ratingStats.total === 1 ? 'avaliação' : 'avaliações'})
            </span>
          </div>
        )}
      </div>

      {!reviews || reviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Ainda não há avaliações para este produto.</p>
          <p className="text-sm mt-1 mb-4">Seja o primeiro a avaliar!</p>
          
          {effectiveTenantId && (
            <div className="max-w-md mx-auto">
              <ReviewForm productId={productId} tenantId={effectiveTenantId} />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Rating Summary Bar */}
          {ratingStats && (
            <div className="flex flex-col sm:flex-row gap-6 mb-8 p-5 bg-muted/20 rounded-xl border">
              {/* Left: Big average */}
              <div className="flex flex-col items-center justify-center sm:min-w-[140px]">
                <span className="text-4xl font-bold tracking-tight">
                  {ratingStats.avg.toFixed(1).replace('.', ',')}
                </span>
                <div className="mt-1">{renderStars(ratingStats.avg, 'md')}</div>
                <span className="text-xs text-muted-foreground mt-1">
                  {ratingStats.total} {ratingStats.total === 1 ? 'avaliação' : 'avaliações'}
                </span>
              </div>

              {/* Right: Distribution bars */}
              <div className="flex-1 space-y-1.5">
                {ratingStats.distribution.map(({ star, count, percent }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs font-medium w-3 text-right">{star}</span>
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    <Progress value={percent} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {visibleReviews.map((review) => (
              <div
                key={review.id}
                className="p-5 bg-card border rounded-xl transition-shadow hover:shadow-sm"
              >
                {/* Stars row */}
                <div className="flex items-center gap-2 mb-2">
                  {renderStars(review.rating, 'sm')}
                </div>

                {/* Title */}
                {review.title && (
                  <h4 className="font-semibold text-sm mb-1">{review.title}</h4>
                )}

                {/* Content */}
                {review.content && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {review.content}
                  </p>
                )}

                {/* Media thumbnails */}
                {review.media_urls && review.media_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {review.media_urls.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => setLightboxMedia(url)}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                      >
                        {isVideo(url) ? (
                          <>
                            <video src={url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Play className="h-5 w-5 text-white fill-white" />
                            </div>
                          </>
                        ) : (
                          <img src={url} alt={`Mídia ${index + 1}`} className="w-full h-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Author info */}
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">{review.customer_name}</span>
                  <span>•</span>
                  <span>
                    {format(new Date(review.created_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </span>
                  {review.is_verified_purchase && (
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Compra verificada
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount(prev => prev + 5)}
                className="gap-1"
              >
                <ChevronDown className="h-4 w-4" />
                Ver mais avaliações
              </Button>
            </div>
          )}

          {/* Review Form */}
          {effectiveTenantId && (
            <div className="mt-8 flex justify-center">
              <ReviewForm productId={productId} tenantId={effectiveTenantId} />
            </div>
          )}
        </>
      )}

      {/* Media Lightbox */}
      <Dialog open={!!lightboxMedia} onOpenChange={() => setLightboxMedia(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <button
            onClick={() => setLightboxMedia(null)}
            className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxMedia && (
            isVideo(lightboxMedia) ? (
              <video src={lightboxMedia} controls autoPlay className="w-full max-h-[80vh] object-contain" />
            ) : (
              <img src={lightboxMedia} alt="Mídia da avaliação" className="w-full max-h-[80vh] object-contain" />
            )
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
