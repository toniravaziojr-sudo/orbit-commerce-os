import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MeliOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  shipping_total: number;
  currency: string;
  created_at: string;
  marketplace_order_id: string | null;
  marketplace_data: any;
  customer: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface UseMeliOrdersParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useMeliOrders({ status, page = 1, pageSize = 20 }: UseMeliOrdersParams = {}) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["meli-orders", currentTenant?.id, status, page, pageSize],
    queryFn: async () => {
      if (!currentTenant?.id) {
        return { orders: [], total: 0 };
      }

      let query = supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          payment_status,
          total,
          subtotal,
          shipping_total,
          currency,
          created_at,
          marketplace_order_id,
          marketplace_data,
          customer:customers(id, name, email)
        `, { count: "exact" })
        .eq("tenant_id", currentTenant.id)
        .eq("marketplace_source", "mercadolivre")
        .order("created_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status as any);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        orders: (data || []) as unknown as MeliOrder[],
        total: count || 0,
      };
    },
    enabled: !!currentTenant?.id,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  // Mutation para sincronizar pedidos
  const syncMutation = useMutation({
    mutationFn: async (fullSync: boolean = false) => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meli-sync-orders", {
        body: { tenantId: currentTenant.id, fullSync },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao sincronizar");
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sincronização concluída: ${data.synced} pedidos`);
      queryClient.invalidateQueries({ queryKey: ["meli-orders"] });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao sincronizar pedidos");
    },
  });

  return {
    orders: ordersQuery.data?.orders || [],
    total: ordersQuery.data?.total || 0,
    isLoading: ordersQuery.isLoading,
    isError: ordersQuery.isError,
    refetch: ordersQuery.refetch,
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
