// =============================================================================
// useMetaIntegrationAssetsStatus
// Lê os ativos reais da integração Meta do tenant (tenant_meta_integrations)
// para o card de status técnico do Gestor de Tráfego IA.
// =============================================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MetaIntegrationAssetsStatus {
  hasAdAccount: boolean;
  hasPage: boolean;
  hasPixel: boolean;
  hasConversionsApi: boolean;
  /** Pronto para análise estratégica + publicação (página, pixel e CAPI). */
  readyForPublish: boolean;
  /** Lista de ativos faltantes em PT-BR para mensagens amigáveis. */
  missing: string[];
}

const PAGE_INTEGRATIONS = new Set([
  "facebook_publicacoes",
  "instagram_publicacoes",
  "facebook_messenger",
  "facebook_comentarios",
  "instagram_comentarios",
  "leads",
]);

function rowHasPage(selected: any): boolean {
  if (!selected) return false;
  if (Array.isArray(selected.pages) && selected.pages.length > 0) return true;
  if (selected.page && typeof selected.page === "object") return true;
  return false;
}

function rowHasPixel(selected: any): boolean {
  if (!selected) return false;
  if (Array.isArray(selected.pixels) && selected.pixels.length > 0) return true;
  if (selected.pixel && typeof selected.pixel === "object") return true;
  return false;
}

function rowHasAdAccount(selected: any): boolean {
  if (!selected) return false;
  return Array.isArray(selected.ad_accounts) && selected.ad_accounts.length > 0;
}

export function useMetaIntegrationAssetsStatus() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["meta-integration-assets-status", tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async (): Promise<MetaIntegrationAssetsStatus> => {
      const { data, error } = await supabase
        .from("tenant_meta_integrations")
        .select("integration_id, status, selected_assets")
        .eq("tenant_id", tenantId!)
        .eq("status", "active");
      if (error) throw error;

      let hasAdAccount = false;
      let hasPage = false;
      let hasPixel = false;
      let hasConversionsApi = false;

      for (const row of data || []) {
        const sel = (row as any).selected_assets || {};
        const intId = (row as any).integration_id as string;
        if (intId === "anuncios" && rowHasAdAccount(sel)) hasAdAccount = true;
        if (intId === "pixel_facebook" && rowHasPixel(sel)) hasPixel = true;
        if (intId === "conversions_api") {
          hasConversionsApi = true;
          if (rowHasPixel(sel)) hasPixel = true;
        }
        if (PAGE_INTEGRATIONS.has(intId) && rowHasPage(sel)) hasPage = true;
      }

      const missing: string[] = [];
      if (!hasAdAccount) missing.push("Conta de anúncio");
      if (!hasPage) missing.push("Página do Facebook/Instagram");
      if (!hasPixel) missing.push("Pixel");
      if (!hasConversionsApi) missing.push("API de Conversões");

      const readyForPublish = hasAdAccount && hasPage && hasPixel && hasConversionsApi;
      return { hasAdAccount, hasPage, hasPixel, hasConversionsApi, readyForPublish, missing };
    },
  });
}
