import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type ConversationStatus = 'new' | 'open' | 'waiting_customer' | 'waiting_agent' | 'bot' | 'resolved' | 'spam';
export type SupportChannelType = 'whatsapp' | 'email' | 'facebook_messenger' | 'instagram_dm' | 'mercadolivre' | 'shopee' | 'tiktokshop' | 'chat';

export interface Conversation {
  id: string;
  tenant_id: string;
  channel_type: SupportChannelType;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_avatar_url: string | null;
  order_id: string | null;
  status: ConversationStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  first_response_at: string | null;
  last_message_at: string | null;
  message_count: number;
  unread_count: number;
  priority: number;
  tags: string[];
  subject: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationFilters {
  status?: ConversationStatus | ConversationStatus[];
  channel?: SupportChannelType;
  assignedTo?: string | 'unassigned' | 'me';
  search?: string;
}

export function useConversations(filters?: ConversationFilters) {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  const conversationsQuery = useQuery({
    queryKey: ['conversations', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('conversations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      // Filter by status
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      // Filter by channel
      if (filters?.channel) {
        query = query.eq('channel_type', filters.channel as any);
      }

      // Filter by assignment
      if (filters?.assignedTo === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (filters?.assignedTo === 'me' && user?.id) {
        query = query.eq('assigned_to', user.id);
      } else if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      // Search
      if (filters?.search) {
        query = query.or(`customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!currentTenant?.id,
  });

  const assignConversation = useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string | null }) => {
      const { error } = await supabase
        .from('conversations')
        .update({
          assigned_to: userId,
          assigned_at: userId ? new Date().toISOString() : null,
          status: userId ? 'open' : 'waiting_agent',
        })
        .eq('id', conversationId);

      if (error) throw error;

      // Log event
      await supabase.from('conversation_events').insert({
        conversation_id: conversationId,
        tenant_id: currentTenant?.id,
        event_type: userId ? 'assigned' : 'unassigned',
        actor_type: 'agent',
        actor_id: user?.id,
        new_value: { assigned_to: userId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa atribuída');
    },
    onError: (error) => {
      toast.error('Erro ao atribuir conversa');
      console.error(error);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ conversationId, status }: { conversationId: string; status: ConversationStatus }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversationId);

      if (error) throw error;

      await supabase.from('conversation_events').insert({
        conversation_id: conversationId,
        tenant_id: currentTenant?.id,
        event_type: 'status_changed',
        actor_type: 'agent',
        actor_id: user?.id,
        new_value: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status');
      console.error(error);
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Stats for dashboard
  const statsQuery = useQuery({
    queryKey: ['conversation-stats', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('conversations')
        .select('status, assigned_to')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      const stats = {
        needsAttention: 0,
        inProgress: 0,
        botActive: 0,
        resolvedToday: 0,
      };

      const today = new Date().toISOString().split('T')[0];

      data.forEach((c) => {
        if (c.status === 'new' || c.status === 'waiting_agent') {
          stats.needsAttention++;
        } else if (c.status === 'open' || c.status === 'waiting_customer') {
          stats.inProgress++;
        } else if (c.status === 'bot') {
          stats.botActive++;
        }
      });

      // Count resolved today
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'resolved')
        .gte('resolved_at', today);

      stats.resolvedToday = count || 0;

      return stats;
    },
    enabled: !!currentTenant?.id,
  });

  // Realtime subscription for conversations
  useEffect(() => {
    if (!currentTenant?.id) return;

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['conversation-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, queryClient]);

  return {
    conversations: conversationsQuery.data || [],
    isLoading: conversationsQuery.isLoading,
    error: conversationsQuery.error,
    refetch: conversationsQuery.refetch,
    assignConversation,
    updateStatus,
    markAsRead,
    stats: statsQuery.data,
  };
}
