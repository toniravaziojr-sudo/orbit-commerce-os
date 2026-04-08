// =============================================
// CATEGORY SHOWCASE BLOCK COMPILER
// Routes to: categoryList (cards) or featuredCategories (circles)
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { categoryListToStaticHTML } from './category-list.ts';
import { featuredCategoriesToStaticHTML } from './featured-categories.ts';

export const categoryShowcaseToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const style = (props.style as string) || 'cards';

  if (style === 'circles') {
    return featuredCategoriesToStaticHTML(props, context);
  }

  return categoryListToStaticHTML(props, context);
};
