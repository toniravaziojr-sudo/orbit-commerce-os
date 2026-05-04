import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PricingRow {
  id: string;
  service_key: string;
  category: string;
  display_name: string;
  provider: string;
  model: string | null;
  unit: string;
  cost_usd: number;
  markup_pct: number;
  min_credits_charge: number | null;
  metadata: Record<string, any>;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useServicePricingCatalog() {
  return useQuery({
    queryKey: ["service-pricing-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_pricing")
        .select("*")
        .order("category", { ascending: true })
        .order("service_key", { ascending: true })
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PricingRow[];
    },
    staleTime: 30_000,
  });
}

export function useServicePricingHistory(serviceKey: string | null) {
  return useQuery({
    queryKey: ["service-pricing-history", serviceKey],
    queryFn: async () => {
      if (!serviceKey) return [];
      const { data, error } = await supabase.rpc("admin_pricing_history", {
        p_service_key: serviceKey,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        service_key: string;
        action: string;
        before: any;
        after: any;
        reason: string;
        changed_by: string | null;
        changed_at: string;
      }>;
    },
    enabled: !!serviceKey,
  });
}

function unwrap<T>(data: any): T {
  return Array.isArray(data) ? data[0] : data;
}

export function useCreatePricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { payload: Record<string, any>; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_pricing_create", {
        p_payload: args.payload,
        p_reason: args.reason,
      });
      if (error) throw error;
      const row = unwrap<{ success: boolean; error_message: string | null }>(data);
      if (!row?.success) throw new Error(row?.error_message ?? "Falha ao criar preço");
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-pricing-catalog"] }),
  });
}

export function useVersionPricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { currentId: string; payload: Record<string, any>; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_pricing_version", {
        p_current_id: args.currentId,
        p_payload: args.payload,
        p_reason: args.reason,
      });
      if (error) throw error;
      const row = unwrap<{ success: boolean; error_message: string | null }>(data);
      if (!row?.success) throw new Error(row?.error_message ?? "Falha ao versionar preço");
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-pricing-catalog"] }),
  });
}

export function useSetPricingActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; active: boolean; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_pricing_set_active", {
        p_id: args.id,
        p_active: args.active,
        p_reason: args.reason,
      });
      if (error) throw error;
      const row = unwrap<{ success: boolean; error_message: string | null }>(data);
      if (!row?.success) throw new Error(row?.error_message ?? "Falha ao alterar status");
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-pricing-catalog"] }),
  });
}

export function useSetLiveApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; approved: boolean; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_pricing_set_live_approval", {
        p_id: args.id,
        p_approved: args.approved,
        p_reason: args.reason,
      });
      if (error) throw error;
      const row = unwrap<{ success: boolean; error_message: string | null }>(data);
      if (!row?.success) throw new Error(row?.error_message ?? "Falha ao alterar aprovação");
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-pricing-catalog"] }),
  });
}
