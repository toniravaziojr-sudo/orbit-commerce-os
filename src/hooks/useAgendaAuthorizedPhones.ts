import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AuthorizedPhone {
  id: string;
  tenant_id: string;
  phone: string;
  is_active: boolean;
  label: string | null;
  configured_by: string;
  created_at: string;
}

export function useAgendaAuthorizedPhones() {
  const { currentTenant, user } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: phones = [], isLoading } = useQuery({
    queryKey: ['agenda-authorized-phones', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('agenda_authorized_phones')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as AuthorizedPhone[];
    },
    enabled: !!tenantId,
  });

  const addPhone = useMutation({
    mutationFn: async ({ phone, label }: { phone: string; label?: string }) => {
      if (!tenantId || !user?.id) throw new Error('Não autenticado');
      
      // Normalize phone: remove non-digits
      const normalized = phone.replace(/\D/g, '');
      if (normalized.length < 12 || normalized.length > 13) {
        throw new Error('Número inválido. Use formato: 5511999999999');
      }

      const { data, error } = await supabase
        .from('agenda_authorized_phones')
        .insert({
          tenant_id: tenantId,
          phone: normalized,
          label: label || null,
          configured_by: user.id,
        })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') throw new Error('Este número já está cadastrado');
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-authorized-phones', tenantId] });
      toast.success('Número autorizado adicionado');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao adicionar número');
    },
  });

  const removePhone = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase
        .from('agenda_authorized_phones')
        .delete()
        .eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-authorized-phones', tenantId] });
      toast.success('Número removido');
    },
    onError: () => {
      toast.error('Erro ao remover número');
    },
  });

  const togglePhone = useMutation({
    mutationFn: async ({ phoneId, isActive }: { phoneId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('agenda_authorized_phones')
        .update({ is_active: isActive })
        .eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-authorized-phones', tenantId] });
    },
  });

  return {
    phones,
    isLoading,
    addPhone,
    removePhone,
    togglePhone,
    activePhones: phones.filter(p => p.is_active),
  };
}
