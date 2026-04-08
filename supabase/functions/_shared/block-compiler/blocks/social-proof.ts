// =============================================
// SOCIAL PROOF BLOCK COMPILER — Unified (Testimonials + Reviews)
// Routes to testimonials or reviews based on mode
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { testimonialsToStaticHTML } from './testimonials.ts';
import { reviewsToStaticHTML } from './reviews.ts';

export const socialProofToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const mode = (props.mode as string) || 'testimonials';

  if (mode === 'reviews') {
    return reviewsToStaticHTML(props, context);
  }

  return testimonialsToStaticHTML(props, context);
};
