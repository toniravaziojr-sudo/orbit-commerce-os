// =============================================
// CONTENT SECTION BLOCK COMPILER — Unified (ContentColumns + TextBanners)
// Routes to content-columns or text-banners based on style
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { contentColumnsToStaticHTML } from './content-columns.ts';
import { textBannersToStaticHTML } from './text-banners.ts';

export const contentSectionToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const style = (props.style as string) || 'content';

  if (style === 'editorial') {
    return textBannersToStaticHTML(props, context);
  }

  return contentColumnsToStaticHTML(props, context);
};
