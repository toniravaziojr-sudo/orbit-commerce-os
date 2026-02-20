// =============================================
// USE ADS AUTOPILOT
// Hook for managing AI Traffic Manager autopilot
// =============================================

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface AutopilotConfig {
  id: string;
  tenant_id: string;
  channel: string;
  is_enabled: boolean;
  budget_mode: string;
  budget_cents: number;
  allocation_mode: string;
  max_share_pct: number;
  min_share_pct: number;
  objective: string;
  user_instructions: string | null;
  ai_model: string;
  safety_rules: Record<string, any>;
  lock_session_id: string | null;
  lock_expires_at: string | null;
  last_analysis_at: string | null;
  total_actions_executed: number;
  total_credits_consumed: number;
  total_budget_cents: number | null;
  total_budget_mode: string | null;
  channel_limits: Record<string, any> | null;
  strategy_mode: string | null;
  funnel_split_mode: string | null;
  funnel_splits: Record<string, any> | null;
  kill_switch: boolean | null;
  human_approval_mode: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutopilotAction {
  id: string;
  tenant_id: string;
  session_id: string;
  channel: string;
  action_type: string;
  action_data: Record<string, any> | null;
  reasoning: string | null;
  expected_impact: string | null;
  confidence: string | null;
  metric_trigger: string | null;
  status: string;
  rejection_reason: string | null;
  rollback_data: Record<string, any> | null;
  executed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AutopilotSession {
  id: string;
  tenant_id: string;
  channel: string;
  trigger_type: string;
  context_snapshot: Record<string, any> | null;
  ai_response_raw: string | null;
  actions_planned: number;
  actions_executed: number;
  actions_rejected: number;
  insights_generated: any;
  integration_status: Record<string, any> | null;
  cost_credits: number;
  duration_ms: number | null;
  created_at: string;
}

export function useAdsAutopilot() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // ============ CONFIGS ============
  const configsQuery = useQuery({
    queryKey: ["ads-autopilot-configs", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads_autopilot_configs" as any)
        .select("*")
        .eq("tenant_id", tenantId!);
      return (data || []) as unknown as AutopilotConfig[];
    },
    enabled: !!tenantId,
  });

  const globalConfig = configsQuery.data?.find(c => c.channel === "global") || null;
  const channelConfigs = configsQuery.data?.filter(c => c.channel !== "global") || [];

  const saveConfig = useMutation({
    mutationFn: async (config: Partial<AutopilotConfig> & { channel: string }) => {
      const existing = configsQuery.data?.find(c => c.channel === config.channel);
      if (existing) {
        const { error } = await supabase
          .from("ads_autopilot_configs" as any)
          .update(config as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ads_autopilot_configs" as any)
          .insert({ tenant_id: tenantId, ...config } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-configs"] });
      toast.success("Configuração salva");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleChannel = useMutation({
    mutationFn: async ({ channel, enabled }: { channel: string; enabled: boolean }) => {
      const existing = configsQuery.data?.find(c => c.channel === channel);
      if (existing) {
        const { error } = await supabase
          .from("ads_autopilot_configs" as any)
          .update({ is_enabled: enabled } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ads_autopilot_configs" as any)
          .insert({ tenant_id: tenantId, channel, is_enabled: enabled } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, { channel, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-configs"] });
      toast.success(`${channel === "global" ? "Piloto Automático" : channel} ${enabled ? "ativado" : "desativado"}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ ACTIONS ============
  const actionsQuery = useQuery({
    queryKey: ["ads-autopilot-actions", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads_autopilot_actions" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as unknown as AutopilotAction[];
    },
    enabled: !!tenantId,
  });

  // ============ SESSIONS ============
  const sessionsQuery = useQuery({
    queryKey: ["ads-autopilot-sessions", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads_autopilot_sessions" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as unknown as AutopilotSession[];
    },
    enabled: !!tenantId,
  });

  // ============ TRIGGER ANALYSIS ============
  const triggerAnalysis = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-analyze", {
        body: { tenant_id: tenantId, trigger_type: "manual" },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro na análise");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-configs"] });
      const d = data?.data;
      toast.success(`Análise concluída: ${d?.actions?.executed || 0} ações executadas, ${d?.actions?.rejected || 0} rejeitadas`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ TRIGGER GUARDIAN ============
  const triggerGuardian = useMutation({
    mutationFn: async (cycle?: string) => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-guardian", {
        body: { tenant_id: tenantId, cycle: cycle || "12h" },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro no Guardião");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-sessions"] });
      const d = data?.data;
      toast.success(`Guardião: ${d?.actions?.executed || 0} ações executadas`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ TRIGGER STRATEGIST ============
  const triggerStrategist = useMutation({
    mutationFn: async (trigger?: string) => {
      const { data, error } = await supabase.functions.invoke("ads-autopilot-strategist", {
        body: { tenant_id: tenantId, trigger: trigger || "weekly" },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro no Estrategista");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-configs"] });
      const d = data?.data;
      toast.success(`Estrategista: ${d?.actions?.executed || 0} ações executadas, ${d?.actions?.rejected || 0} rejeitadas`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    // Configs
    globalConfig,
    channelConfigs,
    configsLoading: configsQuery.isLoading,
    saveConfig,
    toggleChannel,

    // Actions
    actions: actionsQuery.data || [],
    actionsLoading: actionsQuery.isLoading,

    // Sessions
    sessions: sessionsQuery.data || [],
    sessionsLoading: sessionsQuery.isLoading,

    // Analysis
    triggerAnalysis,

    // Guardian
    triggerGuardian,

    // Strategist
    triggerStrategist,
  };
}
