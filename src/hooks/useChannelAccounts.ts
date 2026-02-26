import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { SupportChannelType } from "./useConversations";

export interface ChannelAccount {
  id: string;
  tenant_id: string;
  channel_type: SupportChannelType;
  account_name: string;
  external_account_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useChannelAccounts() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const channelsQuery = useQuery({
    queryKey: ['channel-accounts', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('channel_accounts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('channel_type');

      if (error) throw error;
      return data as ChannelAccount[];
    },
    enabled: !!currentTenant?.id,
  });

  const createChannel = useMutation({
    mutationFn: async (input: {
      channel_type: SupportChannelType;
      account_name: string;
      external_account_id?: string;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('channel_accounts')
        .insert({
          tenant_id: currentTenant.id,
          channel_type: input.channel_type as any,
          account_name: input.account_name,
          external_account_id: input.external_account_id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-accounts'] });
      toast.success('Canal adicionado');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar canal');
      console.error(error);
    },
  });

  const updateChannel = useMutation({
    mutationFn: async ({ id, is_active, account_name }: { id: string; is_active?: boolean; account_name?: string }) => {
      const updates: Record<string, unknown> = {};
      if (is_active !== undefined) updates.is_active = is_active;
      if (account_name !== undefined) updates.account_name = account_name;

      const { error } = await supabase
        .from('channel_accounts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-accounts'] });
      toast.success('Canal atualizado');
    },
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('channel_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-accounts'] });
      toast.success('Canal removido');
    },
  });

  // Helper to check if a channel type is configured
  const isChannelConfigured = (type: SupportChannelType) => {
    return channelsQuery.data?.some(c => c.channel_type === type && c.is_active);
  };

  return {
    channels: channelsQuery.data || [],
    isLoading: channelsQuery.isLoading,
    createChannel,
    updateChannel,
    deleteChannel,
    isChannelConfigured,
  };
}
