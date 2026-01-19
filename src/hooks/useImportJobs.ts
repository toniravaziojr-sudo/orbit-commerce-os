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

  const clearTenantData = useMutation({
    mutationFn: async (modules: string[]) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase.functions.invoke('tenant-clear-data', {
        body: { tenantId, modules },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao limpar dados');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['categories', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['customers', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['import-jobs', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['store-pages', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['menus'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['store-settings', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['blog-posts', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['storefront-templates', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['page-builder'] });
      
      const totalDeleted = Object.values(data.deleted as Record<string, number>).reduce((a, b) => a + b, 0);
      toast.success(`${totalDeleted} registros removidos com sucesso`);
    },
    onError: (error) => {
      toast.error('Erro ao limpar dados: ' + error.message);
    },
  });

  return {
    jobs,
    isLoading,
    error,
    createJob,
    updateJobStatus,
    deleteJob,
    clearTenantData,
  };
}

const BATCH_SIZE = 30;

export function useImportData() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const { createJob, updateJobStatus } = useImportJobs();

  const importData = async (
    platform: string,
    module: 'products' | 'categories' | 'customers' | 'orders',
    data: any[],
    categoryMap?: Record<string, string> // slug -> id for linking products to categories
  ) => {
    if (!tenantId) throw new Error('Tenant ID required');
    if (!data || data.length === 0) {
      return { success: true, results: { imported: 0, failed: 0 } };
    }

    // Create a job for tracking
    const job = await createJob.mutateAsync({ 
      platform, 
      modules: [module] 
    });

    const totalBatches = Math.ceil(data.length / BATCH_SIZE);
    let totalImported = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const allErrors: any[] = [];

    // Mark job as processing
    try {
      await updateJobStatus.mutateAsync({
        jobId: job.id,
        status: 'processing',
        progress: { [module]: { current: 0, total: data.length } },
      });
    } catch (e) {
      console.warn('[useImportData] Could not update job status to processing:', e);
    }

    // Process in batches using import-batch function
    for (let i = 0; i < totalBatches; i++) {
      const batchItems = data.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      
      try {
        console.log(`[useImportData] Sending batch ${i + 1}/${totalBatches} for ${module} (${batchItems.length} items)`);
        
        const { data: result, error } = await supabase.functions.invoke('import-batch', {
          body: {
            jobId: job.id,
            tenantId,
            platform,
            module,
            items: batchItems,
            batchIndex: i,
            categoryMap,
          },
        });

        if (error) {
          console.error(`[useImportData] Batch ${i} error:`, error);
          totalFailed += batchItems.length;
          allErrors.push({ batch: i, error: error.message });
        } else if (result?.success && result.results) {
          totalImported += result.results.imported || 0;
          totalUpdated += result.results.updated || 0;
          totalFailed += result.results.failed || 0;
          totalSkipped += result.results.skipped || 0;
          
          if (result.results.itemErrors?.length > 0) {
            allErrors.push(...result.results.itemErrors);
          }
        } else {
          console.error(`[useImportData] Batch ${i} failed:`, result?.error);
          totalFailed += batchItems.length;
          allErrors.push({ batch: i, error: result?.error || 'Erro desconhecido' });
        }
      } catch (err: any) {
        console.error(`[useImportData] Batch ${i} exception:`, err);
        totalFailed += batchItems.length;
        allErrors.push({ batch: i, error: err.message });
      }

      // Small delay between batches
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // CRITICAL: Finalize job with completed status
    const finalStatus = totalFailed < data.length ? 'completed' : 'failed';
    try {
      await updateJobStatus.mutateAsync({
        jobId: job.id,
        status: finalStatus,
        progress: { [module]: { current: data.length, total: data.length } },
        stats: {
          [module]: {
            imported: totalImported,
            updated: totalUpdated,
            failed: totalFailed,
            skipped: totalSkipped,
            total: data.length,
          },
        },
      });
    } catch (e) {
      console.warn('[useImportData] Could not update job status to completed:', e);
    }

    return {
      success: totalFailed < data.length,
      results: {
        imported: totalImported + totalUpdated,
        failed: totalFailed,
        skipped: totalSkipped,
        errors: allErrors,
      },
    };
  };

  return { importData };
}
