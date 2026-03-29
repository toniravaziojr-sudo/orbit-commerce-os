// =============================================
// useBannerTextGenerate — Hook para gerar textos editáveis do banner separadamente
// v1.0.0: Geração de título, subtítulo e botão independente da imagem
// =============================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

interface BannerTextGenerateParams {
  tenantId: string;
}

interface BannerTextResult {
  title: string;
  subtitle: string;
  buttonText: string;
}

export function useBannerTextGenerate({ tenantId }: BannerTextGenerateParams) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTexts = useCallback(async (opts?: {
    /** Existing banner image URL for context */
    bannerImageUrl?: string;
    /** Product ID if associated */
    productId?: string;
    /** User's briefing for the text */
    briefing?: string;
  }): Promise<BannerTextResult | null> => {
    if (isGenerating) return null;
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-block-fill-visual', {
        body: {
          tenantId,
          blockType: 'Banner',
          mode: 'single',
          scope: 'texts-only',
          collectedData: {
            briefing: opts?.briefing || '',
            bannerImageUrl: opts?.bannerImageUrl || '',
            association: opts?.productId
              ? { associationType: 'product', productId: opts.productId }
              : { associationType: 'none' },
          },
        },
      });

      if (error) {
        console.error('[useBannerTextGenerate] Error:', error);
        showErrorToast(new Error(error.message || 'Erro ao gerar textos'), { module: 'IA', action: 'gerar textos do banner' });
        return null;
      }

      if (!data?.success || !data?.generatedProps) {
        showErrorToast(new Error(data?.error || 'A IA não retornou textos'), { module: 'IA', action: 'gerar textos do banner' });
        return null;
      }

      const props = data.generatedProps;
      toast.success('Textos gerados com IA ✨');

      return {
        title: props.title || '',
        subtitle: props.subtitle || '',
        buttonText: props.buttonText || '',
      };
    } catch (err) {
      console.error('[useBannerTextGenerate] Unexpected error:', err);
      showErrorToast(err, { module: 'IA', action: 'gerar textos do banner' });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating, tenantId]);

  return { generateTexts, isGenerating };
}