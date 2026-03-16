// =============================================
// IMAGE GALLERY ADAPTER — Translates ImageGallery block needs to Visual Engine
// v1.0.0: Dynamic N slots, each with single `src` (no mobile variant)
// Max 6 images per generation to prevent timeouts
// =============================================

import type {
  BlockVisualAdapter,
  AdapterInput,
  VisualGenerationRequest,
  VisualGenerationResult,
  CompositionHint,
} from './types.ts';

const MAX_IMAGES_PER_GENERATION = 6;

// Default: square for gallery
const GALLERY_DEFAULT = { width: 800, height: 800 };

// Aspect-ratio aware dimensions
const ASPECT_DIMENSIONS: Record<string, { w: number; h: number; hint: CompositionHint }> = {
  'auto':    { w: 800, h: 800, hint: 'content_square' },
  'square':  { w: 800, h: 800, hint: 'content_square' },
  '1:1':     { w: 800, h: 800, hint: 'content_square' },
  '4:3':     { w: 800, h: 600, hint: 'content_landscape' },
  '3:4':     { w: 600, h: 800, hint: 'content_portrait' },
  '16:9':    { w: 960, h: 540, hint: 'content_landscape' },
};

export class ImageGalleryAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { creativeStyle, styleConfig, briefing, contexts, store, enableQA } = params;

    const imageCount = Math.min(
      (styleConfig?._imageCount as number) || 6,
      MAX_IMAGES_PER_GENERATION,
    );

    const aspectRatio = (styleConfig?._aspectRatio as string) || 'auto';
    const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS['auto'];

    const slots = Array.from({ length: imageCount }, (_, i) => ({
      key: `gallery_${i}`,
      width: dims.w,
      height: dims.h,
      label: `Imagem ${i + 1} da galeria`,
      composition: dims.hint,
    }));

    const ctx = contexts[0] || {};

    return [{
      blockType: 'ImageGallery',
      outputMode: 'editable',
      creativeStyle,
      styleConfig,
      briefing: ctx.briefing || briefing,
      product: ctx.product,
      category: ctx.category,
      store,
      enableQA,
      slots,
    }];
  }

  mergeResults(
    results: VisualGenerationResult[],
    _params: AdapterInput,
  ): Record<string, unknown> {
    const result = results[0];
    if (!result) return {};

    // Build images array matching GalleryImageItem shape: { id, src, alt }
    const images = result.assets
      .filter(a => a.slotKey.startsWith('gallery_'))
      .sort((a, b) => {
        const ai = parseInt(a.slotKey.split('_')[1]);
        const bi = parseInt(b.slotKey.split('_')[1]);
        return ai - bi;
      })
      .map((asset, i) => ({
        id: crypto.randomUUID(),
        src: asset.publicUrl,
        alt: `Imagem ${i + 1}`,
      }));

    return { images };
  }
}
