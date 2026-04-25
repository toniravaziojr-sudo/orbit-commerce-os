import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export type IntentObjectionType = 'intent' | 'objection';
export type IntentObjectionSeverity = 'low' | 'medium' | 'high' | null;

export interface AiIntentObjectionEntry {
  id: string;
  tenant_id: string;
  entry_type: IntentObjectionType;
  key: string;
  label: string;
  trigger_patterns: string[];
  recommended_state: string | null;
  standard_response: string | null;
  severity: IntentObjectionSeverity;
  product_scope: string[];
  is_active: boolean;
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

export function useAiIntentObjectionMap() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai-intent-objection-map', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('ai_intent_objection_map')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('entry_type', { ascending: true })
        .order('label', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as AiIntentObjectionEntry[];
    },
    enabled: !!currentTenant?.id,
  });

  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AiIntentObjectionEntry> }) => {
      const { data, error } = await supabase
        .from('ai_intent_objection_map')
        .update({
          ...updates,
          manual_overrides: { ...(updates as any).manual_overrides, edited_at: new Date().toISOString() },
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-intent-objection-map'] });
      toast.success('Entrada atualizada');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Erro ao atualizar entrada');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('ai_intent_objection_map')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-intent-objection-map'] });
    },
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');
      const { data, error } = await supabase.functions.invoke('ai-language-intent-generator', {
        body: { tenant_id: currentTenant.id, target: 'intent_objection' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-intent-objection-map'] });
      toast.success('Mapa regenerado pela IA');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Erro ao regenerar mapa');
    },
  });

  return {
    entries: query.data || [],
    isLoading: query.isLoading,
    update,
    toggleActive,
    regenerate,
  };
}
