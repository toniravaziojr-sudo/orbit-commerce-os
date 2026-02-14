import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CatalogItem {
  id: string;
  tenant_id: string;
  product_id: string;
  catalog_id: string;
  meta_product_id: string | null;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface MetaCatalog {
  id: string;
  name: string;
  product_count?: number;
}

export function useMetaCatalog() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // List catalogs from Meta
  const catalogsQuery = useQuery({
    queryKey: ["meta-catalogs", tenantId],
    queryFn: async (): Promise<MetaCatalog[]> => {
      const { data, error } = await supabase.functions.invoke("meta-catalog-create", {
        body: { tenantId, action: "list" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar catálogos");
      return data.data.catalogs || [];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // List catalog items (sync status)
  const catalogItemsQuery = useQuery({
    queryKey: ["meta-catalog-items", tenantId],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase
        .from("meta_catalog_items")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CatalogItem[];
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  // Create catalog
  const createCatalogMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke("meta-catalog-create", {
        body: { tenantId, action: "create", name },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar catálogo");
      return data.data.catalog;
    },
    onSuccess: (catalog) => {
      toast.success(`Catálogo "${catalog.name}" criado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["meta-catalogs"] });
      queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar catálogo");
    },
  });

  // Sync products to catalog
  const syncProductsMutation = useMutation({
    mutationFn: async ({ catalogId, productIds }: { catalogId: string; productIds?: string[] }) => {
      const { data, error } = await supabase.functions.invoke("meta-catalog-sync", {
        body: { tenantId, catalogId, productIds },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data.data;
    },
    onSuccess: (result) => {
      toast.success(`${result.synced} produto(s) sincronizado(s) com o catálogo Meta!`);
      if (result.failed > 0) {
        toast.warning(`${result.failed} produto(s) falharam na sincronização.`);
      }
      queryClient.invalidateQueries({ queryKey: ["meta-catalog-items"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro na sincronização");
    },
  });

  return {
    // Catalogs
    catalogs: catalogsQuery.data || [],
    isLoadingCatalogs: catalogsQuery.isLoading,

    // Catalog Items
    catalogItems: catalogItemsQuery.data || [],
    isLoadingItems: catalogItemsQuery.isLoading,

    // Actions
    createCatalog: createCatalogMutation.mutate,
    isCreating: createCatalogMutation.isPending,

    syncProducts: syncProductsMutation.mutate,
    isSyncing: syncProductsMutation.isPending,

    // Refresh
    refetchCatalogs: catalogsQuery.refetch,
    refetchItems: catalogItemsQuery.refetch,
  };
}
