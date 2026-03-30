import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MetaAuthProfile {
  profile_key: string;
  display_name: string;
  description: string | null;
  config_id: string | null;
  effective_scopes: string[];
  is_active: boolean;
  updated_at: string;
}

export function useMetaAuthProfiles() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["meta-auth-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-auth-profiles-admin", {
        method: "GET",
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao buscar perfis");
      return data.profiles as MetaAuthProfile[];
    },
  });

  const updateConfigId = useMutation({
    mutationFn: async ({ profileKey, configId }: { profileKey: string; configId: string | null }) => {
      const { data, error } = await supabase.functions.invoke("meta-auth-profiles-admin", {
        method: "POST",
        body: { profile_key: profileKey, config_id: configId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao atualizar");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-auth-profiles"] });
      toast.success("Config ID atualizado com sucesso");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar Config ID");
    },
  });

  return { ...query, updateConfigId };
}
