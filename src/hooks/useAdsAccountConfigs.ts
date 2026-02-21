// =============================================
// USE ADS ACCOUNT CONFIGS
// Hook for per-account AI config (normalized table)
// =============================================

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface AccountConfig {
  id: string;
  tenant_id: string;
  channel: string;
  ad_account_id: string;
  is_ai_enabled: boolean;
  budget_mode: string;
  budget_cents: number;
  target_roi: number | null;
  min_roi_cold: number | null;
  min_roi_warm: number | null;
  roas_scaling_threshold: number | null;
  user_instructions: string | null;
  strategy_mode: string;
  funnel_split_mode: string;
  funnel_splits: Record<string, number> | null;
  kill_switch: boolean;
  human_approval_mode: string;
  created_at: string | null;
  updated_at: string | null;
}

export function useAdsAccountConfigs() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const configsQuery = useQuery({
    queryKey: ["ads-account-configs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads_autopilot_account_configs")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return (data || []) as unknown as AccountConfig[];
    },
    enabled: !!tenantId,
  });

  const getAccountConfig = (channel: string, accountId: string): AccountConfig | null => {
    return configsQuery.data?.find(c => c.channel === channel && c.ad_account_id === accountId) || null;
  };

  const getAIEnabledAccounts = (channel: string): string[] => {
    return (configsQuery.data || [])
      .filter(c => c.channel === channel && c.is_ai_enabled)
      .map(c => c.ad_account_id);
  };

  const saveAccountConfig = useMutation({
    mutationFn: async (config: Partial<AccountConfig> & { channel: string; ad_account_id: string }) => {
      const existing = configsQuery.data?.find(
        c => c.channel === config.channel && c.ad_account_id === config.ad_account_id
      );
      if (existing) {
        const { error } = await supabase
          .from("ads_autopilot_account_configs")
          .update(config as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ads_autopilot_account_configs")
          .insert({ tenant_id: tenantId, ...config } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-account-configs"] });
      toast.success("Configuração da conta salva");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleAI = useMutation({
    mutationFn: async ({ channel, ad_account_id, enabled }: { channel: string; ad_account_id: string; enabled: boolean }) => {
      const existing = configsQuery.data?.find(
        c => c.channel === channel && c.ad_account_id === ad_account_id
      );
      let isFirstEver = false;
      if (existing) {
        // It's only a "first activation" if AI was NEVER enabled before (is_ai_enabled was always false/null)
        isFirstEver = !existing.is_ai_enabled && enabled;
        const { error } = await supabase
          .from("ads_autopilot_account_configs")
          .update({ is_ai_enabled: enabled } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Brand new config row = definitely first activation
        isFirstEver = enabled;
        const { error } = await supabase
          .from("ads_autopilot_account_configs")
          .insert({ tenant_id: tenantId, channel, ad_account_id, is_ai_enabled: enabled } as any);
        if (error) throw error;
      }
      return { isFirstEver };
    },
    onSuccess: (result, { channel, ad_account_id, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["ads-account-configs"] });
      toast.success(`IA ${enabled ? "ativada" : "desativada"} para esta conta`);
      
      // ONLY first-ever activation triggers the STRATEGIST (full analysis + plan + execution)
      // Re-activations (toggle off then on) do NOT re-trigger to avoid duplicate sessions
      if (enabled && result?.isFirstEver) {
        setTimeout(async () => {
          try {
            const { error } = await supabase.functions.invoke("ads-autopilot-strategist", {
              body: { tenant_id: tenantId, trigger: "start", target_account_id: ad_account_id, target_channel: channel },
            });
            if (error) console.error("AI strategist activation error:", error);
          } catch (e) {
            console.error("AI strategist activation error:", e);
          }
        }, 1500);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleKillSwitch = useMutation({
    mutationFn: async ({ channel, ad_account_id, enabled }: { channel: string; ad_account_id: string; enabled: boolean }) => {
      const existing = configsQuery.data?.find(
        c => c.channel === channel && c.ad_account_id === ad_account_id
      );
      if (existing) {
        const { error } = await supabase
          .from("ads_autopilot_account_configs")
          .update({ kill_switch: enabled } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ads_autopilot_account_configs")
          .insert({ tenant_id: tenantId, channel, ad_account_id, kill_switch: enabled } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["ads-account-configs"] });
      toast.success(enabled ? "Kill Switch ATIVADO — IA parada" : "Kill Switch desativado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    configs: configsQuery.data || [],
    isLoading: configsQuery.isLoading,
    getAccountConfig,
    getAIEnabledAccounts,
    saveAccountConfig,
    toggleAI,
    toggleKillSwitch,
  };
}

/** Validates if all required fields are filled to enable AI */
export function isAccountConfigComplete(config: AccountConfig | null): { valid: boolean; missing: string[] } {
  if (!config) return { valid: false, missing: ["Todas as configurações"] };
  const missing: string[] = [];
  if (!config.budget_cents || config.budget_cents <= 0) missing.push("Orçamento");
  if (!config.target_roi || config.target_roi <= 0) missing.push("ROI Ideal");
  if (!config.min_roi_cold || config.min_roi_cold <= 0) missing.push("ROI mín. Frio");
  if (!config.min_roi_warm || config.min_roi_warm <= 0) missing.push("ROI mín. Quente");
  if (!config.user_instructions || config.user_instructions.trim().length < 10) missing.push("Prompt Estratégico (mín. 10 chars)");
  if (!config.strategy_mode) missing.push("Estratégia");
  if (config.funnel_split_mode === "manual") {
    const splits = config.funnel_splits || {};
    const total = Object.values(splits).reduce((s, v) => s + (v || 0), 0);
    if (total !== 100) missing.push("Splits de Funil (total deve ser 100%)");
  }
  return { valid: missing.length === 0, missing };
}
