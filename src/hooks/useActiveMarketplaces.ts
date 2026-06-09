// =============================================
// USE ACTIVE MARKETPLACES
// Fonte única de verdade: quais marketplaces têm conexão ativa para o tenant.
// Usado pelo Dashboard da Central de Comando para decidir quais sub-abas exibir.
// =============================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MarketplaceKey = "mercadolivre" | "shopee" | "tiktok_shop";

export interface ActiveMarketplacesMap {
  mercadolivre: boolean;
  shopee: boolean;
  tiktok_shop: boolean;
}

const EMPTY: ActiveMarketplacesMap = {
  mercadolivre: false,
  shopee: false,
  tiktok_shop: false,
};

export function useActiveMarketplaces() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ["active-marketplaces", currentTenant?.id],
    queryFn: async (): Promise<ActiveMarketplacesMap> => {
      if (!currentTenant?.id) return EMPTY;

      const { data, error } = await supabase
        .from("marketplace_connections")
        .select("marketplace, is_active")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true);

      if (error) {
        console.warn("[useActiveMarketplaces] failed", error);
        return EMPTY;
      }

      const map: ActiveMarketplacesMap = { ...EMPTY };
      for (const row of data || []) {
        const mk = (row.marketplace || "").toLowerCase();
        if (mk === "mercadolivre" || mk === "mercado_livre" || mk === "meli") map.mercadolivre = true;
        else if (mk === "shopee") map.shopee = true;
        else if (mk === "tiktok_shop" || mk === "tiktok") map.tiktok_shop = true;
      }
      return map;
    },
    enabled: !!currentTenant?.id,
    staleTime: 60_000,
  });
}
