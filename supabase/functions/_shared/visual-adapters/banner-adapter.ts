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

function getCompositionHint(device: 'desktop' | 'mobile', outputMode: OutputMode): CompositionHint {
  if (outputMode === 'complete') {
    return device === 'desktop' ? 'banner_desktop_complete' : 'banner_mobile_complete';
  }
  return device === 'desktop' ? 'banner_desktop' : 'banner_mobile';
}

export class BannerAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { mode, outputMode, creativeStyle, styleConfig, briefing, contexts, store, enableQA } = params;
    const requests: VisualGenerationRequest[] = [];

    if (mode === 'carousel') {
      // One request per slide, each with desktop + mobile slots
      for (let i = 0; i < contexts.length; i++) {
        const ctx = contexts[i];
        requests.push({
          blockType: 'Banner',
          outputMode,
          creativeStyle,
          styleConfig,
          briefing: ctx.briefing || briefing,
          product: ctx.product,
          category: ctx.category,
          store,
          enableQA,
          slideIndex: i,
          slots: this.buildSlots(outputMode),
        });
      }
    } else {
      // Single banner: 1 request with 2 slots
      const ctx = contexts[0] || {};
      requests.push({
        blockType: 'Banner',
        outputMode,
        creativeStyle,
        styleConfig,
        briefing: ctx.briefing || briefing,
        product: ctx.product,
        category: ctx.category,
        store,
        enableQA,
        slots: this.buildSlots(outputMode),
      });
    }

    return requests;
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

  private buildSlots(outputMode: OutputMode): VisualSlot[] {
    return [
      {
        key: 'imageDesktop',
        width: BANNER_DESKTOP.width,
        height: BANNER_DESKTOP.height,
        label: 'Banner Desktop',
        composition: getCompositionHint('desktop', outputMode),
      },
      {
        key: 'imageMobile',
        width: BANNER_MOBILE.width,
        height: BANNER_MOBILE.height,
        label: 'Banner Mobile',
        composition: getCompositionHint('mobile', outputMode),
      },
    ];
  }
}
