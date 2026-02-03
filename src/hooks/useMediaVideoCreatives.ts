import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// =============================================
// Types
// =============================================

export interface MediaCategoryProfile {
  id: string;
  niche: string;
  display_name: string;
  product_fidelity_weight: number;
  label_ocr_weight: number;
  quality_weight: number;
  temporal_stability_weight: number;
  qa_pass_threshold: number;
  fallback_enabled: boolean;
  context_tokens: string[];
  forbidden_actions: string[];
}

export interface MediaPresetComponent {
  id: string;
  component_type: "scene" | "lighting" | "camera" | "narrative" | "audio";
  name: string;
  slug: string;
  prompt_fragment: string;
  compatible_niches: string[];
  sort_order: number;
  is_default: boolean;
}

export interface MediaVideoPreset {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_seconds: number;
  scene_component_id: string | null;
  lighting_component_id: string | null;
  camera_component_id: string | null;
  narrative_component_id: string | null;
  audio_component_id: string | null;
  target_niche: string;
  variation_count: number;
  is_default: boolean;
  is_active: boolean;
}

export interface MediaVideoJob {
  id: string;
  tenant_id: string;
  calendar_item_id: string | null;
  campaign_id: string | null;
  product_id: string | null;
  product_image_url: string | null;
  product_cutout_url: string | null;
  original_prompt: string;
  rewritten_prompt: string | null;
  shot_plan: Record<string, unknown> | null;
  preset_id: string | null;
  niche: string;
  duration_seconds: number;
  variation_count: number;
  status: string;
  current_stage: number;
  stage_results: Record<string, unknown>;
  provider: string;
  model: string;
  best_candidate_id: string | null;
  qa_scores: Record<string, unknown>;
  qa_passed: boolean | null;
  qa_threshold: number;
  output_url: string | null;
  output_thumbnail_url: string | null;
  fallback_used: boolean;
  error_message: string | null;
  retry_count: number;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaVideoCandidate {
  id: string;
  job_id: string;
  tenant_id: string;
  candidate_index: number;
  provider_request_id: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  similarity_score: number | null;
  label_ocr_score: number | null;
  quality_score: number | null;
  temporal_stability_score: number | null;
  final_score: number | null;
  qa_passed: boolean | null;
  qa_details: Record<string, unknown> | null;
  status: string;
  is_best: boolean;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CreateMediaVideoJobInput {
  calendar_item_id?: string;
  campaign_id?: string;
  product_id?: string;
  product_image_url?: string;
  prompt: string;
  preset_id?: string;
  niche?: string;
  duration_seconds?: number;
  variation_count?: number;
  enable_qa?: boolean;
  enable_fallback?: boolean;
}

// =============================================
// Hook: useMediaCategoryProfiles
// =============================================

export function useMediaCategoryProfiles() {
  return useQuery({
    queryKey: ["media-category-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_category_profiles")
        .select("*")
        .order("display_name");

      if (error) throw error;
      return data as MediaCategoryProfile[];
    },
  });
}

// =============================================
// Hook: useMediaPresetComponents
// =============================================

export function useMediaPresetComponents(niche?: string) {
  return useQuery({
    queryKey: ["media-preset-components", niche],
    queryFn: async () => {
      let query = supabase
        .from("media_preset_components")
        .select("*")
        .order("component_type")
        .order("sort_order");

      if (niche) {
        query = query.contains("compatible_niches", [niche]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MediaPresetComponent[];
    },
  });
}

// =============================================
// Hook: useMediaVideoPresets
// =============================================

export function useMediaVideoPresets(niche?: string) {
  return useQuery({
    queryKey: ["media-video-presets", niche],
    queryFn: async () => {
      let query = supabase
        .from("media_video_presets")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (niche) {
        query = query.eq("target_niche", niche);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MediaVideoPreset[];
    },
  });
}

// =============================================
// Hook: useMediaVideoJobs
// =============================================

export function useMediaVideoJobs(campaignId?: string) {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ["media-video-jobs", currentTenant?.id, campaignId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from("media_video_jobs")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MediaVideoJob[];
    },
    enabled: !!currentTenant?.id,
    refetchInterval: (query) => {
      // Refetch every 5s if there are pending jobs
      const hasPending = query.state.data?.some((job) =>
        ["pending", "preprocess", "rewrite", "generate_candidates", "qa_select", "retry", "fallback"].includes(job.status)
      );
      return hasPending ? 5000 : false;
    },
  });
}

// =============================================
// Hook: useMediaVideoCandidates
// =============================================

export function useMediaVideoCandidates(jobId: string | undefined) {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ["media-video-candidates", jobId],
    queryFn: async () => {
      if (!jobId || !currentTenant?.id) return [];

      const { data, error } = await supabase
        .from("media_video_candidates")
        .select("*")
        .eq("job_id", jobId)
        .eq("tenant_id", currentTenant.id)
        .order("candidate_index");

      if (error) throw error;
      return data as MediaVideoCandidate[];
    },
    enabled: !!jobId && !!currentTenant?.id,
  });
}

// =============================================
// Hook: useCreateMediaVideoJob
// =============================================

export function useCreateMediaVideoJob() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMediaVideoJobInput) => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase.functions.invoke("media-video-generate", {
        body: {
          tenant_id: currentTenant.id,
          ...input,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao criar job de vídeo");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-video-jobs", currentTenant?.id] });
      toast.success("Job de vídeo criado! Processando...");
    },
    onError: (error) => {
      console.error("Erro ao criar job de vídeo:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar job de vídeo");
    },
  });
}

// =============================================
// Hook: useDeleteMediaVideoJob
// =============================================

export function useDeleteMediaVideoJob() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      // Delete candidates first (cascade should handle this, but being explicit)
      await supabase
        .from("media_video_candidates")
        .delete()
        .eq("job_id", jobId);

      // Delete job
      const { error } = await supabase
        .from("media_video_jobs")
        .delete()
        .eq("id", jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-video-jobs", currentTenant?.id] });
      toast.success("Job excluído");
    },
    onError: (error) => {
      console.error("Erro ao excluir job:", error);
      toast.error("Erro ao excluir job");
    },
  });
}
