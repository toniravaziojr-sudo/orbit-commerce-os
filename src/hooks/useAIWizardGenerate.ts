// =============================================
// useAIWizardGenerate — Hook para geração visual via wizard
// v4.0.0: Simplified Banner flow (product-select + briefing only)
// =============================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WizardBlockContract } from '@/lib/builder/aiWizardRegistry';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';
import type { BannerModeData } from '@/components/builder/ai-wizard/steps/BannerModeStep';
import type { GenerationScope } from '@/components/builder/ai-wizard/steps/ScopeSelectStep';
import type { ProductSelectData } from '@/components/builder/ai-wizard/steps/ProductSelectStep';

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
 * System-derived props that bypass the whitelist.
 */
const SYSTEM_DERIVED_PROPS = new Set(['overlayOpacity', 'alignment', '_renderMode', '_hideOverlayText', '_lastWizardConfig']);

/**
 * Applies whitelist enforcement.
 */
function whitelistMerge(
  currentProps: Record<string, unknown>,
  generatedProps: Record<string, unknown>,
  contract: WizardBlockContract,
  collectedData: Record<string, unknown>,
  blockType: string,
): Record<string, unknown> {
  const merged = { ...currentProps };
  const allowedKeys = new Set(contract.aiGenerates);

  // Apply system-derived props (bypass whitelist)
  for (const key of SYSTEM_DERIVED_PROPS) {
    if (generatedProps[key] !== undefined) {
      merged[key] = generatedProps[key];
    }
  }

  // For Banner (simplified): only images come back
  if (blockType === 'Banner') {
    for (const [key, value] of Object.entries(generatedProps)) {
      if (SYSTEM_DERIVED_PROPS.has(key)) continue;
      if (!allowedKeys.has(key)) continue;
      merged[key] = value;
    }
  } else {
    // Generic handler for other blocks
    const imageKeys = new Set(contract.imageSpecs?.map(s => s.key) || []);
    const scope = (collectedData.scope as GenerationScope) || 'all';
    const includeImages = scope === 'images' || scope === 'all';
    const includeTexts = scope === 'texts' || scope === 'all';

    for (const [key, value] of Object.entries(generatedProps)) {
      if (SYSTEM_DERIVED_PROPS.has(key)) continue;
      if (!allowedKeys.has(key)) continue;
      const isImage = imageKeys.has(key);
      if (isImage && !includeImages) continue;
      if (!isImage && !includeTexts) continue;
      merged[key] = value;
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
      const backendData: Record<string, unknown> = { ...collectedData, currentProps };

      // For Banner: extract from new simplified flow
      if (blockType === 'Banner') {
        const productSelect = collectedData.productSelect as ProductSelectData | undefined;
        
        // Build a simplified association for backend compatibility
        if (productSelect?.hasProduct && productSelect.productId) {
          backendData.association = {
            associationType: 'product',
            productId: productSelect.productId,
          };
        } else {
          backendData.association = {
            associationType: 'none',
          };
        }
      } else {
        // Non-Banner blocks: handle creativeStyle merging for backward compat
        const creativeStyleData = collectedData.creativeStyle as { creativeStyle?: string; styleConfig?: Record<string, unknown> } | undefined;
        if (creativeStyleData && backendData.bannerMode) {
          const modeDataForStyle = backendData.bannerMode as Record<string, unknown>;
          modeDataForStyle.creativeStyle = creativeStyleData.creativeStyle || 'product_natural';
          modeDataForStyle.styleConfig = creativeStyleData.styleConfig || {};
        }

        // Pass imageCount for array-based blocks
        if (collectedData.imageCount !== undefined) {
          backendData.imageCount = collectedData.imageCount;
        }
      }

      // Resolve mode, scope and outputMode
      let mode: string | undefined;
      let scope: string = 'all';
      let outputMode: string = 'editable';

      if (blockType === 'Banner') {
        mode = 'single';
        scope = 'images';
        // Extract outputMode from the wizard step
        const outputModeData = collectedData.outputMode as BannerModeData | undefined;
        outputMode = outputModeData?.outputMode || 'editable';
      } else {
        const modeData = collectedData.bannerMode as BannerModeData | undefined;
        mode = modeData?.bannerMode;
        scope = (collectedData.scope as string) || 'all';
      }

      console.log('[useAIWizardGenerate] Sending to backend:', JSON.stringify({
        tenantId,
        blockType,
        mode,
        scope,
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
      );

      // Apply layoutPreset from wizard if selected (Banner)
      if (blockType === 'Banner' && collectedData._layoutPreset) {
        merged.layoutPreset = collectedData._layoutPreset;
      }

      // Save wizard config for regeneration
      merged._lastWizardConfig = {
        collectedData,
        mode,
        scope,
        blockType,
        timestamp: Date.now(),
      };

      toast.success('Imagem gerada com IA ✨');

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
