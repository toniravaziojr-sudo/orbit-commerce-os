// =============================================
// TEXT BANNERS ADAPTER — Translates TextBanners block needs to Visual Engine
// v1.0.0: 4 independent image slots (2 desktop + 2 mobile), no text generation
// TextBanners shows text + 2 portrait images side by side
// =============================================

import type {
  BlockVisualAdapter,
  AdapterInput,
  VisualGenerationRequest,
  VisualGenerationResult,
} from './types.ts';

// TextBanners dimensions: portrait format for both images
const TB_DESKTOP = { width: 600, height: 800 };
const TB_MOBILE = { width: 400, height: 500 };

export class TextBannersAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { creativeStyle, styleConfig, briefing, contexts, store, enableQA } = params;
    const ctx = contexts[0] || {};

    // Single request with all 4 slots — visual engine generates each independently
    return [{
      blockType: 'TextBanners',
      outputMode: 'editable', // No overlay — pure image
      creativeStyle,
      styleConfig,
      briefing: ctx.briefing || briefing,
      product: ctx.product,
      category: ctx.category,
      store,
      enableQA,
      slots: [
        {
          key: 'imageDesktop1',
          width: TB_DESKTOP.width,
          height: TB_DESKTOP.height,
          label: 'Imagem 1 Desktop',
          composition: 'content_portrait',
        },
        {
          key: 'imageMobile1',
          width: TB_MOBILE.width,
          height: TB_MOBILE.height,
          label: 'Imagem 1 Mobile',
          composition: 'content_portrait',
        },
        {
          key: 'imageDesktop2',
          width: TB_DESKTOP.width,
          height: TB_DESKTOP.height,
          label: 'Imagem 2 Desktop',
          composition: 'content_portrait',
        },
        {
          key: 'imageMobile2',
          width: TB_MOBILE.width,
          height: TB_MOBILE.height,
          label: 'Imagem 2 Mobile',
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

    const merged: Record<string, unknown> = {};

    for (const asset of result.assets) {
      // Map slot keys directly to block props
      if (['imageDesktop1', 'imageMobile1', 'imageDesktop2', 'imageMobile2'].includes(asset.slotKey)) {
        merged[asset.slotKey] = asset.publicUrl;
      }
    }

    return merged;
  }
}
