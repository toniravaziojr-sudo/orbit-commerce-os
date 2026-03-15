// =============================================
// useAIWizardGenerate — Hook para geração visual via wizard (Phase 3.3)
// Frontend envia blockType, mode (from wizard), scope, collectedData
// Backend resolve contrato internamente
// =============================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WizardBlockContract } from '@/lib/builder/aiWizardRegistry';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';
import type { BannerModeData } from '@/components/builder/ai-wizard/steps/BannerModeStep';
import type { GenerationScope } from '@/components/builder/ai-wizard/steps/ScopeSelectStep';

interface UseAIWizardGenerateParams {
  tenantId: string;
  blockType: string;
  currentProps: Record<string, unknown>;
  contract: WizardBlockContract;
}

interface UseAIWizardGenerateReturn {
  generate: (collectedData: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  isGenerating: boolean;
}

/**
 * Derives mode from the wizard's collected data (Phase 3.3).
 * Mode is now chosen INSIDE the wizard, not from existing block props.
 */
function resolveMode(blockType: string, collectedData: Record<string, unknown>): string | undefined {
  if (blockType === 'Banner') {
    const modeData = collectedData.bannerMode as BannerModeData | undefined;
    return modeData?.bannerMode || 'single';
  }
  return undefined;
}

/**
 * Resolves scope from collected data.
 */
function resolveScope(collectedData: Record<string, unknown>): GenerationScope {
  return (collectedData.scope as GenerationScope) || 'all';
}

/**
 * System-derived props that bypass the whitelist — set by backend for legibility/layout.
 */
const SYSTEM_DERIVED_PROPS = new Set(['overlayOpacity', 'alignment', '_renderMode', '_hideOverlayText']);

/**
 * Applies whitelist + scope enforcement: only writes allowed props that match the scope.
 * System-derived props (overlayOpacity, alignment) bypass the whitelist.
 */
function whitelistMerge(
  currentProps: Record<string, unknown>,
  generatedProps: Record<string, unknown>,
  contract: WizardBlockContract,
  collectedData: Record<string, unknown>,
  blockType: string,
  mode?: string,
  scope?: GenerationScope,
): Record<string, unknown> {
  const merged = { ...currentProps };
  const allowedKeys = new Set(contract.aiGenerates);
  const imageKeys = new Set(contract.imageSpecs?.map(s => s.key) || []);

  // Determine what to include based on scope
  const includeImages = scope === 'images' || scope === 'all';
  const includeTexts = scope === 'texts' || scope === 'all';

  // Apply system-derived props (bypass whitelist)
  for (const key of SYSTEM_DERIVED_PROPS) {
    if (generatedProps[key] !== undefined) {
      merged[key] = generatedProps[key];
    }
  }

  if (blockType === 'Banner' && mode === 'single') {
    for (const [key, value] of Object.entries(generatedProps)) {
      if (SYSTEM_DERIVED_PROPS.has(key)) continue; // already handled
      if (!allowedKeys.has(key)) continue;
      const isImage = imageKeys.has(key);
      if (isImage && !includeImages) continue;
      if (!isImage && !includeTexts) continue;
      merged[key] = value;
    }

    // Derive linkUrl from association (system, not AI)
    const assoc = collectedData.association as any;
    if (assoc?.derivedLinkUrl) {
      merged.linkUrl = assoc.derivedLinkUrl;
    }
  } else if (blockType === 'Banner' && mode === 'carousel') {
    if (allowedKeys.has('slides') && Array.isArray(generatedProps.slides)) {
      const modeData = collectedData.bannerMode as BannerModeData | undefined;
      const slideCount = modeData?.slideCount || generatedProps.slides.length;

      const slides = (generatedProps.slides as any[]).slice(0, slideCount).map((slide, i) => {
        const assocData = collectedData[`association_${i}`] as any;
        let linkUrl = slide.linkUrl || '';

        if (assocData?.derivedLinkUrl) {
          linkUrl = assocData.derivedLinkUrl;
        }

        // Apply scope filtering per slide
        const result: Record<string, unknown> = { id: slide.id, linkUrl };
        if (includeImages) {
          result.imageDesktop = slide.imageDesktop || '';
          result.imageMobile = slide.imageMobile || '';
        }
        if (includeTexts) {
          result.title = slide.title || '';
          result.subtitle = slide.subtitle || '';
          result.buttonText = slide.buttonText || '';
          result.altText = slide.altText || '';
        }
        return result;
      });

      merged.slides = slides;
      merged.mode = 'carousel';
    }
  }

  return merged;
}

export function useAIWizardGenerate({
  tenantId,
  blockType,
  currentProps,
  contract,
}: UseAIWizardGenerateParams): UseAIWizardGenerateReturn {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (
    collectedData: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> => {
    if (isGenerating) return null;
    setIsGenerating(true);

    try {
      const mode = resolveMode(blockType, collectedData);
      const scope = resolveScope(collectedData);

      // Remap association keys for backend compatibility
      // Wizard uses association_0, association_1 for carousel slides
      // Backend expects slideAssociations_0, slideAssociations_1
      const backendData: Record<string, unknown> = { ...collectedData };

      // Merge creativeStyle data into bannerMode for backend compatibility
      const creativeStyleData = collectedData.creativeStyle as { creativeStyle?: string; styleConfig?: Record<string, unknown> } | undefined;
      if (creativeStyleData && backendData.bannerMode) {
        const modeDataForStyle = backendData.bannerMode as Record<string, unknown>;
        modeDataForStyle.creativeStyle = creativeStyleData.creativeStyle || 'product_natural';
        modeDataForStyle.styleConfig = creativeStyleData.styleConfig || {};
      }

      if (mode === 'carousel') {
        const modeData = collectedData.bannerMode as BannerModeData | undefined;
        const slideCount = modeData?.slideCount || 2;
        backendData.slideCount = slideCount;
        for (let i = 0; i < slideCount; i++) {
          if (collectedData[`association_${i}`]) {
            backendData[`slideAssociations_${i}`] = collectedData[`association_${i}`];
          }
        }
      }

      // Debug: log the full payload being sent
      console.log('[useAIWizardGenerate] Sending to backend:', JSON.stringify({
        tenantId,
        blockType,
        mode,
        scope,
        bannerMode: backendData.bannerMode,
        creativeStyle: backendData.creativeStyle,
        briefing: backendData.briefing,
      }, null, 2));

      const { data, error } = await supabase.functions.invoke('ai-block-fill-visual', {
        body: {
          tenantId,
          blockType,
          mode,
          scope,
          collectedData: backendData,
        },
      });

      if (error) {
        console.error('[useAIWizardGenerate] Edge function error:', error);
        const errorMsg = typeof error === 'object' && error?.message ? error.message : 'Erro na chamada da função de geração';
        showErrorToast(new Error(errorMsg), { module: 'IA', action: 'gerar conteúdo visual' });
        return null;
      }

      if (!data?.success || !data?.generatedProps) {
        const errMsg = data?.error || 'A IA não retornou conteúdo';
        showErrorToast(new Error(errMsg), { module: 'IA', action: 'gerar conteúdo visual' });
        return null;
      }

      const merged = whitelistMerge(
        currentProps,
        data.generatedProps,
        contract,
        collectedData,
        blockType,
        mode,
        scope,
      );

      // If wizard changed mode from single to carousel (or vice versa), apply it
      if (blockType === 'Banner' && mode) {
        merged.mode = mode;
      }

      toast.success('Conteúdo gerado com IA ✨', {
        description: scope === 'images' ? 'Imagens geradas.' : scope === 'texts' ? 'Textos gerados.' : 'Imagens e textos gerados.',
      });

      return merged;
    } catch (err) {
      console.error('[useAIWizardGenerate] Unexpected error:', err);
      showErrorToast(err, { module: 'IA', action: 'gerar conteúdo visual' });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, tenantId, blockType, currentProps, contract]);

  return { generate, isGenerating };
}
