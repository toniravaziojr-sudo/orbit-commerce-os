// =============================================
// IMAGE CAROUSEL ADAPTER — Translates ImageCarousel block needs to Visual Engine
// v1.0.0: Dynamic N slots, each with srcDesktop (+ srcMobile optional)
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

// Default dimensions (landscape)
const CAROUSEL_DEFAULT = { width: 800, height: 600 };

// Aspect-ratio aware dimensions
const ASPECT_DIMENSIONS: Record<string, { w: number; h: number; hint: CompositionHint }> = {
  'auto':  { w: 800, h: 600, hint: 'content_landscape' },
  '1:1':   { w: 800, h: 800, hint: 'content_square' },
  '4:3':   { w: 800, h: 600, hint: 'content_landscape' },
  '3:4':   { w: 600, h: 800, hint: 'content_portrait' },
  '16:9':  { w: 960, h: 540, hint: 'content_landscape' },
  '9:16':  { w: 540, h: 960, hint: 'content_portrait' },
};

export class ImageCarouselAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { creativeStyle, styleConfig, briefing, contexts, store, enableQA } = params;

    // Number of images from wizard (quantity-select step)
    const imageCount = Math.min(
      (styleConfig?._imageCount as number) || 4,
      MAX_IMAGES_PER_GENERATION,
    );

    const aspectRatio = (styleConfig?._aspectRatio as string) || 'auto';
    const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS['auto'];

    // Create one slot per image — each gets a unique key for mergeResults
    const slots = Array.from({ length: imageCount }, (_, i) => ({
      key: `carousel_${i}`,
      width: dims.w,
      height: dims.h,
      label: `Imagem ${i + 1} do carrossel`,
      composition: dims.hint,
    }));

    const ctx = contexts[0] || {};

    return [{
      blockType: 'ImageCarousel',
      outputMode: 'editable',
      creativeStyle,
      styleConfig,
      briefing: ctx.briefing || briefing,
      product: ctx.product,
      category: ctx.category,
      store,
      enableQA,
      slideIndex: 0,
      slots,
    }];
  }

  mergeResults(
    results: VisualGenerationResult[],
    _params: AdapterInput,
  ): Record<string, unknown> {
    const result = results[0];
    if (!result) return {};

    // Build images array matching ImageCarouselItem shape: { id, srcDesktop, alt }
    const images = result.assets
      .filter(a => a.slotKey.startsWith('carousel_'))
      .sort((a, b) => {
        const ai = parseInt(a.slotKey.split('_')[1]);
        const bi = parseInt(b.slotKey.split('_')[1]);
        return ai - bi;
      })
      .map((asset, i) => ({
        id: crypto.randomUUID(),
        srcDesktop: asset.publicUrl,
        alt: `Imagem ${i + 1}`,
      }));

    return { images };
  }
}
