// =============================================
// NEWSLETTER UNIFIED BLOCK COMPILER
// Routes to newsletter compiler for all modes
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { newsletterToStaticHTML } from './newsletter.ts';

export const newsletterUnifiedToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  // All modes produce similar static HTML (email capture form)
  return newsletterToStaticHTML(props, context);
};
