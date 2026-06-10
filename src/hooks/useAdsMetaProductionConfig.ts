// =============================================================================
// useAdsMetaProductionConfig — Onda D
// Configuração persistida usada como fonte de verdade pelo Strategist Meta.
// =============================================================================

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface MetaProductionConfig {
  id: string;
  tenant_id: string;
  ad_account_id: string;

  facebook_page_id: string | null;
  instagram_actor_id: string | null;

  pixel_id: string | null;
  default_conversion_event: string | null;
  attribution_window: string | null;

  default_objective: string;
  default_buying_type: string;
  default_budget_type: string;
  default_daily_budget_cents: number | null;
  default_planned_status: string;

  default_country: string;
  default_language: string;
  default_age_min: number;
  default_age_max: number;
  default_gender: string;
  default_placements: string[];
  default_audience_type: string;
  default_funnel_stage: string;
  exclude_customers: boolean;
  custom_audiences: Array<{ id: string; name: string }>;
  interests_lookalikes: Array<{ id?: string; name: string; kind?: string }>;

  default_cta: string;
  default_creative_format: string;
  default_utm_params: Record<string, string>;
  reference_image_strategy: string;

  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Verdade de "configuração pronta para gerar proposta v2 estratégia". */
export function isProductionConfigReadyForStrategy(c: MetaProductionConfig | null): boolean {
  if (!c) return false;
  return !!c.default_objective && !!c.default_daily_budget_cents && !!c.default_cta && !!c.default_creative_format;
}

/** Verdade de "pode publicar campanha real" (etapa C, futura). */
export function isProductionConfigReadyForPublish(c: MetaProductionConfig | null): boolean {
  if (!c) return false;
  return !!c.facebook_page_id && !!c.pixel_id && !!c.default_conversion_event;
}

export function useAdsMetaProductionConfig(adAccountId: string | null | undefined) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;
  const enabled = !!tenantId && !!adAccountId;

  const query = useQuery({
    queryKey: ["ads-meta-production-config", tenantId, adAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads_meta_production_config" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("ad_account_id", adAccountId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as MetaProductionConfig) || null;
    },
    enabled,
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<MetaProductionConfig>) => {
      if (!tenantId || !adAccountId) throw new Error("Tenant ou conta de anúncios não informada.");
      const existing = query.data;
      if (existing) {
        const { error } = await supabase
          .from("ads_meta_production_config" as any)
          .update(patch as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ads_meta_production_config" as any)
          .insert({ tenant_id: tenantId, ad_account_id: adAccountId, ...patch } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-meta-production-config", tenantId, adAccountId] });
      toast.success("Configuração de Criação Meta salva.");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Não foi possível salvar a configuração.");
    },
  });

  return { ...query, save };
}
