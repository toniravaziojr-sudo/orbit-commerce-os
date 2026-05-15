import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemResourceUsage {
  module_key: string;
  module_name: string;
  module_group: string;
  active_tenant_count: number;
  status: "active" | "dormant";
  last_refreshed_at: string;
  last_event_activation_at: string | null;
  updated_at: string;
}

export interface SystemResourceSkipLog {
  id: string;
  module_key: string;
  cron_job_name: string;
  reason: string;
  active_tenant_count: number;
  skipped_at: string;
}

export function useSystemResourceUsage() {
  return useQuery({
    queryKey: ["system-resource-usage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_resource_usage")
        .select("*")
        .order("module_group", { ascending: true })
        .order("module_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SystemResourceUsage[];
    },
    staleTime: 60_000,
  });
}

export function useSystemResourceSkipLog(hours = 24) {
  return useQuery({
    queryKey: ["system-resource-skip-log", hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("system_resource_skip_log")
        .select("*")
        .gte("skipped_at", since)
        .order("skipped_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SystemResourceSkipLog[];
    },
    staleTime: 60_000,
  });
}
