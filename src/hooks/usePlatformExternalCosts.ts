import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformExternalCost {
  id: string;
  service_key: string;
  display_name: string;
  category: "email" | "infra" | "ai" | "fiscal" | "cloud" | "payments" | "other";
  description: string | null;
  vendor_url: string | null;
  billing_model: "subscription" | "prepaid" | "payg";
  monthly_cost_usd: number | null;
  monthly_cost_brl: number | null;
  current_balance: number | null;
  balance_unit: string | null;
  balance_threshold_pct: number | null;
  renewal_date: string | null;
  sync_mode: "auto" | "manual";
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  is_active: boolean;
  notes: string | null;
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date + "T00:00:00").getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}

export function isCostAlerting(cost: PlatformExternalCost): "critical" | "warning" | null {
  const days = daysUntil(cost.renewal_date);
  if (days !== null) {
    if (days <= 3) return "critical";
    if (days <= 7) return "warning";
  }
  return null;
}

export function usePlatformExternalCosts() {
  return useQuery({
    queryKey: ["platform-external-costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_external_costs" as never)
        .select("*")
        .order("category", { ascending: true })
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data as unknown as PlatformExternalCost[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlatformCostsAlerts() {
  const { data } = usePlatformExternalCosts();
  const alerts = (data ?? [])
    .filter((c) => c.is_active)
    .map((c) => ({ cost: c, level: isCostAlerting(c) }))
    .filter((a) => a.level !== null) as { cost: PlatformExternalCost; level: "critical" | "warning" }[];
  return { alerts, hasCritical: alerts.some((a) => a.level === "critical") };
}

export function useUpdateExternalCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<PlatformExternalCost> }) => {
      const { error } = await supabase
        .from("platform_external_costs" as never)
        .update(input.patch as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-external-costs"] }),
  });
}

export function useSyncExternalCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("platform-costs-sync");
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-external-costs"] }),
  });
}
