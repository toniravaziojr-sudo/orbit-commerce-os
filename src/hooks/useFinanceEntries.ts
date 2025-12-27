import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface FinanceEntry {
  id: string;
  tenant_id: string;
  type: 'income' | 'expense';
  source: 'order' | 'manual';
  source_id: string | null;
  description: string;
  amount: number;
  category: string | null;
  entry_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FinanceEntryInsert = Omit<FinanceEntry, 'id' | 'created_at' | 'updated_at'>;
export type FinanceEntryUpdate = Partial<FinanceEntryInsert>;

export const FINANCE_CATEGORIES = {
  income: ['Vendas', 'Serviços', 'Outros'],
  expense: ['Fornecedores', 'Salários', 'Aluguel', 'Marketing', 'Impostos', 'Outros'],
};

export function useFinanceEntries() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['finance-entries', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('finance_entries')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('entry_date', { ascending: false });
      
      if (error) throw error;
      return data as FinanceEntry[];
    },
    enabled: !!tenantId,
  });

  // Also fetch orders to auto-import as income
  const { data: orders = [] } = useQuery({
    queryKey: ['orders-for-finance', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, payment_status, created_at')
        .eq('tenant_id', tenantId)
        .eq('payment_status', 'approved')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createEntry = useMutation({
    mutationFn: async (entry: Omit<FinanceEntryInsert, 'tenant_id'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('finance_entries')
        .insert({ ...entry, tenant_id: tenantId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-entries', tenantId] });
      toast.success('Lançamento criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar lançamento: ' + error.message);
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...updates }: FinanceEntryUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('finance_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-entries', tenantId] });
      toast.success('Lançamento atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar lançamento: ' + error.message);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finance_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-entries', tenantId] });
      toast.success('Lançamento removido com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao remover lançamento: ' + error.message);
    },
  });

  // Calculate totals
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthEntries = entries.filter(e => {
    const date = new Date(e.entry_date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  // Manual entries from finance_entries
  const manualIncome = thisMonthEntries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const manualExpense = thisMonthEntries
    .filter(e => e.type === 'expense')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Auto income from paid orders
  const ordersThisMonth = orders.filter(o => {
    const date = new Date(o.created_at);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const ordersIncome = ordersThisMonth.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalIncome = manualIncome + ordersIncome;
  const totalExpense = manualExpense;
  const netProfit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0';

  return {
    entries,
    orders,
    isLoading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    totalIncome,
    totalExpense,
    netProfit,
    margin,
    ordersIncome,
  };
}
