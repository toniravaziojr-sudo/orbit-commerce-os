import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type BrainInsightStatus = "pendente" | "aprovado" | "revogado" | "expirado";
export type BrainInsightType =
  | "linguagem"
  | "dor"
  | "objecao"
  | "motivo_nao_fechamento"
  | "oportunidade"
  | "problema_operacional"
  | "tendencia"
  | "sistema";

export interface BrainInsight {
  id: string;
  tenant_id: string;
  insight_type: BrainInsightType;
  title: string;
  summary: string;
  recommendation: string | null;
  is_urgent: boolean;
  status: BrainInsightStatus;
  evidence_count: number;
  unique_customer_count: number;
  variations: string[];
  product_id: string | null;
  scope_vendas: boolean;
  scope_landing: boolean;
  scope_trafego: boolean;
  scope_auxiliar: boolean;
  period_start: string | null;
  period_end: string | null;
  approved_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface CriticalAlert {
  id: string;
  tenant_id: string;
  category: string;
  title: string;
  description: string | null;
  trigger_text: string | null;
  status: "aberto" | "em_analise" | "resolvido" | "ignorado" | "expirado";
  occurrences_2h: number;
  detected_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  conversation_id: string | null;
  metadata: Record<string, any>;
}

// ---------- BRAIN INSIGHTS ----------

export function useBrainInsights(status?: BrainInsightStatus) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["brain-insights", tenantId, status],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("ai_brain_insights" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("is_urgent", { ascending: false })
        .order("evidence_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as BrainInsight[];
    },
    enabled: !!tenantId,
  });
}

export function useApproveInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (insightId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ai_brain_insights" as any)
        .update({
          status: "aprovado",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        })
        .eq("id", insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-insights"] });
      toast.success("Insight aprovado e ativo no cérebro da IA");
    },
    onError: (e) => toast.error("Erro ao aprovar: " + (e as Error).message),
  });
}

export function useRevokeInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ insightId, reason }: { insightId: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ai_brain_insights" as any)
        .update({
          status: "revogado",
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id,
          revoke_reason: reason || null,
        })
        .eq("id", insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-insights"] });
      toast.success("Insight revogado");
    },
    onError: (e) => toast.error("Erro ao revogar: " + (e as Error).message),
  });
}

export function useUpdateInsightScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      insightId,
      scopes,
    }: {
      insightId: string;
      scopes: Partial<Pick<BrainInsight, "scope_vendas" | "scope_landing" | "scope_trafego" | "scope_auxiliar">>;
    }) => {
      const { error } = await supabase
        .from("ai_brain_insights" as any)
        .update(scopes)
        .eq("id", insightId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brain-insights"] });
    },
    onError: (e) => toast.error("Erro ao atualizar agentes: " + (e as Error).message),
  });
}

// ---------- CRITICAL ALERTS ----------

export function useCriticalAlerts(status: "aberto" | "all" = "aberto") {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["critical-alerts", tenantId, status],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("ai_critical_alerts" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("occurrences_2h", { ascending: false })
        .order("detected_at", { ascending: false })
        .limit(50);
      if (status === "aberto") q = q.eq("status", "aberto");
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as CriticalAlert[];
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });
}

export function useResolveCriticalAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ alertId, notes, ignore }: { alertId: string; notes?: string; ignore?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ai_critical_alerts" as any)
        .update({
          status: ignore ? "ignorado" : "resolvido",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: notes || null,
        })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["critical-alerts"] });
      toast.success("Alerta atualizado");
    },
    onError: (e) => toast.error("Erro ao atualizar alerta: " + (e as Error).message),
  });
}

// ---------- MANUAL TRIGGERS ----------

export function useConsolidateNow() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não encontrado");
      const { data, error } = await supabase.functions.invoke("ai-signal-consolidate", {
        body: { tenant_id: currentTenant.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["brain-insights"] });
      const r = data?.results?.[0];
      toast.success(
        `${r?.insights_created ?? 0} novos insights, ${r?.insights_updated ?? 0} atualizados`,
      );
    },
    onError: (e) => toast.error("Erro: " + (e as Error).message),
  });
}
