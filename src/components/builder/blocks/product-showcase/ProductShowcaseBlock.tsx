// =============================================
// PRODUCT SHOWCASE BLOCK - Unified orchestrator
// Routes to existing components based on source + layout
// =============================================

import { ProductGridBlock } from '../ProductGridBlock';
import { ProductCarouselBlock } from '../ProductCarouselBlock';
import { CollectionSectionBlock } from '../CollectionSectionBlock';
import { FeaturedProductsBlock } from '../FeaturedProductsBlock';
import type { ProductShowcaseBlockProps } from './types';

export function ProductShowcaseBlock(props: ProductShowcaseBlockProps) {
  const { source = 'featured', layout = 'grid', ...rest } = props;

  // Manual source → FeaturedProducts (has productIds selector)
  if (source === 'manual') {
    return <FeaturedProductsBlock {...rest as any} />;
  }

  // Category source with "Ver todos" link → CollectionSection
  if (source === 'category' && (rest.showViewAll || rest.categorySlug)) {
    return (
      <CollectionSectionBlock
        {...rest as any}
        displayStyle={layout}
      />
    );
  }

  // Carousel layout → ProductCarousel
  if (layout === 'carousel') {
    return (
      <ProductCarouselBlock
        {...rest as any}
        source={source as any}
      />
    );
  }

  // Default: grid layout → ProductGrid
  return (
    <ProductGridBlock
      {...rest as any}
      source={source as any}
    />
  );
}
