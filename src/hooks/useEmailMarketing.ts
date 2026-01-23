import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useEmailMarketing() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Lists
  const { data: lists = [], isLoading: listsLoading } = useQuery({
    queryKey: ["email-marketing-lists", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("email_marketing_lists")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Subscribers
  const { data: subscribers = [], isLoading: subscribersLoading } = useQuery({
    queryKey: ["email-marketing-subscribers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("email_marketing_subscribers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["email-marketing-templates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("email_marketing_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["email-marketing-campaigns", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("email_marketing_campaigns")
        .select("*, email_marketing_templates(*), email_marketing_lists(*)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Forms
  const { data: forms = [], isLoading: formsLoading } = useQuery({
    queryKey: ["email-marketing-forms", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("email_marketing_forms")
        .select("*, email_marketing_lists(*)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Queue stats
  const { data: queueStats } = useQuery({
    queryKey: ["email-queue-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return { queued: 0, sent: 0, failed: 0 };
      const { data, error } = await supabase
        .from("email_send_queue")
        .select("status")
        .eq("tenant_id", tenantId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (error) return { queued: 0, sent: 0, failed: 0 };
      const stats = { queued: 0, sent: 0, failed: 0, skipped: 0 };
      data?.forEach((r: any) => {
        if (r.status in stats) stats[r.status as keyof typeof stats]++;
      });
      return stats;
    },
    enabled: !!tenantId,
  });

  // Mutations
  const createList = useMutation({
    mutationFn: async (data: { name: string; description?: string; tag_id: string }) => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const { error } = await supabase.from("email_marketing_lists").insert({
        name: data.name,
        description: data.description,
        tag_id: data.tag_id,
        tenant_id: tenantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-marketing-lists"] });
      queryClient.invalidateQueries({ queryKey: ["email-marketing-subscribers"] });
      toast.success("Lista criada - subscribers sincronizados automaticamente!");
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (data: { name: string; subject: string; body_html: string }) => {
      const { error } = await supabase.from("email_marketing_templates").insert({ ...data, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-marketing-templates"] });
      toast.success("Template criado");
    },
  });

  const createCampaign = useMutation({
    mutationFn: async (data: { name: string; type: string; list_id?: string; template_id?: string; trigger_type?: string }) => {
      const { error } = await supabase.from("email_marketing_campaigns").insert({ ...data, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-marketing-campaigns"] });
      toast.success("Campanha criada");
    },
  });

  const createForm = useMutation({
    mutationFn: async (data: { name: string; slug: string; list_id?: string }) => {
      const { error } = await supabase.from("email_marketing_forms").insert({ ...data, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-marketing-forms"] });
      toast.success("Formulário criado");
    },
  });

  return {
    lists, listsLoading,
    subscribers, subscribersLoading,
    templates, templatesLoading,
    campaigns, campaignsLoading,
    forms, formsLoading,
    queueStats,
    createList, createTemplate, createCampaign, createForm,
    tenantId,
  };
}
