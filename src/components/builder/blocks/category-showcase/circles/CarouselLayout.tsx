// =============================================
// CIRCLES VARIANT — Mobile carousel layout
// SRP: Render categories as a horizontal Embla carousel.
// Embla options memoized → instância estável entre re-renders.
// =============================================

import { memo, useCallback, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CategoryCard } from './CategoryCard';
import type { CategoryWithConfig } from './types';

interface CarouselLayoutProps {
  categories: CategoryWithConfig[];
  showName: boolean;
  tenantSlug: string;
  isEditing: boolean;
  slidesToScroll: number;
}

function CarouselLayoutImpl({
  categories,
  showName,
  tenantSlug,
  isEditing,
  slidesToScroll,
}: CarouselLayoutProps) {
  const emblaOptions = useMemo(
    () => ({
      align: 'start' as const,
      containScroll: 'trimSnaps' as const,
      slidesToScroll,
    }),
    [slidesToScroll],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const showNav = categories.length > 6;

  return (
    <>
      {showNav && (
        <div className="flex justify-end gap-2 mb-3">
          <button
            type="button"
            onClick={scrollPrev}
            className="p-2 rounded-full border hover:bg-muted transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            className="p-2 rounded-full border hover:bg-muted transition-colors"
            aria-label="Próximo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 sm:gap-6">
          {categories.map((category) => (
            <div key={category.id} className="flex-shrink-0">
              <CategoryCard
                category={category}
                showName={showName}
                tenantSlug={tenantSlug}
                isEditing={isEditing}
              />
            </div>
          ))}
        </div>
      </div>
      {categories.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        </div>
      )}
    </>
  );
}

export const CarouselLayout = memo(CarouselLayoutImpl);
