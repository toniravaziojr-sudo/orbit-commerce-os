/**
 * Gestão de Criativos — Hooks
 * 
 * Gerencia jobs de geração, histórico e pasta de criativos
 * NOTA: Este módulo será expandido quando a tabela creative_jobs for criada
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
    staleTime: Infinity, // Folder won't change often
  });
}

// === Hook: Creative Jobs List (Placeholder until table exists) ===
export function useCreativeJobs(type?: CreativeType) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['creative-jobs', tenantId, type],
    queryFn: async (): Promise<CreativeJob[]> => {
      if (!tenantId) return [];
      
      // TODO: When creative_jobs table exists, fetch from database
      // For now, return empty array - module is in development
      return [];
    },
    enabled: !!tenantId,
  });
}

// === Hook: Single Job (Placeholder) ===
export function useCreativeJob(jobId: string | undefined) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['creative-job', tenantId, jobId],
    queryFn: async (): Promise<CreativeJob | null> => {
      if (!tenantId || !jobId) return null;
      
      // TODO: When creative_jobs table exists, fetch from database
      return null;
    },
    enabled: !!tenantId && !!jobId,
  });
}

// === Hook: Create Job (Placeholder) ===
export function useCreateCreativeJob() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      type: CreativeType;
      prompt: string;
      product_id?: string;
      settings: Record<string, unknown>;
      has_authorization?: boolean;
    }) => {
      if (!currentTenant?.id || !user?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Ensure folder exists first
      const folderId = await ensureCreativesFolder(currentTenant.id, user.id);

      // TODO: Create job via edge function when implemented
      // For now, show placeholder message
      toast.info('Módulo em desenvolvimento. A geração será implementada em breve.');
      
      return { success: true, job_id: null, folder_id: folderId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative-jobs'] });
    },
    onError: (error: Error) => {
      console.error('Error creating creative job:', error);
      toast.error(`Erro ao iniciar geração: ${error.message}`);
    },
  });
}

// === Hook: Retry Job (Placeholder) ===
export function useRetryCreativeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      // TODO: Implement retry via edge function
      toast.info('Funcionalidade em desenvolvimento.');
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative-jobs'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reprocessar: ${error.message}`);
    },
  });
}

// === Hook: Job Statistics (Placeholder) ===
export function useCreativeStats() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['creative-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // TODO: When creative_jobs table exists, calculate real stats
      // For now, return empty stats
      return {
        total: 0,
        queued: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        totalCost: 0,
        byType: {} as Record<CreativeType, number>,
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
