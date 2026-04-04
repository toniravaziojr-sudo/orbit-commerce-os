import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AgendaTemplateStatus {
  submitted: boolean;
  meta_status: string | null;
  meta_template_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  meta_reject_reason: string | null;
  last_checked_at: string | null;
}

export function useAgendaTemplateStatus() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["agenda-template-status", tenantId],
    queryFn: async (): Promise<AgendaTemplateStatus> => {
      if (!tenantId) {
        return { submitted: false, meta_status: null, meta_template_id: null, submitted_at: null, approved_at: null, rejected_at: null, meta_reject_reason: null, last_checked_at: null };
      }

      const { data, error } = await supabase
        .from("whatsapp_template_submissions")
        .select("meta_status, meta_template_id, submitted_at, approved_at, rejected_at, meta_reject_reason, last_checked_at")
        .eq("tenant_id", tenantId)
        .eq("template_name", "agenda_lembrete")
        .is("rule_id", null)
        .maybeSingle();

      if (error) {
        console.error("Error fetching agenda template status:", error);
        return { submitted: false, meta_status: null, meta_template_id: null, submitted_at: null, approved_at: null, rejected_at: null, meta_reject_reason: null, last_checked_at: null };
      }

      if (!data) {
        return { submitted: false, meta_status: null, meta_template_id: null, submitted_at: null, approved_at: null, rejected_at: null, meta_reject_reason: null, last_checked_at: null };
      }

      return {
        submitted: true,
        meta_status: data.meta_status,
        meta_template_id: data.meta_template_id,
        submitted_at: data.submitted_at,
        approved_at: data.approved_at,
        rejected_at: data.rejected_at,
        meta_reject_reason: data.meta_reject_reason,
        last_checked_at: data.last_checked_at,
      };
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  const submitTemplate = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const { data, error } = await supabase.functions.invoke("agenda-submit-template", {
        body: { tenant_id: tenantId, action: "submit" },
      });

      if (error) throw new Error(error.message || "Erro ao submeter template");
      if (!data?.success) throw new Error(data?.error || "Erro ao submeter template");

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agenda-template-status", tenantId] });
      if (data.status === "approved") {
        toast.success("Template aprovado automaticamente!");
      } else {
        toast.success("Template submetido para aprovação da Meta");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao submeter template");
    },
  });

  const checkStatus = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Tenant não identificado");

      const { data, error } = await supabase.functions.invoke("agenda-submit-template", {
        body: { tenant_id: tenantId, action: "check" },
      });

      if (error) throw new Error(error.message || "Erro ao verificar status");
      if (!data?.success) throw new Error(data?.error || "Erro ao verificar status");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-template-status", tenantId] });
      toast.success("Status atualizado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao verificar status");
    },
  });

  return {
    status: status ?? { submitted: false, meta_status: null, meta_template_id: null, submitted_at: null, approved_at: null, rejected_at: null, meta_reject_reason: null, last_checked_at: null },
    isLoading,
    submitTemplate,
    checkStatus,
  };
}
