// =============================================
// CATEGORY SHOWCASE BLOCK - Unified orchestrator
// Routes to: CategoryListBlock (cards) | FeaturedCategoriesBlock (circles)
// =============================================

import { CategoryListBlock } from '../CategoryListBlock';
import { FeaturedCategoriesBlock } from '../FeaturedCategoriesBlock';
import type { CategoryShowcaseBlockProps } from './types';

export function CategoryShowcaseBlock(props: CategoryShowcaseBlockProps) {
  const { style = 'cards', ...rest } = props;

  if (style === 'circles') {
    return <FeaturedCategoriesBlock {...rest as any} />;
  }

  // Default: cards
  return <CategoryListBlock {...rest as any} />;
}
