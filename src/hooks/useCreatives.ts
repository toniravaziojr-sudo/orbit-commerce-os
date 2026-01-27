/**
 * Gestão de Criativos — Hooks
 * 
 * Gerencia jobs de geração, histórico e pasta de criativos
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type {
  CreativeJob,
  CreativeType,
  CreativeJobStatus,
} from '@/types/creatives';

const FOLDER_NAME = 'Criativos com IA';

// === Ensure Creatives Folder Exists ===
async function ensureCreativesFolder(tenantId: string, userId: string): Promise<string | null> {
  // Check if folder already exists
  const { data: existing } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('filename', FOLDER_NAME)
    .eq('is_folder', true)
    .maybeSingle();

  if (existing) return existing.id;

  // Get system folder to create inside it
  const { data: systemFolder } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_system_folder', true)
    .maybeSingle();

  // Create the folder
  const { data: newFolder, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: systemFolder?.id || null,
      filename: FOLDER_NAME,
      original_name: FOLDER_NAME,
      storage_path: `${tenantId}/criativos-ia/`,
      is_folder: true,
      is_system_folder: false,
      created_by: userId,
      metadata: { source: 'creatives_module', system_managed: true },
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating creatives folder:', error);
    return null;
  }

  return newFolder?.id || null;
}

// === Hook: Creatives Folder ===
export function useCreativesFolder() {
  const { currentTenant, user } = useAuth();
  const tenantId = currentTenant?.id;
  const userId = user?.id;

  return useQuery({
    queryKey: ['creatives-folder', tenantId],
    queryFn: async () => {
      if (!tenantId || !userId) return null;
      return ensureCreativesFolder(tenantId, userId);
    },
    enabled: !!tenantId && !!userId,
    staleTime: Infinity,
  });
}

// === Hook: Creative Jobs List ===
export function useCreativeJobs(type?: CreativeType) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['creative-jobs', tenantId, type],
    queryFn: async (): Promise<CreativeJob[]> => {
      if (!tenantId) return [];

      let query = supabase
        .from('creative_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching creative jobs:', error);
        return [];
      }

      return (data || []) as unknown as CreativeJob[];
    },
    enabled: !!tenantId,
    refetchInterval: 10000, // Atualizar a cada 10s para ver status
  });
}

// === Hook: Single Job ===
export function useCreativeJob(jobId: string | undefined) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['creative-job', tenantId, jobId],
    queryFn: async (): Promise<CreativeJob | null> => {
      if (!tenantId || !jobId) return null;

      const { data, error } = await supabase
        .from('creative_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching creative job:', error);
        return null;
      }

      return data as unknown as CreativeJob;
    },
    enabled: !!tenantId && !!jobId,
    refetchInterval: (query) => {
      // Parar de atualizar quando job terminar
      const job = query.state.data;
      if (job?.status === 'succeeded' || job?.status === 'failed') {
        return false;
      }
      return 3000; // 3s enquanto processando
    },
  });
}

// === Hook: Create Job ===
export function useCreateCreativeJob() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      type: CreativeType;
      prompt: string;
      product_id?: string;
      product_name?: string;
      product_image_url?: string;
      reference_images?: string[];
      reference_video_url?: string;
      reference_audio_url?: string;
      settings: Record<string, unknown>;
      has_authorization?: boolean;
    }) => {
      if (!currentTenant?.id || !user?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('creative-generate', {
        body: {
          tenant_id: currentTenant.id,
          ...params,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar job');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido');
      }

      return data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creative-jobs'] });
      toast.success('Geração iniciada!', {
        description: `Job ${data.job_id} criado com sucesso.`,
      });
    },
    onError: (error: Error) => {
      console.error('Error creating creative job:', error);
      toast.error(`Erro ao iniciar geração: ${error.message}`);
    },
  });
}

// === Hook: Retry Job ===
export function useRetryCreativeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke('creative-process', {
        body: { job_id: jobId },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao reprocessar');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative-jobs'] });
      toast.success('Reprocessamento iniciado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reprocessar: ${error.message}`);
    },
  });
}

// === Hook: Job Statistics ===
export function useCreativeStats() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['creative-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('creative_jobs')
        .select('status, type, cost_cents')
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error fetching creative stats:', error);
        return null;
      }

      const jobs = data || [];

      const byType: Record<CreativeType, number> = {
        ugc_client_video: 0,
        ugc_ai_video: 0,
        short_video: 0,
        tech_product_video: 0,
        product_image: 0,
      };

      let queued = 0, running = 0, succeeded = 0, failed = 0, totalCost = 0;

      for (const job of jobs) {
        switch (job.status) {
          case 'queued': queued++; break;
          case 'running': running++; break;
          case 'succeeded': succeeded++; break;
          case 'failed': failed++; break;
        }
        if (job.type && byType[job.type as CreativeType] !== undefined) {
          byType[job.type as CreativeType]++;
        }
        totalCost += job.cost_cents || 0;
      }

      return {
        total: jobs.length,
        queued,
        running,
        succeeded,
        failed,
        totalCost,
        byType,
      };
    },
    enabled: !!tenantId,
  });
}

// === Helper: Get Status Color ===
export function getStatusColor(status: CreativeJobStatus): string {
  switch (status) {
    case 'queued': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'running': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'succeeded': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'failed': return 'bg-red-500/10 text-red-600 border-red-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function getStatusLabel(status: CreativeJobStatus): string {
  switch (status) {
    case 'queued': return 'Na fila';
    case 'running': return 'Processando';
    case 'succeeded': return 'Concluído';
    case 'failed': return 'Falhou';
    default: return status;
  }
}
