// =============================================
// BANNER PRODUCTS ADAPTER — Translates BannerProducts block needs to Visual Engine
// v1.0.0: Image + optional text generation
// Grounding: Uses the FIRST product from the block's selection as primary context.
// If source=category, uses category context.
// If multiple products exist, the first one is the hero; others provide variety context.
// =============================================

import type {
  BlockVisualAdapter,
  AdapterInput,
  VisualGenerationRequest,
  VisualGenerationResult,
} from './types.ts';

// BannerProducts dimensions: smaller than hero banner, complementary format
const BP_DESKTOP = { width: 600, height: 400 };
const BP_MOBILE = { width: 400, height: 500 };

export class BannerProductsAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { creativeStyle, styleConfig, briefing, contexts, store, enableQA } = params;
    const ctx = contexts[0] || {};

    return [{
      blockType: 'BannerProducts',
      outputMode: 'editable', // BannerProducts always editable (has HTML title/description overlay)
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
          width: BP_DESKTOP.width,
          height: BP_DESKTOP.height,
          label: 'Banner Desktop',
          composition: 'content_landscape',
        },
        {
          key: 'imageMobile',
          width: BP_MOBILE.width,
          height: BP_MOBILE.height,
          label: 'Banner Mobile',
          composition: 'content_portrait',
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
