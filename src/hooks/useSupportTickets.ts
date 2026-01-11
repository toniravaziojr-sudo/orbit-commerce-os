import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { toast } from "sonner";

export interface SupportTicket {
  id: string;
  tenant_id: string;
  created_by: string;
  subject: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'pending' | 'closed';
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  // Joined data
  tenant_name?: string;
  messages_count?: number;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  tenant_id: string;
  sender_type: 'tenant' | 'platform';
  sender_user_id: string;
  content: string;
  created_at: string;
  // Joined data
  sender_name?: string;
  attachments?: SupportTicketAttachment[];
}

export interface SupportTicketAttachment {
  id: string;
  message_id: string;
  tenant_id: string;
  file_id: string | null;
  created_at: string;
  // Joined data
  file_name?: string;
  file_url?: string;
}

export interface CreateTicketData {
  subject: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  message: string;
}

export function useSupportTickets(statusFilter?: 'all' | 'open' | 'closed') {
  const { currentTenant, user } = useAuth();
  const { isPlatformOperator } = usePlatformOperator();
  const queryClient = useQueryClient();

  // Fetch tickets
  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['support-tickets', currentTenant?.id, isPlatformOperator, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          tenants:tenant_id(name)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      // Filter by status if specified
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'open') {
          query = query.in('status', ['open', 'pending']);
        } else {
          query = query.eq('status', 'closed');
        }
      }

      // Non-platform users only see their tenant's tickets
      if (!isPlatformOperator && currentTenant?.id) {
        query = query.eq('tenant_id', currentTenant.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(ticket => ({
        ...ticket,
        tenant_name: (ticket.tenants as any)?.name || 'Desconhecido',
      })) as SupportTicket[];
    },
    enabled: !!user,
  });

  // Create ticket mutation
  const createTicket = useMutation({
    mutationFn: async (data: CreateTicketData) => {
      if (!currentTenant?.id || !user?.id) {
        throw new Error('Usuário ou tenant não encontrado');
      }

      // Create the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          tenant_id: currentTenant.id,
          created_by: user.id,
          subject: data.subject,
          category: data.category,
          priority: data.priority,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create the initial message
      const { error: messageError } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticket.id,
          tenant_id: currentTenant.id,
          sender_type: 'tenant',
          sender_user_id: user.id,
          content: data.message,
        });

      if (messageError) throw messageError;

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Chamado criado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating ticket:', error);
      toast.error('Erro ao criar chamado');
    },
  });

  // Update ticket status
  const updateTicketStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: 'open' | 'pending' | 'closed' }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      console.error('Error updating ticket:', error);
      toast.error('Erro ao atualizar status');
    },
  });

  return {
    tickets,
    isLoading,
    error,
    createTicket,
    updateTicketStatus,
  };
}

export function useSupportTicketMessages(ticketId: string | null) {
  const { user } = useAuth();
  const { isPlatformOperator } = usePlatformOperator();
  const queryClient = useQueryClient();

  // Fetch messages for a ticket
  const { data: messages, isLoading } = useQuery({
    queryKey: ['support-ticket-messages', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];

      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select(`
          *,
          profiles:sender_user_id(full_name)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(msg => ({
        ...msg,
        sender_name: (msg.profiles as any)?.full_name || 'Usuário',
      })) as SupportTicketMessage[];
    },
    enabled: !!ticketId && !!user,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: string; content: string }) => {
      // Get ticket to get tenant_id
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .select('tenant_id')
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      const senderType = isPlatformOperator ? 'platform' : 'tenant';

      const { data: message, error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId,
          tenant_id: ticket.tenant_id,
          sender_type: senderType,
          sender_user_id: user!.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Update ticket last_message_at
      await supabase
        .from('support_tickets')
        .update({ 
          last_message_at: new Date().toISOString(),
          status: isPlatformOperator ? 'pending' : 'open',
        })
        .eq('id', ticketId);

      return message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket-messages', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    },
  });

  return {
    messages,
    isLoading,
    sendMessage,
  };
}
