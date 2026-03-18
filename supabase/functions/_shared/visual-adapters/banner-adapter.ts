// =============================================
// BANNER ADAPTER — Translates Banner block needs to Visual Engine
// v4.3.0: Uses layoutPreset for correct proportions
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

// Banner proportions by layoutPreset
const PRESET_DIMENSIONS: Record<string, { desktop: { width: number; height: number }; mobile: { width: number; height: number } }> = {
  standard:          { desktop: { width: 1920, height: 800 },  mobile: { width: 750, height: 940 } },
  'compact-centered': { desktop: { width: 1200, height: 400 },  mobile: { width: 750, height: 400 } },
  'compact-full':    { desktop: { width: 1920, height: 400 },  mobile: { width: 750, height: 400 } },
  large:             { desktop: { width: 1920, height: 1080 }, mobile: { width: 750, height: 1200 } },
};

function getCompositionHint(device: 'desktop' | 'mobile'): CompositionHint {
  return device === 'desktop' ? 'banner_desktop' : 'banner_mobile';
}

export class BannerAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { briefing, contexts, store, enableQA, styleConfig, outputMode } = params;
    const ctx = contexts[0] || {};
    const layoutPreset = (styleConfig as any)?._layoutPreset || 'standard';

    return [{
      blockType: 'Banner',
      outputMode: outputMode || 'editable',
      creativeStyle: 'product_natural',
      styleConfig: {},
      briefing: ctx.briefing || briefing,
      product: ctx.product,
      category: ctx.category,
      store,
      enableQA,
      slots: this.buildSlots(layoutPreset),
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

  private buildSlots(layoutPreset: string): VisualSlot[] {
    const dims = PRESET_DIMENSIONS[layoutPreset] || PRESET_DIMENSIONS.standard;

    return [
      {
        key: 'imageDesktop',
        width: dims.desktop.width,
        height: dims.desktop.height,
        label: 'Banner Desktop',
        composition: getCompositionHint('desktop'),
      },
      {
        key: 'imageMobile',
        width: dims.mobile.width,
        height: dims.mobile.height,
        label: 'Banner Mobile',
        composition: getCompositionHint('mobile'),
      },
    ];
  }
}
