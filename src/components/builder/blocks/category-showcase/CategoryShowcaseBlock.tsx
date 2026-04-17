// =============================================
// CATEGORY SHOWCASE BLOCK - Unified orchestrator
// SRP: Routes only. No data, no layout.
// Routes to: CategoryListBlock (cards) | CirclesVariantBlock (circles)
// =============================================

import { CategoryListBlock } from '../CategoryListBlock';
import { CirclesVariantBlock } from './circles';
import type { CategoryShowcaseBlockProps } from './types';

export function CategoryShowcaseBlock(props: CategoryShowcaseBlockProps) {
  const { style = 'cards', ...rest } = props;

  if (style === 'circles') {
    return <CirclesVariantBlock {...(rest as any)} />;
  }

  // Default: cards
  return <CategoryListBlock {...(rest as any)} />;
}
