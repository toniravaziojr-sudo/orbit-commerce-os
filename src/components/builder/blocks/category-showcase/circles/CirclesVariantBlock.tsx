// =============================================
// CIRCLES VARIANT — Orchestrator
// SRP: Compose data + layout. No fetch, no normalization here.
// Replaces the old monolithic FeaturedCategoriesBlock logic.
// =============================================

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { normalizeCategoryItems } from './normalizeItems';
import { useCategoriesData } from './useCategoriesData';
import { GridLayout } from './GridLayout';
import { CarouselLayout } from './CarouselLayout';
import { DemoLayout } from './DemoLayout';
import type { CirclesVariantProps } from './types';

export function CirclesVariantBlock({
  title = 'Categorias',
  items = [],
  categoryIds = [],
  mobileStyle = 'carousel',
  showName = true,
  context,
  isEditing = false,
}: CirclesVariantProps) {
  const deviceIsMobile = useIsMobile();
  const isMobile =
    context?.viewport === 'mobile' ||
    (context?.viewport !== 'desktop' &&
      context?.viewport !== 'tablet' &&
      deviceIsMobile);

  // Normalização canônica — memoizada por identidade de props
  const normalizedItems = useMemo(
    () => normalizeCategoryItems(items, categoryIds),
    [items, categoryIds],
  );

  // Fetch via React Query → cache estável, sem remount loop
  const { categories, isLoading } = useCategoriesData(normalizedItems);

  // 1. Loading (apenas quando há IDs para buscar)
  if (isLoading) {
    return (
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </section>
    );
  }

  // 2. Vazio + editor → demo placeholder
  if (categories.length === 0) {
    if (isEditing) {
      return <DemoLayout title={title} showName={showName} />;
    }
    return null;
  }

  // 3. Render real
  const useCarousel = isMobile && mobileStyle === 'carousel';
  const tenantSlug = context?.tenantSlug || '';
  const slidesToScroll = isMobile ? 3 : 6;

  return (
    <section className="py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        </div>

        {useCarousel ? (
          <CarouselLayout
            categories={categories}
            showName={showName}
            tenantSlug={tenantSlug}
            isEditing={isEditing}
            slidesToScroll={slidesToScroll}
          />
        ) : (
          <GridLayout
            categories={categories}
            showName={showName}
            tenantSlug={tenantSlug}
            isEditing={isEditing}
          />
        )}
      </div>
    </section>
  );
}
