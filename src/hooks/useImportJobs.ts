import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ImportJob {
  id: string;
  tenant_id: string;
  platform: string;
  status: string;
  modules: any;
  progress: any;
  source_url: string | null;
  stats: any;
  errors: any;
  warnings: any;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function useImportJobs() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading, error } = useQuery({
    queryKey: ['import-jobs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ImportJob[];
    },
    enabled: !!tenantId,
  });

  // Realtime subscription for job updates
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('import-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'import_jobs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['import-jobs', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  const createJob = useMutation({
    mutationFn: async (params: { platform: string; modules: string[] }) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('import_jobs')
        .insert({
          tenant_id: tenantId,
          platform: params.platform,
          modules: params.modules,
          status: 'pending',
          progress: {},
          stats: {},
          errors: [],
          warnings: [],
        })
        .select()
        .single();

      if (error) throw error;
      return data as ImportJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs', tenantId] });
    },
    onError: (error) => {
      toast.error('Erro ao criar job de importação: ' + error.message);
    },
  });

  const updateJobStatus = useMutation({
    mutationFn: async (params: { jobId: string; status: string; progress?: any; stats?: any }) => {
      const updateData: any = { status: params.status };
      if (params.progress) updateData.progress = params.progress;
      if (params.stats) updateData.stats = params.stats;

      if (params.status === 'processing' && !params.progress?.started_at) {
        updateData.started_at = new Date().toISOString();
      }
      if (params.status === 'completed' || params.status === 'failed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('import_jobs')
        .update(updateData)
        .eq('id', params.jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs', tenantId] });
    },
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('import_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs', tenantId] });
      toast.success('Job removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover job: ' + error.message);
    },
  });

  return {
    jobs,
    isLoading,
    error,
    createJob,
    updateJobStatus,
    deleteJob,
  };
}

export function useImportData() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const importData = async (
    platform: string,
    module: 'products' | 'categories' | 'customers' | 'orders',
    data: any[]
  ) => {
    if (!tenantId) throw new Error('Tenant ID required');

    const { data: result, error } = await supabase.functions.invoke('import-data', {
      body: { tenantId, platform, module, data },
    });

    if (error) throw error;
    return result;
  };

  return { importData };
}
