import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { PurchaseSupplier } from "./usePurchaseSuppliers";

// Re-export for backward compatibility
export type Supplier = PurchaseSupplier;
export interface Purchase {
  id: string;
  tenant_id: string;
  supplier_id: string | null;
  order_number: string;
  description: string | null;
  status: 'pending' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';
  total_value: number;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  notes: string | null;
  entry_invoice_id: string | null;
  purchase_type_id: string | null;
  created_at: string;
  updated_at: string;
  supplier?: PurchaseSupplier;
  entry_invoice?: {
    id: string;
    numero: number;
    dest_nome: string | null;
  } | null;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  tenant_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export type PurchaseInsert = Omit<Purchase, 'id' | 'created_at' | 'updated_at' | 'supplier'>;
export type PurchaseUpdate = Partial<PurchaseInsert>;

export const PURCHASE_STATUS_LABELS: Record<Purchase['status'], string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_transit: 'Em Trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const PURCHASE_STATUS_COLORS: Record<Purchase['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function usePurchases() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: purchases = [], isLoading, error } = useQuery({
    queryKey: ['purchases', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('purchases')
        .select(`*, supplier:suppliers(*), entry_invoice:fiscal_invoices(id, numero, dest_nome)`)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!tenantId,
  });

  const createPurchase = useMutation({
    mutationFn: async (purchase: Omit<PurchaseInsert, 'tenant_id' | 'order_number'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      // Generate order number
      const orderNumber = `PC-${Date.now().toString(36).toUpperCase()}`;
      
      const { data, error } = await supabase
        .from('purchases')
        .insert({ ...purchase, tenant_id: tenantId, order_number: orderNumber })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', tenantId] });
      toast.success('Pedido de compra criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar pedido de compra: ' + error.message);
    },
  });

  const updatePurchase = useMutation({
    mutationFn: async ({ id, ...updates }: PurchaseUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('purchases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', tenantId] });
      toast.success('Pedido de compra atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar pedido de compra: ' + error.message);
    },
  });

  const deletePurchase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases', tenantId] });
      toast.success('Pedido de compra removido com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao remover pedido de compra: ' + error.message);
    },
  });

  // Stats
  const pendingCount = purchases.filter(p => p.status === 'pending' || p.status === 'confirmed').length;
  const inTransitCount = purchases.filter(p => p.status === 'in_transit').length;
  const deliveredThisMonth = purchases.filter(p => {
    if (p.status !== 'delivered' || !p.actual_delivery_date) return false;
    const deliveryDate = new Date(p.actual_delivery_date);
    const now = new Date();
    return deliveryDate.getMonth() === now.getMonth() && deliveryDate.getFullYear() === now.getFullYear();
  }).length;

  return {
    purchases,
    isLoading,
    error,
    createPurchase,
    updatePurchase,
    deletePurchase,
    pendingCount,
    inTransitCount,
    deliveredThisMonth,
  };
}
