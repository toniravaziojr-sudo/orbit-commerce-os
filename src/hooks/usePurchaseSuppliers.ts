import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface PurchaseSupplier {
  id: string;
  tenant_id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  notes: string | null;
  is_active: boolean;
  supplier_type_id: string | null;
  created_at: string;
  updated_at: string;
}

export type PurchaseSupplierInsert = Omit<PurchaseSupplier, 'id' | 'created_at' | 'updated_at'>;
export type PurchaseSupplierUpdate = Partial<PurchaseSupplierInsert>;

export function usePurchaseSuppliers() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['purchase-suppliers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      
      if (error) throw error;
      return data as PurchaseSupplier[];
    },
    enabled: !!tenantId,
  });

  const createSupplier = useMutation({
    mutationFn: async (supplier: Omit<PurchaseSupplierInsert, 'tenant_id'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ ...supplier, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-suppliers', tenantId] });
      toast.success('Fornecedor cadastrado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar fornecedor: ' + error.message);
    },
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, ...updates }: PurchaseSupplierUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-suppliers', tenantId] });
      toast.success('Fornecedor atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar fornecedor: ' + error.message);
    },
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-suppliers', tenantId] });
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
