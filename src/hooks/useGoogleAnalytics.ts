import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// =====================
// Types
// =====================

export interface GA4Summary {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  pageViews: number;
  conversions: number;
  revenue: number;
  avgBounceRate: number;
}

export interface GA4RealtimeData {
  activeUsers: number;
  screenPageViews: number;
  conversions: number;
}

export interface GA4ReportRow {
  id: string;
  tenant_id: string;
  property_id: string;
  report_type: string;
  date: string;
  dimensions: Record<string, any>;
  metrics: Record<string, number>;
  synced_at: string | null;
}

// =====================
// Hook
// =====================

export function useGoogleAnalytics(propertyId?: string) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // --- Summary (last 30 days) ---
  const summaryQuery = useQuery({
    queryKey: ["ga4-summary", tenantId, propertyId],
    queryFn: async (): Promise<GA4Summary> => {
      const { data, error } = await supabase.functions.invoke("google-analytics-report", {
        body: { tenant_id: tenantId, action: "summary", property_id: propertyId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao buscar resumo");
      return data.data;
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // --- Realtime ---
  const realtimeQuery = useQuery({
    queryKey: ["ga4-realtime", tenantId, propertyId],
    queryFn: async (): Promise<GA4RealtimeData> => {
      const { data, error } = await supabase.functions.invoke("google-analytics-report", {
        body: { tenant_id: tenantId, action: "realtime", property_id: propertyId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao buscar realtime");
      return data.data;
    },
    enabled: !!tenantId,
    staleTime: 30000, // refresh every 30s
    refetchInterval: 60000, // auto-refetch every 60s
  });

  // --- Daily report list ---
  const reportsQuery = useQuery({
    queryKey: ["ga4-reports", tenantId, propertyId],
    queryFn: async (): Promise<GA4ReportRow[]> => {
      const { data, error } = await supabase.functions.invoke("google-analytics-report", {
        body: { tenant_id: tenantId, action: "list", property_id: propertyId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar relatórios");
      return data.data || [];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // --- Sync ---
  const syncMutation = useMutation({
    mutationFn: async (params?: { property_id?: string; date_from?: string; date_to?: string }) => {
      const { data, error } = await supabase.functions.invoke("google-analytics-report", {
        body: { tenant_id: tenantId, action: "sync", property_id: propertyId, ...params },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} dias de dados sincronizados`);
      queryClient.invalidateQueries({ queryKey: ["ga4-summary"] });
      queryClient.invalidateQueries({ queryKey: ["ga4-reports"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao sincronizar GA4"),
  });

  return {
    // Summary
    summary: summaryQuery.data || null,
    summaryLoading: summaryQuery.isLoading,

    // Realtime
    realtime: realtimeQuery.data || null,
    realtimeLoading: realtimeQuery.isLoading,

    // Reports
    reports: reportsQuery.data || [],
    reportsLoading: reportsQuery.isLoading,

    // Sync
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
