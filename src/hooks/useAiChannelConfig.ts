import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { SupportChannelType } from "@/hooks/useConversations";

export interface AiChannelConfig {
  id: string;
  tenant_id: string;
  channel_type: SupportChannelType;
  is_enabled: boolean;
  system_prompt_override: string | null;
  forbidden_topics: string[];
  max_response_length: number | null;
  use_emojis: boolean | null;
  custom_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export function useAiChannelConfig(channelType?: SupportChannelType) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const allConfigsQuery = useQuery({
    queryKey: ['ai-channel-configs', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('ai_channel_config')
        .select('*')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
      return data as AiChannelConfig[];
    },
    enabled: !!currentTenant?.id,
  });

  const singleConfigQuery = useQuery({
    queryKey: ['ai-channel-config', currentTenant?.id, channelType],
    queryFn: async () => {
      if (!currentTenant?.id || !channelType) return null;

      const { data, error } = await supabase
        .from('ai_channel_config')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('channel_type', channelType)
        .maybeSingle();

      if (error) throw error;
      return data as AiChannelConfig | null;
    },
    enabled: !!currentTenant?.id && !!channelType,
  });

  const upsertConfig = useMutation({
    mutationFn: async (input: {
      channel_type: SupportChannelType;
      is_enabled?: boolean;
      system_prompt_override?: string | null;
      forbidden_topics?: string[];
      max_response_length?: number | null;
      use_emojis?: boolean | null;
      custom_instructions?: string | null;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('ai_channel_config')
        .upsert({
          tenant_id: currentTenant.id,
          channel_type: input.channel_type,
          is_enabled: input.is_enabled ?? true,
          system_prompt_override: input.system_prompt_override,
          forbidden_topics: input.forbidden_topics || [],
          max_response_length: input.max_response_length,
          use_emojis: input.use_emojis,
          custom_instructions: input.custom_instructions,
        }, {
          onConflict: 'tenant_id,channel_type'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-channel-configs'] });
      queryClient.invalidateQueries({ queryKey: ['ai-channel-config'] });
      toast.success('Configuração de IA do canal salva');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar configuração');
      console.error(error);
    },
  });

  const getConfigForChannel = (type: SupportChannelType) => {
    return allConfigsQuery.data?.find(c => c.channel_type === type);
  };

  return {
    allConfigs: allConfigsQuery.data || [],
    config: singleConfigQuery.data,
    isLoading: allConfigsQuery.isLoading || singleConfigQuery.isLoading,
    upsertConfig,
    getConfigForChannel,
  };
}
