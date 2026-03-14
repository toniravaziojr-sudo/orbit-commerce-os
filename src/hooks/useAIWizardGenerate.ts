// =============================================
// useAIWizardGenerate — Hook para geração visual via wizard (Fase 3.2)
// Frontend envia apenas blockType, mode, collectedData
// Backend resolve contrato internamente
// =============================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { WizardBlockContract } from '@/lib/builder/aiWizardRegistry';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

interface UseAIWizardGenerateParams {
  tenantId: string;
  blockType: string;
  currentProps: Record<string, unknown>;
  /** Frontend contract — used only for whitelist enforcement on the client side */
  contract: WizardBlockContract;
}

interface UseAIWizardGenerateReturn {
  /** Triggers generation and returns merged props (or null on error) */
  generate: (collectedData: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  /** True while generating */
  isGenerating: boolean;
}

/**
 * Derives the mode from the block's current props.
 */
function resolveMode(blockType: string, currentProps: Record<string, unknown>): string | undefined {
  if (blockType === 'Banner') {
    return (currentProps.mode as string) || 'single';
  }
  return undefined;
}

/**
 * Applies whitelist enforcement: only writes props that are in contract.aiGenerates.
 * linkUrl is NEVER overwritten by AI — it's derived from associations by the system.
 */
function whitelistMerge(
  currentProps: Record<string, unknown>,
  generatedProps: Record<string, unknown>,
  contract: WizardBlockContract,
  collectedData: Record<string, unknown>,
  blockType: string,
  mode?: string,
): Record<string, unknown> {
  const merged = { ...currentProps };
  const allowedKeys = new Set(contract.aiGenerates);

  if (blockType === 'Banner' && mode === 'single') {
    // Single banner: merge flat props
    for (const [key, value] of Object.entries(generatedProps)) {
      if (allowedKeys.has(key)) {
        merged[key] = value;
      }
    }

    // Derive linkUrl from association (system, not AI)
    const assoc = collectedData.association as any;
    if (assoc) {
      if (assoc.derivedLinkUrl) {
        merged.linkUrl = assoc.derivedLinkUrl;
      }
    }
  } else if (blockType === 'Banner' && mode === 'carousel') {
    // Carousel: replace slides array entirely (it's in aiGenerates)
    if (allowedKeys.has('slides') && Array.isArray(generatedProps.slides)) {
      const slides = (generatedProps.slides as any[]).map((slide, i) => {
        // Resolve linkUrl from the wizard's association data (system-derived)
        const assocData = collectedData[`slideAssociations_${i}`] as any;
        let linkUrl = slide.linkUrl || '';

        // If the backend returned placeholder markers, resolve them
        if (assocData?.derivedLinkUrl) {
          linkUrl = assocData.derivedLinkUrl;
        }

        return {
          ...slide,
          linkUrl,
        };
      });
      merged.slides = slides;
      // Switch mode to carousel if it was single
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
      const mode = resolveMode(blockType, currentProps);

      // Frontend sends ONLY blockType, mode, collectedData — never the contract
      const { data, error } = await supabase.functions.invoke('ai-block-fill-visual', {
        body: {
          tenantId,
          blockType,
          mode,
          collectedData,
        },
      });

      if (error) {
        console.error('[useAIWizardGenerate] Edge function error:', error);
        showErrorToast(error, { module: 'IA', action: 'gerar conteúdo visual' });
        return null;
      }

      if (!data?.success || !data?.generatedProps) {
        const errMsg = data?.error || 'A IA não retornou conteúdo';
        showErrorToast(new Error(errMsg), { module: 'IA', action: 'gerar conteúdo visual' });
        return null;
      }

      // Apply whitelist merge on the client side
      const merged = whitelistMerge(
        currentProps,
        data.generatedProps,
        contract,
        collectedData,
        blockType,
        mode,
      );

      toast.success('Conteúdo visual gerado com IA ✨', {
        description: 'Imagens e textos foram preenchidos. Use Ctrl+Z para desfazer.',
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
