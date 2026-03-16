// =============================================
// CONTENT COLUMNS ADAPTER — Translates ContentColumns block needs to Visual Engine
// v1.0.0: Image-only generation (texts already handled by aiFillable Group A)
// No overlay, no scrim — pure illustrative image
// =============================================

import type {
  BlockVisualAdapter,
  AdapterInput,
  VisualGenerationRequest,
  VisualGenerationResult,
} from './types.ts';

// ContentColumns image dimensions: companion to text, not hero
const CONTENT_DESKTOP = { width: 800, height: 600 };
const CONTENT_MOBILE = { width: 600, height: 800 };

export class ContentColumnsAdapter implements BlockVisualAdapter {
  adapt(params: AdapterInput): VisualGenerationRequest[] {
    const { creativeStyle, styleConfig, briefing, contexts, store, enableQA } = params;
    const ctx = contexts[0] || {};

    return [{
      blockType: 'ContentColumns',
      outputMode: 'editable', // No overlay — just pure image
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
          width: CONTENT_DESKTOP.width,
          height: CONTENT_DESKTOP.height,
          label: 'Imagem Desktop',
          composition: 'content_landscape',
        },
        {
          key: 'imageMobile',
          width: CONTENT_MOBILE.width,
          height: CONTENT_MOBILE.height,
          label: 'Imagem Mobile',
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
