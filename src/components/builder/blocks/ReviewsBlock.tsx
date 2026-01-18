// =============================================
// REVIEWS BLOCK - Customer reviews/testimonials with stars
// =============================================

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Star, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';
import { useIsMobile } from '@/hooks/use-mobile';
import useEmblaCarousel from 'embla-carousel-react';

interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  text: string;
  productName?: string;
  productUrl?: string;
  productImage?: string;
}

interface ReviewsBlockProps {
  title?: string;
  reviews?: ReviewItem[];
  visibleCount?: number;
  context?: BlockRenderContext;
}

const defaultReviews: ReviewItem[] = [
  {
    id: '1',
    name: 'Maria Silva',
    rating: 5,
    text: 'Esse é um texto exemplo de uma avaliação de produto.',
    productName: 'Produto exemplo',
  },
  {
    id: '2',
    name: 'João Santos',
    rating: 5,
    text: 'Esse é um texto exemplo de uma avaliação de produto.',
    productName: 'Produto exemplo',
  },
  {
    id: '3',
    name: 'Ana Costa',
    rating: 5,
    text: 'Esse é um texto exemplo de uma avaliação de produto.',
    productName: 'Produto exemplo',
  },
  {
    id: '4',
    name: 'Pedro Lima',
    rating: 5,
    text: 'Esse é um texto exemplo de uma avaliação de produto.',
    productName: 'Produto exemplo',
  },
];

export function ReviewsBlock({
  title = 'O que nossos clientes dizem',
  reviews,
  visibleCount = 4,
  context,
  isEditing = false,
}: ReviewsBlockProps & { isEditing?: boolean }) {
  // Hook must be called unconditionally
  const isMobileDevice = useIsMobile();
  
  // Determine if mobile based on builder context or device detection
  const isMobile = context?.viewport === 'mobile' || 
    (context?.viewport === undefined && isMobileDevice);
  
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    slidesToScroll: isMobile ? 1 : 4,
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // IMPORTANT: Demo reviews should ONLY appear in builder/editor mode
  // In public storefront, show nothing if no real reviews exist
  const hasRealReviews = reviews && reviews.length > 0;
  const displayReviews = hasRealReviews ? reviews : (isEditing ? defaultReviews : []);
  const isUsingDemo = !hasRealReviews && isEditing;

  // Don't render anything in public mode if no real reviews
  if (displayReviews.length === 0) {
    return null;
  }

  const actualReviews = displayReviews.slice(0, visibleCount);

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-4 w-4',
            star <= rating 
              ? 'fill-amber-400 text-amber-400' 
              : 'fill-muted text-muted'
          )}
        />
      ))}
    </div>
  );

  return (
    <section className="py-8 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4">
        {title && (
          <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>
        )}

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4">
              {actualReviews.map((review) => (
                <div
                  key={review.id}
                  className={cn(
                    'flex-shrink-0 bg-background rounded-lg p-6 shadow-sm',
                    isMobile ? 'w-[calc(100%-16px)]' : 'w-[calc(25%-12px)]'
                  )}
                >
                  {renderStars(review.rating)}
                  
                  <h3 className="font-semibold mt-3 mb-2">{review.name}</h3>
                  
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {review.text}
                  </p>
                  
                  {review.productName && (
                    <div className="flex items-center gap-3 pt-4 border-t">
                      <div className="w-10 h-10 bg-muted/50 rounded flex items-center justify-center flex-shrink-0">
                        {review.productImage ? (
                          <img 
                            src={review.productImage} 
                            alt={review.productName}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">
                          {review.productName}
                        </p>
                        {review.productUrl && (
                          <a 
                            href={review.productUrl}
                            className="text-xs text-primary hover:underline"
                          >
                            Ver produto ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Carousel Navigation */}
          {displayReviews.length > (isMobile ? 1 : 4) && (
            <>
              <button
                onClick={scrollPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 p-2 rounded-full bg-background shadow-lg hover:bg-muted transition-colors z-10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={scrollNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 p-2 rounded-full bg-background shadow-lg hover:bg-muted transition-colors z-10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Dots indicator */}
        {displayReviews.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-4">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Demo indicator - only in editing mode */}
        {isUsingDemo && isEditing && (
          <p className="text-xs text-center text-muted-foreground mt-4">
            [Exemplo demonstrativo] Configure avaliações reais para seus produtos
          </p>
        )}
      </div>
    </section>
  );
}
