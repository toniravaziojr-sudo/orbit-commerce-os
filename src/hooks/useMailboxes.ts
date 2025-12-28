import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type EmailPurpose = 'notifications' | 'support' | 'manual';
export type MailboxStatus = 'pending_dns' | 'active' | 'error' | 'disabled';

export interface Mailbox {
  id: string;
  tenant_id: string;
  email_address: string;
  display_name: string | null;
  purpose: EmailPurpose;
  status: MailboxStatus;
  domain: string;
  dns_verified: boolean;
  dns_records: Record<string, unknown> | null;
  last_dns_check_at: string | null;
  resend_domain_id: string | null;
  sending_verified: boolean;
  unread_count: number;
  total_messages: number;
  last_received_at: string | null;
  last_sent_at: string | null;
  signature_html: string | null;
  auto_reply_enabled: boolean;
  auto_reply_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailFolder {
  id: string;
  mailbox_id: string;
  name: string;
  slug: string;
  icon: string | null;
  is_system: boolean;
  sort_order: number;
  unread_count: number;
  created_at: string;
}

export function useMailboxes() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const mailboxesQuery = useQuery({
    queryKey: ['mailboxes', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('mailboxes')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Mailbox[];
    },
    enabled: !!currentTenant?.id,
  });

  const createMailbox = useMutation({
    mutationFn: async (input: {
      email_address: string;
      display_name?: string;
      purpose?: EmailPurpose;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const domain = input.email_address.split('@')[1];
      
      const { data, error } = await supabase
        .from('mailboxes')
        .insert({
          tenant_id: currentTenant.id,
          email_address: input.email_address,
          display_name: input.display_name,
          purpose: input.purpose || 'manual',
          domain,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      toast.success('Caixa de email criada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar caixa de email');
      console.error(error);
    },
  });

  const updateMailbox = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; purpose?: EmailPurpose; status?: MailboxStatus; display_name?: string; signature_html?: string; auto_reply_enabled?: boolean; auto_reply_message?: string }) => {
      const { error } = await supabase
        .from('mailboxes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      toast.success('Caixa de email atualizada');
    },
  });

  const deleteMailbox = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mailboxes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      toast.success('Caixa de email removida');
    },
  });

  // Get mailbox by purpose
  const getMailboxByPurpose = (purpose: EmailPurpose) => {
    return mailboxesQuery.data?.find(m => m.purpose === purpose);
  };

  return {
    mailboxes: mailboxesQuery.data || [],
    isLoading: mailboxesQuery.isLoading,
    createMailbox,
    updateMailbox,
    deleteMailbox,
    getMailboxByPurpose,
    notificationsMailbox: getMailboxByPurpose('notifications'),
    supportMailbox: getMailboxByPurpose('support'),
  };
}

export function useMailboxFolders(mailboxId: string | null) {
  return useQuery({
    queryKey: ['email-folders', mailboxId],
    queryFn: async () => {
      if (!mailboxId) return [];

      const { data, error } = await supabase
        .from('email_folders')
        .select('*')
        .eq('mailbox_id', mailboxId)
        .order('sort_order');

      if (error) throw error;
      return data as EmailFolder[];
    },
    enabled: !!mailboxId,
  });
}
