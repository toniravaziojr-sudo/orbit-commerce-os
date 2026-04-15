import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface WmsPratikaConfig {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  endpoint_url: string;
  cnpj: string | null;
  auto_send_nfe: boolean;
  auto_send_label: boolean;
  created_at: string;
  updated_at: string;
}

export interface WmsPratikaLog {
  id: string;
  operation: string;
  reference_id: string | null;
  reference_type: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useWmsPratikaConfig() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  return useQuery({
    queryKey: ["wms-pratika-config", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("wms_pratika_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data as WmsPratikaConfig | null;
    },
    enabled: !!tenantId,
  });
}

export function useWmsPratikaLogs() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  return useQuery({
    queryKey: ["wms-pratika-logs", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("wms_pratika_logs")
        .select("id, operation, reference_id, reference_type, status, error_message, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as WmsPratikaLog[];
    },
    enabled: !!tenantId,
  });
}

export function useWmsPratikaSave() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<WmsPratikaConfig>) => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      // Check if config exists
      const { data: existing } = await supabase
        .from("wms_pratika_configs")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("wms_pratika_configs")
          .update({ ...config, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wms_pratika_configs")
          .insert({ tenant_id: tenantId, ...config });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wms-pratika-config"] });
      toast.success("Configuração WMS salva com sucesso");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar configuração: " + err.message);
    },
  });
}

export function useWmsPratikaTest() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/wms-pratika-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "test_connection" }),
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Falha no teste");
      return result;
    },
    onSuccess: () => {
      toast.success("Conexão com WMS Pratika testada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro no teste: " + err.message);
    },
  });
}
