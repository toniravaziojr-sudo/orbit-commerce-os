import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect } from "react";

export interface EmailMessage {
  id: string;
  mailbox_id: string;
  folder_id: string;
  tenant_id: string;
  external_message_id: string | null;
  in_reply_to: string | null;
  thread_id: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: { email: string; name?: string }[];
  cc_emails: { email: string; name?: string }[];
  bcc_emails: { email: string; name?: string }[];
  reply_to: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  is_sent: boolean;
  has_attachments: boolean;
  attachment_count: number;
  labels: string[];
  received_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailAttachment {
  id: string;
  message_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  content_id: string | null;
  is_inline: boolean;
  created_at: string;
}

export function useEmailMessages(mailboxId: string | null, folderId: string | null) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['email-messages', mailboxId, folderId],
    queryFn: async () => {
      if (!mailboxId || !folderId) return [];

      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('mailbox_id', mailboxId)
        .eq('folder_id', folderId)
        .order('received_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmailMessage[];
    },
    enabled: !!mailboxId && !!folderId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!mailboxId) return;

    const channel = supabase
      .channel(`email-messages-${mailboxId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_messages',
          filter: `mailbox_id=eq.${mailboxId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['email-messages', mailboxId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mailboxId, queryClient]);

  return messagesQuery;
}

export function useEmailMessage(messageId: string | null) {
  return useQuery({
    queryKey: ['email-message', messageId],
    queryFn: async () => {
      if (!messageId) return null;

      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (error) throw error;
      return data as EmailMessage;
    },
    enabled: !!messageId,
  });
}

export function useEmailAttachments(messageId: string | null) {
  return useQuery({
    queryKey: ['email-attachments', messageId],
    queryFn: async () => {
      if (!messageId) return [];

      const { data, error } = await supabase
        .from('email_attachments')
        .select('*')
        .eq('message_id', messageId)
        .order('created_at');

      if (error) throw error;
      return data as EmailAttachment[];
    },
    enabled: !!messageId,
  });
}

export function useEmailActions() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const markAsRead = useMutation({
    mutationFn: async ({ messageId, isRead }: { messageId: string; isRead: boolean }) => {
      // First get the message to find mailbox_id and folder_id
      const { data: message, error: fetchError } = await supabase
        .from('email_messages')
        .select('mailbox_id, folder_id, is_read')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;
      
      // Only update if state is actually changing
      if (message.is_read === isRead) return;

      // Update the message
      const { error } = await supabase
        .from('email_messages')
        .update({ is_read: isRead })
        .eq('id', messageId);

      if (error) throw error;

      // Update unread count on folder (decrement if marking as read, increment if marking as unread)
      const delta = isRead ? -1 : 1;
      
      const { data: folder } = await supabase
        .from('email_folders')
        .select('unread_count')
        .eq('id', message.folder_id)
        .single();
      
      if (folder) {
        await supabase
          .from('email_folders')
          .update({ unread_count: Math.max(0, (folder.unread_count || 0) + delta) })
          .eq('id', message.folder_id);
      }

      // Update unread count on mailbox
      const { data: mailbox } = await supabase
        .from('mailboxes')
        .select('unread_count')
        .eq('id', message.mailbox_id)
        .single();
      
      if (mailbox) {
        await supabase
          .from('mailboxes')
          .update({ unread_count: Math.max(0, (mailbox.unread_count || 0) + delta) })
          .eq('id', message.mailbox_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      queryClient.invalidateQueries({ queryKey: ['email-folders'] });
    },
  });

  const toggleStar = useMutation({
    mutationFn: async ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) => {
      const { error } = await supabase
        .from('email_messages')
        .update({ is_starred: isStarred })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
    },
  });

  const moveToFolder = useMutation({
    mutationFn: async ({ messageId, folderId }: { messageId: string; folderId: string }) => {
      const { error } = await supabase
        .from('email_messages')
        .update({ folder_id: folderId })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      toast.success('Email movido');
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from('email_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      toast.success('Email excluído');
    },
  });

  const sendEmail = useMutation({
    mutationFn: async (input: {
      mailbox_id: string;
      to_emails: { email: string; name?: string }[];
      cc_emails?: { email: string; name?: string }[];
      subject: string;
      body_html: string;
      in_reply_to?: string;
      attachments?: { filename: string; content_type: string; size_bytes: number; storage_path: string }[];
    }) => {
      const { data, error } = await supabase.functions.invoke('email-send', {
        body: input,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      toast.success('Email enviado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao enviar email');
      console.error(error);
    },
  });

  return {
    markAsRead,
    toggleStar,
    moveToFolder,
    deleteMessage,
    sendEmail,
  };
}
