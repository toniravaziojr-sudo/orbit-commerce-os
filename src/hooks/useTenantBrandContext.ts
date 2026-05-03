import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TenantBrandContext {
  id: string;
  tenant_id: string;
  brand_summary: string | null;
  tone_of_voice: string | null;
  banned_claims: string[] | null;
  do_not_do: string[] | null;
  visual_style_guidelines: string | null;
  packshot_url: string | null;
  manually_edited_at: string | null;
}

export function useTenantBrandContext() {
  const { currentTenant } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tenant-brand-context", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from("tenant_brand_context")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();
      if (error) throw error;
      return (data as TenantBrandContext | null) ?? null;
    },
    enabled: !!currentTenant?.id,
  });

  const upsert = useMutation({
    mutationFn: async (patch: Partial<Pick<TenantBrandContext, "banned_claims" | "do_not_do">>) => {
      if (!currentTenant?.id) throw new Error("no tenant");
      const existing = query.data;
      if (existing) {
        const { error } = await supabase
          .from("tenant_brand_context")
          .update({ ...patch, manually_edited_at: new Date().toISOString() })
          .eq("tenant_id", currentTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_brand_context")
          .insert({
            tenant_id: currentTenant.id,
            ...patch,
            manually_edited_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-brand-context"] });
      toast.success("Promessas/claims atualizadas");
    },
    onError: (e: Error) => {
      toast.error("Erro ao salvar");
      console.error(e);
    },
  });

  return { brand: query.data, isLoading: query.isLoading, upsert };
}
