// =============================================================================
// usePlatformCapability — leitura simples do registro de capacidades
// =============================================================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PlatformCapabilitiesRow } from "@/lib/ads/gates/platformCompatibility";

export function usePlatformCapability(platform: string | null | undefined) {
  return useQuery({
    queryKey: ["platform-capabilities", platform],
    enabled: !!platform,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_capabilities")
        .select("platform,status,capabilities_version,adapter_version,last_verified_at,capabilities_json")
        .eq("platform", platform!)
        .maybeSingle();
      if (error) throw error;
      return (data as PlatformCapabilitiesRow | null) ?? null;
    },
  });
}
