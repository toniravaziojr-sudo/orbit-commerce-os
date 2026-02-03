/**
 * Video Creatives Hooks
 * 
 * Hooks para o pipeline de vídeo v2.0 (substitui fal.ai por OpenAI/Sora)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

export interface VideoPreset {
  id: string;
  preset_key: string;
  display_name: string;
  description: string | null;
  thumbnail_url: string | null;
  category_applicability: string[];
  shot_plan_6s: any;
  shot_plan_10s: any;
  shot_plan_15s: any;
  default_constraints: any[];
  default_negatives: any[];
  sort_order: number;
  is_active: boolean;
}

export interface CategoryProfile {
  id: string;
  category_key: string;
  display_name: string;
  description: string | null;
  hard_fidelity_default: boolean;
  qa_similarity_weight: number;
  qa_label_weight: number;
  qa_quality_weight: number;
  qa_pass_threshold: number;
  negative_rules: string[];
  constraints: string[];
}

export interface VideoJob {
  id: string;
  tenant_id: string;
  user_id: string;
  product_id: string;
  video_type: 'product_video' | 'ugc_ai_video';
  preset_id: string | null;
  aspect_ratio: '9:16' | '1:1' | '16:9';
  duration_seconds: 6 | 10 | 15;
  n_variations: number;
  fidelity_mode: boolean;
  hard_fidelity: boolean;
  user_prompt: string | null;
  rewritten_prompt: any;
  shot_plan: any;
  constraints: any;
  negative_prompt: string | null;
  status: 'queued' | 'preprocess' | 'rewrite' | 'generate_candidates' | 'qa_select' | 'retry' | 'fallback' | 'done' | 'failed';
  progress_percent: number;
  current_step: string | null;
  provider: string;
  model: string;
  best_candidate_id: string | null;
  result_url: string | null;
  result_thumbnail_url: string | null;
  fallback_used: boolean;
  qa_summary: {
    total_candidates: number;
    passed_count: number;
    best_score: number;
    fallback_used: boolean;
  } | null;
  cost_credits: number;
  cost_usd: number;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoCandidate {
  id: string;
  job_id: string;
  tenant_id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_actual: number | null;
  qa_similarity_score: number | null;
  qa_label_score: number | null;
  qa_quality_score: number | null;
  qa_temporal_score: number | null;
  qa_final_score: number | null;
  qa_passed: boolean;
  qa_rejection_reason: string | null;
  ocr_extracted_text: string | null;
  is_best: boolean;
  is_fallback: boolean;
  created_at: string;
}

export interface CreateVideoJobInput {
  product_id: string;
  video_type: 'product_video' | 'ugc_ai_video';
  preset_id?: string;
  aspect_ratio?: '9:16' | '1:1' | '16:9';
  duration_seconds?: 6 | 10 | 15;
  n_variations?: number;
  fidelity_mode?: boolean;
  hard_fidelity?: boolean;
  user_prompt?: string;
}

// ============================================================
// HOOKS: VIDEO PRESETS
// ============================================================

export function useVideoPresets(categoryKey?: string) {
  return useQuery({
    queryKey: ['video-presets', categoryKey],
    queryFn: async (): Promise<VideoPreset[]> => {
      let query = supabase
        .from('creative_video_presets')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (categoryKey) {
        query = query.contains('category_applicability', [categoryKey]);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching video presets:', error);
        return [];
      }

      return (data || []) as VideoPreset[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================
// HOOKS: CATEGORY PROFILES
// ============================================================

export function useCategoryProfiles() {
  return useQuery({
    queryKey: ['category-profiles'],
    queryFn: async (): Promise<CategoryProfile[]> => {
      const { data, error } = await supabase
        .from('product_category_profiles')
        .select('*')
        .order('display_name', { ascending: true });

      if (error) {
        console.error('Error fetching category profiles:', error);
        return [];
      }

      return (data || []) as CategoryProfile[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================================
// HOOKS: VIDEO JOBS
// ============================================================

export function useVideoJobs(videoType?: 'product_video' | 'ugc_ai_video') {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['video-jobs', tenantId, videoType],
    queryFn: async (): Promise<VideoJob[]> => {
      if (!tenantId) return [];

      let query = supabase
        .from('creative_video_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (videoType) {
        query = query.eq('video_type', videoType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching video jobs:', error);
        return [];
      }

      return (data || []) as VideoJob[];
    },
    enabled: !!tenantId,
    refetchInterval: 5000, // Atualizar a cada 5s para ver progresso
  });
}

export function useVideoJob(jobId: string | undefined) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['video-job', tenantId, jobId],
    queryFn: async (): Promise<VideoJob | null> => {
      if (!tenantId || !jobId) return null;

      const { data, error } = await supabase
        .from('creative_video_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching video job:', error);
        return null;
      }

      return data as VideoJob;
    },
    enabled: !!tenantId && !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job?.status === 'done' || job?.status === 'failed') {
        return false;
      }
      return 2000; // 2s enquanto processando
    },
  });
}

// ============================================================
// HOOKS: VIDEO CANDIDATES
// ============================================================

export function useVideoCandidates(jobId: string | undefined) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['video-candidates', tenantId, jobId],
    queryFn: async (): Promise<VideoCandidate[]> => {
      if (!tenantId || !jobId) return [];

      const { data, error } = await supabase
        .from('creative_video_candidates')
        .select('*')
        .eq('job_id', jobId)
        .eq('tenant_id', tenantId)
        .order('qa_final_score', { ascending: false });

      if (error) {
        console.error('Error fetching video candidates:', error);
        return [];
      }

      return (data || []) as VideoCandidate[];
    },
    enabled: !!tenantId && !!jobId,
  });
}

// ============================================================
// MUTATIONS
// ============================================================

export function useCreateVideoJob() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVideoJobInput) => {
      if (!currentTenant?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('creative-video-generate', {
        body: {
          tenant_id: currentTenant.id,
          product_id: input.product_id,
          video_type: input.video_type,
          preset_id: input.preset_id,
          aspect_ratio: input.aspect_ratio || '9:16',
          duration_seconds: input.duration_seconds || 10,
          n_variations: input.n_variations || 4,
          fidelity_mode: input.fidelity_mode ?? true,
          hard_fidelity: input.hard_fidelity ?? false,
          user_prompt: input.user_prompt,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar job de vídeo');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido');
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['video-jobs'] });
      toast.success('Geração de vídeo iniciada!', {
        description: `Job criado. Tempo estimado: ${data.estimated_duration_minutes || 3} minutos.`,
      });
    },
    onError: (error: Error) => {
      console.error('Error creating video job:', error);
      toast.error(`Erro ao iniciar geração: ${error.message}`);
    },
  });
}

export function useDeleteVideoJob() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      if (!currentTenant?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { error } = await supabase
        .from('creative_video_jobs')
        .delete()
        .eq('id', jobId)
        .eq('tenant_id', currentTenant.id);

      if (error) {
        throw new Error(error.message || 'Erro ao excluir job');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-jobs'] });
      toast.success('Job excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });
}

export function useSelectBestCandidate() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, candidateId }: { jobId: string; candidateId: string }) => {
      if (!currentTenant?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Desmarcar o best anterior
      await supabase
        .from('creative_video_candidates')
        .update({ is_best: false })
        .eq('job_id', jobId)
        .eq('tenant_id', currentTenant.id);

      // Marcar o novo best
      const { data: candidate, error: candidateError } = await supabase
        .from('creative_video_candidates')
        .update({ is_best: true })
        .eq('id', candidateId)
        .eq('tenant_id', currentTenant.id)
        .select()
        .single();

      if (candidateError) {
        throw new Error(candidateError.message);
      }

      // Atualizar o job com o novo best
      const { error: jobError } = await supabase
        .from('creative_video_jobs')
        .update({
          best_candidate_id: candidateId,
          result_url: candidate.video_url,
          result_thumbnail_url: candidate.thumbnail_url,
        })
        .eq('id', jobId)
        .eq('tenant_id', currentTenant.id);

      if (jobError) {
        throw new Error(jobError.message);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['video-candidates'] });
      toast.success('Vídeo selecionado como principal');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// ============================================================
// HELPERS
// ============================================================

export function getVideoJobStatusColor(status: VideoJob['status']): string {
  switch (status) {
    case 'queued':
      return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'preprocess':
    case 'rewrite':
    case 'generate_candidates':
    case 'qa_select':
    case 'retry':
    case 'fallback':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'done':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'failed':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getVideoJobStatusLabel(status: VideoJob['status']): string {
  switch (status) {
    case 'queued':
      return 'Na fila';
    case 'preprocess':
      return 'Preparando...';
    case 'rewrite':
      return 'Otimizando prompt...';
    case 'generate_candidates':
      return 'Gerando variações...';
    case 'qa_select':
      return 'Avaliando qualidade...';
    case 'retry':
      return 'Tentando novamente...';
    case 'fallback':
      return 'Aplicando fallback...';
    case 'done':
      return 'Concluído';
    case 'failed':
      return 'Falhou';
    default:
      return status;
  }
}
