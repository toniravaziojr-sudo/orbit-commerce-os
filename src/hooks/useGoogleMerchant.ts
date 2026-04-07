import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

export interface MerchantProductSync {
  id: string;
  tenant_id: string;
  product_id: string;
  merchant_account_id: string;
  merchant_product_id: string | null;
  sync_status: string;
  last_sync_at: string | null;
  last_error: string | null;
  disapproval_reasons: any[] | null;
  synced_data_hash: string | null;
}

export interface MerchantSummary {
  total: number;
  synced: number;
  pending: number;
  error: number;
  disapproved: number;
  pending_review: number;
  accounts: string[];
}

export function useGoogleMerchant() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const summaryQuery = useQuery({
    queryKey: ["google-merchant-summary", tenantId],
    queryFn: async (): Promise<MerchantSummary> => {
      const { data, error } = await supabase.functions.invoke("google-merchant-status", {
        body: { tenantId, action: "summary" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao buscar resumo");
      return data.summary;
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  const productsQuery = useQuery({
    queryKey: ["google-merchant-products", tenantId],
    queryFn: async (): Promise<MerchantProductSync[]> => {
      const { data, error } = await supabase
        .from("google_merchant_products" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("last_sync_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any as MerchantProductSync[];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  const syncProducts = useMutation({
    mutationFn: async (params?: { merchantAccountId: string; productIds?: string[] }) => {
      if (!params?.merchantAccountId) throw new Error("merchantAccountId obrigatório");
      const { data, error } = await supabase.functions.invoke("google-merchant-sync", {
        body: { tenantId, merchantAccountId: params.merchantAccountId, productIds: params.productIds, action: "sync" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} produto(s) sincronizado(s) com Google Shopping`);
      queryClient.invalidateQueries({ queryKey: ["google-merchant-summary"] });
      queryClient.invalidateQueries({ queryKey: ["google-merchant-products"] });
    },
    onError: (err) => showErrorToast(err, { module: 'merchant', action: 'sincronizar' }),
  });

  const checkStatuses = useMutation({
    mutationFn: async (merchantAccountId: string) => {
      const { data, error } = await supabase.functions.invoke("google-merchant-status", {
        body: { tenantId, merchantAccountId, action: "check_statuses" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao verificar status");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} status atualizado(s)`);
      queryClient.invalidateQueries({ queryKey: ["google-merchant-summary"] });
      queryClient.invalidateQueries({ queryKey: ["google-merchant-products"] });
    },
    onError: (err) => showErrorToast(err, { module: 'merchant', action: 'verificar' }),
  });

  const deleteProducts = useMutation({
    mutationFn: async (params: { merchantAccountId: string; productIds: string[] }) => {
      const { data, error } = await supabase.functions.invoke("google-merchant-sync", {
        body: { tenantId, merchantAccountId: params.merchantAccountId, productIds: params.productIds, action: "delete" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao remover");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} produto(s) removido(s) do Google Shopping`);
      queryClient.invalidateQueries({ queryKey: ["google-merchant-summary"] });
      queryClient.invalidateQueries({ queryKey: ["google-merchant-products"] });
    },
    onError: (err) => showErrorToast(err, { module: 'merchant', action: 'remover' }),
  });

  return {
    summary: summaryQuery.data || null,
    summaryLoading: summaryQuery.isLoading,
    products: productsQuery.data || [],
    productsLoading: productsQuery.isLoading,
    syncProducts,
    checkStatuses,
    deleteProducts,
    isSyncing: syncProducts.isPending,
    isCheckingStatuses: checkStatuses.isPending,
  };
}
