// =============================================
// PRODUCT SHOWCASE BLOCK COMPILER
// Routes to: productGrid, productCarousel, collectionSection, or featuredProducts
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { productGridToStaticHTML } from './product-grid.ts';
import { productCarouselToStaticHTML } from './product-carousel.ts';
import { collectionSectionToStaticHTML } from './collection-section.ts';
import { featuredProductsToStaticHTML } from './featured-products.ts';

export const productShowcaseToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const source = (props.source as string) || 'featured';
  const layout = (props.layout as string) || 'grid';

  if (source === 'manual') {
    return featuredProductsToStaticHTML(props, context);
  }

  if (source === 'category' && (props.showViewAll || props.categorySlug)) {
    return collectionSectionToStaticHTML({ ...props, displayStyle: layout }, context);
  }

  if (layout === 'carousel') {
    return productCarouselToStaticHTML(props, context);
  }

  return productGridToStaticHTML(props, context);
};
