// =============================================
// IMAGE ADAPTER — Translates Image block needs to Visual Engine
// v1.0.0: Pure image block, no text overlay, no scrim
// Respects block aspectRatio for dimension mapping
// =============================================

import type {
  BlockVisualAdapter,
  AdapterInput,
  VisualGenerationRequest,
  VisualGenerationResult,
  VisualSlot,
  CompositionHint,
} from './types.ts';

// Default dimensions (3:2 desktop, 4:5 mobile — as recommended in registry helpText)
const DEFAULT_DESKTOP = { width: 1200, height: 800 };
const DEFAULT_MOBILE = { width: 800, height: 1000 };

// Aspect-ratio aware dimensions (always outputs at optimal resolution)
const ASPECT_DIMENSIONS: Record<string, { desktop: { w: number; h: number }; mobile: { w: number; h: number } }> = {
  'auto':  { desktop: { w: 1200, h: 800 },  mobile: { w: 800, h: 1000 } },
  '1:1':   { desktop: { w: 1024, h: 1024 }, mobile: { w: 800, h: 800 } },
  '4:3':   { desktop: { w: 1200, h: 900 },  mobile: { w: 800, h: 600 } },
  '16:9':  { desktop: { w: 1280, h: 720 },  mobile: { w: 800, h: 450 } },
  '21:9':  { desktop: { w: 1680, h: 720 },  mobile: { w: 800, h: 343 } },
};

function getComposition(aspectRatio: string): CompositionHint {
  if (aspectRatio === '1:1') return 'content_square';
  // For most aspect ratios, desktop is landscape
  return 'content_landscape';
}

function getMobileComposition(aspectRatio: string): CompositionHint {
  if (aspectRatio === '1:1') return 'content_square';
  // Mobile defaults to portrait for auto, landscape for explicit ratios
  if (aspectRatio === 'auto') return 'content_portrait';
  return 'content_landscape';
}

export class ImageAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { outputMode, creativeStyle, styleConfig, briefing, contexts, store, enableQA } = params;
    const ctx = contexts[0] || {};

    // Extract aspectRatio from styleConfig (passed from frontend currentProps)
    const aspectRatio = (styleConfig?._aspectRatio as string) || 'auto';
    const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS['auto'];

    return [{
      blockType: 'Image',
      outputMode: 'editable', // Image block never uses overlay — but we use editable for no-text prompt
      creativeStyle,
      styleConfig,
      briefing: ctx.briefing || briefing,
      product: ctx.product,
      category: ctx.category,
      store,
      enableQA,
      slots: [
        {
          key: 'imageDesktop',
          width: dims.desktop.w,
          height: dims.desktop.h,
          label: 'Imagem Desktop',
          composition: getComposition(aspectRatio),
        },
        {
          key: 'imageMobile',
          width: dims.mobile.w,
          height: dims.mobile.h,
          label: 'Imagem Mobile',
          composition: getMobileComposition(aspectRatio),
        },
      ],
    }];
  }

  mergeResults(
    results: VisualGenerationResult[],
    _params: AdapterInput,
  ): Record<string, unknown> {
    const result = results[0];
    if (!result) return {};

    const desktopAsset = result.assets.find(a => a.slotKey === 'imageDesktop');
    const mobileAsset = result.assets.find(a => a.slotKey === 'imageMobile');

    const merged: Record<string, unknown> = {};
    if (desktopAsset) merged.imageDesktop = desktopAsset.publicUrl;
    if (mobileAsset) merged.imageMobile = mobileAsset.publicUrl;

    return merged;
  }
}
