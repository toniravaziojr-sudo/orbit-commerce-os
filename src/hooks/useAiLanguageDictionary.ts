import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface AiLanguageDictionary {
  id: string;
  tenant_id: string;
  tone_style: string;
  treatment_pronoun: string;
  use_emojis: boolean;
  emoji_whitelist: string[];
  niche_vocabulary: Record<string, string>;
  product_aliases: Record<string, string>;
  forbidden_terms: string[];
  preferred_phrases: Record<string, string>;
  confidence_score: number | null;
  confidence_level: string | null;
  source: string;
  manual_overrides: Json;
  has_manual_overrides: boolean;
  needs_regeneration: boolean;
  model_used: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useAiLanguageDictionary() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai-language-dictionary', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from('ai_language_dictionary')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        niche_vocabulary: (data.niche_vocabulary as Record<string, string>) || {},
        product_aliases: (data.product_aliases as Record<string, string>) || {},
        preferred_phrases: (data.preferred_phrases as Record<string, string>) || {},
      } as AiLanguageDictionary;
    },
    enabled: !!currentTenant?.id,
  });

  const upsert = useMutation({
    mutationFn: async (updates: Partial<AiLanguageDictionary>) => {
      if (!currentTenant?.id) throw new Error('No tenant');
      const payload = {
        tenant_id: currentTenant.id,
        ...updates,
        manual_overrides: { ...(updates as any).manual_overrides, edited_at: new Date().toISOString() },
      };
      const { data: existing } = await supabase
        .from('ai_language_dictionary')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('ai_language_dictionary')
          .update(payload)
          .eq('tenant_id', currentTenant.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('ai_language_dictionary')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-language-dictionary'] });
      toast.success('Dicionário de linguagem salvo');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Erro ao salvar dicionário');
    },
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase.functions.invoke('ai-language-intent-generator', {
        body: { tenant_id: currentTenant.id, target: 'language' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-language-dictionary'] });
      toast.success('Dicionário regenerado pela IA');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Erro ao regenerar dicionário');
    },
  });

  return {
    dictionary: query.data,
    isLoading: query.isLoading,
    upsert,
    regenerate,
  };
}
