// =============================================
// useAIBlockFill — Hook para preenchimento de blocos por IA
// Fase 2.3: Integração frontend com edge function ai-block-fill
// =============================================

import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BlockPropsSchema, AIFillableConfig } from '@/lib/builder/types';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

interface UseAIBlockFillParams {
  tenantId: string;
  blockType: string;
  currentProps: Record<string, unknown>;
  propsSchema: BlockPropsSchema;
  pageContext?: {
    pageName?: string;
    pageType?: string;
    pageDescription?: string;
  };
}

interface UseAIBlockFillReturn {
  /** Chama a edge function e retorna as props preenchidas (já com merge fill-empty aplicado) ou null em caso de erro */
  fill: () => Promise<Record<string, unknown> | null>;
  /** True enquanto a IA está gerando conteúdo */
  isLoading: boolean;
  /** True se o bloco tem pelo menos 1 prop com aiFillable */
  hasFillableProps: boolean;
}

/**
 * Extrai do propsSchema apenas os campos que possuem aiFillable,
 * montando o fillableSchema no formato esperado pela edge function.
 */
function extractFillableSchema(
  propsSchema: BlockPropsSchema
): Record<string, AIFillableConfig> {
  const result: Record<string, AIFillableConfig> = {};
  for (const [key, schema] of Object.entries(propsSchema)) {
    if (schema.aiFillable) {
      result[key] = schema.aiFillable;
    }
  }
  return result;
}

/**
 * Aplica merge fill-empty: só preenche campos que estão vazios ou com valor default.
 * Campos já editados pelo usuário são preservados.
 */
function mergeFilledProps(
  currentProps: Record<string, unknown>,
  filledProps: Record<string, unknown>,
  propsSchema: BlockPropsSchema
): Record<string, unknown> {
  const merged = { ...currentProps };

  for (const [key, value] of Object.entries(filledProps)) {
    const current = currentProps[key];
    const defaultValue = propsSchema[key]?.defaultValue;

    // Check if current value is "empty" (should be filled)
    const isEmptyScalar =
      current === undefined ||
      current === null ||
      current === '' ||
      current === defaultValue;

    const isEmptyArray =
      Array.isArray(current) && current.length === 0;

    if (isEmptyScalar || isEmptyArray) {
      merged[key] = value;
    }
  }

  return merged;
}

export function useAIBlockFill({
  tenantId,
  blockType,
  currentProps,
  propsSchema,
  pageContext,
}: UseAIBlockFillParams): UseAIBlockFillReturn {
  const [isLoading, setIsLoading] = useState(false);

  const fillableSchema = useMemo(
    () => extractFillableSchema(propsSchema),
    [propsSchema]
  );

  const hasFillableProps = useMemo(
    () => Object.keys(fillableSchema).length > 0,
    [fillableSchema]
  );

  const fill = async (): Promise<Record<string, unknown> | null> => {
    if (isLoading) return null; // Prevent double-click
    if (!hasFillableProps) return null;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-block-fill', {
        body: {
          tenantId,
          blockType,
          currentProps,
          fillableSchema,
          pageContext,
        },
      });

      if (error) {
        console.error('[useAIBlockFill] Edge function error:', error);
        onError: (error) => showErrorToast(error, { module: 'IA', action: 'gerar conteúdo' }),
        return null;
      }

      if (!data?.success || !data?.filledProps) {
        const errMsg = data?.error || 'A IA não retornou conteúdo';
        showErrorToast(new Error(errMsg), { module: 'IA', action: 'gerar conteúdo' });
        return null;
      }

      // Apply fill-empty merge
      const merged = mergeFilledProps(currentProps, data.filledProps, propsSchema);

      toast.success('Conteúdo gerado com IA ✨', {
        description: 'Apenas campos vazios foram preenchidos. Use Ctrl+Z para desfazer.',
      });

      return merged;
    } catch (err) {
      console.error('[useAIBlockFill] Unexpected error:', err);
      onError: (err) => showErrorToast(err, { module: 'IA', action: 'gerar conteúdo' }),
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fill, isLoading, hasFillableProps };
}
