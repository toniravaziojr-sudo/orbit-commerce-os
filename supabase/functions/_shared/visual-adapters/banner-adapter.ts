// =============================================
// BANNER ADAPTER — Translates Banner block needs to Visual Engine
// v1.0.0: Supports single + carousel, editable + complete modes
// =============================================

import type {
  BlockVisualAdapter,
  AdapterInput,
  VisualGenerationRequest,
  VisualGenerationResult,
  VisualSlot,
  OutputMode,
  CompositionHint,
} from './types.ts';

// Banner proportions (commercial standard v2.2.0)
const BANNER_DESKTOP = { width: 1920, height: 800 };
const BANNER_MOBILE = { width: 750, height: 940 };

// v4.0.0: Banner always uses editable composition (text overlay via HTML)
function getCompositionHint(device: 'desktop' | 'mobile'): CompositionHint {
  return device === 'desktop' ? 'banner_desktop' : 'banner_mobile';
}

export class BannerAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { briefing, contexts, store, enableQA } = params;
    // v4.0.0: Always single request — per-slide generation is handled by frontend calling once per slide
    const ctx = contexts[0] || {};
    return [{
      blockType: 'Banner',
      outputMode: 'editable',
      creativeStyle: 'product_natural',
      styleConfig: {},
      briefing: ctx.briefing || briefing,
      product: ctx.product,
      category: ctx.category,
      store,
      enableQA,
      slots: this.buildSlots(),
    }];
  }

  mergeResults(
    results: VisualGenerationResult[],
    _params: AdapterInput,
  ): Record<string, unknown> {
    // v4.0.0: Banner always generates images only (single request)
    // Text generation is decoupled and handled separately
    const result = results[0];
    if (!result) return {};

    const desktopAsset = result.assets.find(a => a.slotKey === 'imageDesktop');
    const mobileAsset = result.assets.find(a => a.slotKey === 'imageMobile');

    const merged: Record<string, unknown> = {};
    if (desktopAsset) merged.imageDesktop = desktopAsset.publicUrl;
    if (mobileAsset) merged.imageMobile = mobileAsset.publicUrl;

    return merged;
  }

  private buildSlots(): VisualSlot[] {
    return [
      {
        key: 'imageDesktop',
        width: BANNER_DESKTOP.width,
        height: BANNER_DESKTOP.height,
        label: 'Banner Desktop',
        composition: getCompositionHint('desktop'),
      },
      {
        key: 'imageMobile',
        width: BANNER_MOBILE.width,
        height: BANNER_MOBILE.height,
        label: 'Banner Mobile',
        composition: getCompositionHint('mobile'),
      },
    ];
  }
}
