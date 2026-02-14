import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MerchantProductSync {
  id: string;
  productId: string;
  merchantAccountId: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastError: string | null;
  disapprovalReasons: any[] | null;
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

export function useMerchantSync(merchantAccountId?: string) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["merchant-summary", currentTenant?.id, merchantAccountId],
    queryFn: async (): Promise<MerchantSummary> => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase.functions.invoke("google-merchant-status", {
        body: { tenantId: currentTenant.id, merchantAccountId, action: "summary" },
      });

      if (error || !data?.success) throw new Error(data?.error || "Erro ao buscar resumo");
      return data.summary;
    },
    enabled: !!currentTenant?.id,
    staleTime: 60000,
  });

  const syncProductsMutation = useMutation({
    mutationFn: async (productIds?: string[]) => {
      if (!currentTenant?.id || !merchantAccountId) throw new Error("Dados insuficientes");

      const { data, error } = await supabase.functions.invoke("google-merchant-sync", {
        body: { tenantId: currentTenant.id, merchantAccountId, productIds, action: "sync" },
      });

      if (error || !data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sincronizado: ${data.synced} produtos (${data.errors} erros)`);
      queryClient.invalidateQueries({ queryKey: ["merchant-summary"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const checkStatusesMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !merchantAccountId) throw new Error("Dados insuficientes");

      const { data, error } = await supabase.functions.invoke("google-merchant-status", {
        body: { tenantId: currentTenant.id, merchantAccountId, action: "check_statuses" },
      });

      if (error || !data?.success) throw new Error(data?.error || "Erro ao verificar status");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Status atualizado para ${data.updated} produtos`);
      queryClient.invalidateQueries({ queryKey: ["merchant-summary"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProductsMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      if (!currentTenant?.id || !merchantAccountId) throw new Error("Dados insuficientes");

      const { data, error } = await supabase.functions.invoke("google-merchant-sync", {
        body: { tenantId: currentTenant.id, merchantAccountId, productIds, action: "delete" },
      });

      if (error || !data?.success) throw new Error(data?.error || "Erro ao remover");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} produtos removidos do Merchant Center`);
      queryClient.invalidateQueries({ queryKey: ["merchant-summary"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    summary: summaryQuery.data,
    isLoadingSummary: summaryQuery.isLoading,
    syncProducts: syncProductsMutation.mutate,
    isSyncing: syncProductsMutation.isPending,
    checkStatuses: checkStatusesMutation.mutate,
    isCheckingStatuses: checkStatusesMutation.isPending,
    deleteProducts: deleteProductsMutation.mutate,
    isDeleting: deleteProductsMutation.isPending,
  };
}
