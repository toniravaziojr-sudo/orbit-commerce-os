import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface AIRule {
  id: string;
  condition: string;
  action: 'respond' | 'transfer' | 'escalate' | 'suggest';
  response?: string;
  priority: number;
  is_active: boolean;
  category: string;
}

export interface AiSupportConfig {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  personality_name: string;
  personality_tone: 'formal' | 'friendly' | 'casual';
  use_emojis: boolean;
  system_prompt: string | null;
  custom_knowledge: string | null;
  auto_import_products: boolean;
  auto_import_categories: boolean;
  auto_import_policies: boolean;
  auto_import_faqs: boolean;
  max_messages_before_handoff: number;
  handoff_keywords: string[];
  operating_hours: Json;
  out_of_hours_message: string | null;
  handle_images: boolean;
  handle_audio: boolean;
  handle_files: boolean;
  image_analysis_prompt: string | null;
  approval_mode: boolean;
  max_response_length: number;
  forbidden_topics: string[];
  ai_model: string;
  target_first_response_seconds: number;
  target_resolution_minutes: number;
  rules: AIRule[];
  created_at: string;
  updated_at: string;
}

export function useAiSupportConfig() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ['ai-support-config', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('ai_support_config')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      
      // Transform rules from Json to AIRule[]
      if (data) {
        return {
          ...data,
          rules: Array.isArray(data.rules) ? (data.rules as unknown as AIRule[]) : [],
        } as AiSupportConfig;
      }
      return null;
    },
    enabled: !!currentTenant?.id,
  });

  const upsertConfig = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Check if config exists
      const { data: existing } = await supabase
        .from('ai_support_config')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (existing) {
        const { data: result, error } = await supabase
          .from('ai_support_config')
          .update(updates)
          .eq('tenant_id', currentTenant.id)
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from('ai_support_config')
          .insert({ tenant_id: currentTenant.id, ...updates })
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-support-config'] });
      toast.success('Configuração salva');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configuração');
      console.error(error);
    },
  });

  return {
    config: configQuery.data,
    isLoading: configQuery.isLoading,
    upsertConfig,
  };
}
