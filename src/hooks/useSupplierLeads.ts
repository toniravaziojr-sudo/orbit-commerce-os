import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface SupplierLead {
  id: string;
  tenant_id: string;
  name: string;
  website_url: string | null;
  category: string | null;
  location: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_person: string | null;
  status: string;
  moq: string | null;
  lead_time_days: number | null;
  price_notes: string | null;
  tags: string[];
  notes: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SupplierLeadInsert = Omit<SupplierLead, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>;
export type SupplierLeadUpdate = Partial<SupplierLeadInsert>;

export function useSupplierLeads() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['supplier-leads', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('supplier_leads')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        tags: Array.isArray(item.tags) ? item.tags : []
      })) as SupplierLead[];
    },
    enabled: !!tenantId,
  });

  const createSupplier = useMutation({
    mutationFn: async (supplier: SupplierLeadInsert) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('supplier_leads')
        .insert({ ...supplier, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-leads', tenantId] });
      toast.success('Fornecedor adicionado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar fornecedor: ' + error.message);
    },
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, ...updates }: SupplierLeadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('supplier_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-leads', tenantId] });
      toast.success('Fornecedor atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar fornecedor: ' + error.message);
    },
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-leads', tenantId] });
      toast.success('Fornecedor removido com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao remover fornecedor: ' + error.message);
    },
  });

  return {
    suppliers,
    isLoading,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
}
