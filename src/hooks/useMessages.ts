import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type MessageDirection = 'inbound' | 'outbound';
export type MessageSenderType = 'customer' | 'agent' | 'bot' | 'system';
export type MessageDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  conversation_id: string;
  tenant_id: string;
  direction: MessageDirection;
  sender_type: MessageSenderType;
  sender_id: string | null;
  sender_name: string | null;
  content: string | null;
  content_type: string;
  delivery_status: MessageDeliveryStatus;
  is_ai_generated: boolean;
  is_internal: boolean;
  is_note: boolean;
  created_at: string;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  file_name: string;
  file_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
}

export function useMessages(conversationId: string | null) {
  const { currentTenant, user, profile } = useAuth();
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          attachments:message_attachments(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
  });

  const sendMessage = useMutation({
    mutationFn: async ({
      content,
      contentType = 'text',
      isInternal = false,
      isNote = false,
    }: {
      content: string;
      contentType?: string;
      isInternal?: boolean;
      isNote?: boolean;
    }) => {
      if (!conversationId || !currentTenant?.id) {
        throw new Error('Missing conversation or tenant');
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          tenant_id: currentTenant.id,
          direction: 'outbound',
          sender_type: 'agent',
          sender_id: user?.id,
          sender_name: profile?.full_name || user?.email,
          content,
          content_type: contentType,
          delivery_status: isInternal || isNote ? 'delivered' : 'queued',
          is_internal: isInternal,
          is_note: isNote,
        })
        .select()
        .single();

      if (error) throw error;

      // If not internal/note, trigger actual send via channel
      if (!isInternal && !isNote) {
        // Get conversation to determine channel
        const { data: conv } = await supabase
          .from('conversations')
          .select('channel_type')
          .eq('id', conversationId)
          .single();

        if (conv) {
          // Send via channel (WhatsApp, Email, etc.)
          supabase.functions.invoke('support-send-message', {
            body: {
              message_id: data.id,
              channel_type: conv.channel_type,
            },
          }).catch(err => {
            console.error('Error sending message via channel:', err);
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      toast.error('Erro ao enviar mensagem');
      console.error(error);
    },
  });

  const sendAiResponse = useMutation({
    mutationFn: async () => {
      if (!conversationId || !currentTenant?.id) {
        throw new Error('Missing conversation or tenant');
      }

      const { data, error } = await supabase.functions.invoke('ai-support-chat', {
        body: {
          conversation_id: conversationId,
          tenant_id: currentTenant.id,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Resposta da IA enviada');
    },
    onError: (error) => {
      toast.error('Erro ao gerar resposta da IA');
      console.error(error);
    },
  });

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    refetch: messagesQuery.refetch,
    sendMessage,
    sendAiResponse,
  };
}
