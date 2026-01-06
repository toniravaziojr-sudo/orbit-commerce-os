import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Database, Json } from "@/integrations/supabase/types";

type MediaCampaignStatus = Database["public"]["Enums"]["media_campaign_status"];
type MediaItemStatus = Database["public"]["Enums"]["media_item_status"];
type MediaContentType = Database["public"]["Enums"]["media_content_type"];

export interface MediaCampaign {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  prompt: string;
  start_date: string;
  end_date: string;
  days_of_week: number[] | null;
  months: number[] | null;
  excluded_dates: string[] | null;
  status: MediaCampaignStatus;
  items_count: number | null;
  approved_count: number | null;
  published_count: number | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface MediaCalendarItem {
  id: string;
  tenant_id: string;
  campaign_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  content_type: MediaContentType;
  title: string | null;
  copy: string | null;
  cta: string | null;
  hashtags: string[] | null;
  generation_prompt: string | null;
  reference_urls: string[] | null;
  asset_url: string | null;
  asset_thumbnail_url: string | null;
  asset_metadata: Json | null;
  status: MediaItemStatus;
  target_platforms: string[] | null;
  published_at: string | null;
  publish_results: Json | null;
  version: number | null;
  edited_by: string | null;
  edited_at: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  prompt: string;
  start_date: string;
  end_date: string;
  days_of_week?: number[];
  months?: number[];
}

export interface UpdateCalendarItemInput {
  id: string;
  content_type?: MediaContentType;
  title?: string;
  copy?: string;
  cta?: string;
  hashtags?: string[];
  status?: MediaItemStatus;
  target_platforms?: string[];
}

export function useMediaCampaigns() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ["media-campaigns", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from("media_campaigns")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MediaCampaign[];
    },
    enabled: !!currentTenant?.id,
  });

  const createCampaign = useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase
        .from("media_campaigns")
        .insert({
          tenant_id: currentTenant.id,
          name: input.name,
          description: input.description,
          prompt: input.prompt,
          start_date: input.start_date,
          end_date: input.end_date,
          days_of_week: input.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
          months: input.months,
          status: "draft" as MediaCampaignStatus,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MediaCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-campaigns", currentTenant?.id] });
      toast.success("Campanha criada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar campanha:", error);
      toast.error("Erro ao criar campanha");
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MediaCampaign> & { id: string }) => {
      const { data, error } = await supabase
        .from("media_campaigns")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MediaCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-campaigns", currentTenant?.id] });
      toast.success("Campanha atualizada!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar campanha:", error);
      toast.error("Erro ao atualizar campanha");
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("media_campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-campaigns", currentTenant?.id] });
      toast.success("Campanha excluída!");
    },
    onError: (error) => {
      console.error("Erro ao excluir campanha:", error);
      toast.error("Erro ao excluir campanha");
    },
  });

  return {
    campaigns,
    isLoading,
    error,
    createCampaign,
    updateCampaign,
    deleteCampaign,
  };
}

export function useMediaCalendarItems(campaignId: string | undefined) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: ["media-calendar-items", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from("media_calendar_items")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      return data as MediaCalendarItem[];
    },
    enabled: !!campaignId,
  });

  const createItem = useMutation({
    mutationFn: async (input: Omit<MediaCalendarItem, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("media_calendar_items")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as MediaCalendarItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateCalendarItemInput) => {
      const { data, error } = await supabase
        .from("media_calendar_items")
        .update({
          ...updates,
          edited_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MediaCalendarItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
      toast.success("Item atualizado!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar item:", error);
      toast.error("Erro ao atualizar item");
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("media_calendar_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
      toast.success("Item excluído!");
    },
  });

  const bulkCreateItems = useMutation({
    mutationFn: async (inputs: Omit<MediaCalendarItem, "id" | "created_at" | "updated_at">[]) => {
      const { data, error } = await supabase
        .from("media_calendar_items")
        .insert(inputs)
        .select();

      if (error) throw error;
      return data as MediaCalendarItem[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
    },
  });

  return {
    items,
    isLoading,
    error,
    refetch,
    createItem,
    updateItem,
    deleteItem,
    bulkCreateItems,
  };
}
