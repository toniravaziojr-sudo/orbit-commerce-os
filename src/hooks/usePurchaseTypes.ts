import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface PurchaseType {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PurchaseTypeInsert = Omit<PurchaseType, 'id' | 'created_at' | 'updated_at'>;

export function usePurchaseTypes() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: purchaseTypes = [], isLoading, error } = useQuery({
    queryKey: ['purchase-types', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('purchase_types')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as PurchaseType[];
    },
    enabled: !!tenantId,
  });

  const createPurchaseType = useMutation({
    mutationFn: async (name: string) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      const { data, error } = await supabase
        .from('purchase_types')
        .insert({ name, tenant_id: tenantId, is_active: true })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-types', tenantId] });
      toast.success('Tipo de compra criado');
    },
    onError: (error) => {
      toast.error('Erro ao criar tipo: ' + error.message);
    },
  });

  const deletePurchaseType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('purchase_types')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-types', tenantId] });
      toast.success('Tipo de compra removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover tipo: ' + error.message);
    },
  });

  return {
    purchaseTypes,
    isLoading,
    error,
    createPurchaseType,
    deletePurchaseType,
  };
}
