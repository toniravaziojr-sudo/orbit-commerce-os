import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface FinanceEntryType {
  id: string;
  tenant_id: string;
  entry_type: 'income' | 'expense';
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FinanceEntryTypeInsert = Omit<FinanceEntryType, 'id' | 'created_at' | 'updated_at'>;

export function useFinanceEntryTypes() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: financeEntryTypes = [], isLoading, error } = useQuery({
    queryKey: ['finance-entry-types', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('finance_entry_types')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as FinanceEntryType[];
    },
    enabled: !!tenantId,
  });

  const incomeTypes = financeEntryTypes.filter(t => t.entry_type === 'income');
  const expenseTypes = financeEntryTypes.filter(t => t.entry_type === 'expense');

  const createFinanceEntryType = useMutation({
    mutationFn: async ({ name, entryType }: { name: string; entryType: 'income' | 'expense' }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('finance_entry_types')
        .insert({ name, entry_type: entryType, tenant_id: tenantId, is_active: true })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-entry-types', tenantId] });
      toast.success('Tipo de lançamento criado');
    },
    onError: (error) => {
      toast.error('Erro ao criar tipo: ' + error.message);
    },
  });

  const deleteFinanceEntryType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finance_entry_types')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-entry-types', tenantId] });
      toast.success('Tipo de lançamento removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover tipo: ' + error.message);
    },
  });

  return {
    financeEntryTypes,
    incomeTypes,
    expenseTypes,
    isLoading,
    error,
    createFinanceEntryType,
    deleteFinanceEntryType,
  };
}
