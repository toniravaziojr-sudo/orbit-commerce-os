// =============================================
// IMAGE CAROUSEL BLOCK COMPILER — ALIAS
// Redirects to unified imageGalleryToStaticHTML with layout='carousel'
// Maintains retrocompatibility for pages saved with ImageCarousel type
// =============================================

import type { CompilerContext } from '../types.ts';
import { imageGalleryToStaticHTML } from './image-gallery.ts';

export function imageCarouselToStaticHTML(
  props: Record<string, unknown>,
  context: CompilerContext,
): string {
  return imageGalleryToStaticHTML(
    { ...props, layout: 'carousel' },
    context,
  );
}
