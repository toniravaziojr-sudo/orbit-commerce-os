import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HealthStatus {
  online: boolean;
  version: string | null;
  error: string | null;
  checkedAt: Date | null;
}

interface BatchResult {
  batchIndex: number;
  processed: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  itemErrors: Array<{ index: number; identifier: string; error: string }>;
}

interface ImportProgress {
  totalItems: number;
  processedItems: number;
  importedItems: number;
  failedItems: number;
  skippedItems: number;
  currentBatch: number;
  totalBatches: number;
  status: 'idle' | 'checking' | 'importing' | 'completed' | 'failed';
  errors: Array<{ index: number; identifier: string; error: string }>;
}

// Batch sizes per module type - optimized for each data type
const BATCH_SIZES: Record<string, number> = {
  customers: 200,  // Customers have batch upsert, can handle more
  products: 50,    // Products have images/variants, moderate
  categories: 100, // Categories are simple
  orders: 100,     // Orders need customer lookup, but can batch better
};
const DEFAULT_BATCH_SIZE = 50;

export function useImportService() {
  const [health, setHealth] = useState<HealthStatus>({
    online: false,
    version: null,
    error: null,
    checkedAt: null,
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-data-health', {
        method: 'GET',
      });

      if (error) {
        console.error('[useImportService] Health check network error:', error);
        setHealth({
          online: false,
          version: null,
          error: `Falha na conexão: ${error.message}`,
          checkedAt: new Date(),
        });
        return false;
      }

      if (data?.success) {
        setHealth({
          online: true,
          version: data.version,
          error: null,
          checkedAt: new Date(),
        });
        return true;
      } else {
        setHealth({
          online: false,
          version: null,
          error: data?.error || 'Serviço indisponível',
          checkedAt: new Date(),
        });
        return false;
      }
    } catch (err: any) {
      console.error('[useImportService] Health check exception:', err);
      setHealth({
        online: false,
        version: null,
        error: `Erro inesperado: ${err.message}`,
        checkedAt: new Date(),
      });
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const importWithBatches = useCallback(async (
    tenantId: string,
    platform: string,
    module: 'products' | 'categories' | 'customers' | 'orders',
    items: any[],
    jobId: string,
    categoryMap?: Record<string, string>,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<{ success: boolean; results: BatchResult[]; error?: string }> => {
    // Use module-specific batch size for optimal performance
    const batchSize = BATCH_SIZES[module] || DEFAULT_BATCH_SIZE;
    const totalBatches = Math.ceil(items.length / batchSize);
    const allResults: BatchResult[] = [];
    const allErrors: Array<{ index: number; identifier: string; error: string }> = [];
    
    let totalProcessed = 0;
    let totalImported = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    const updateProgress = (status: ImportProgress['status'], currentBatch: number) => {
      onProgress?.({
        totalItems: items.length,
        processedItems: totalProcessed,
        importedItems: totalImported,
        failedItems: totalFailed,
        skippedItems: totalSkipped,
        currentBatch,
        totalBatches,
        status,
        errors: allErrors.slice(0, 20), // Keep only first 20 errors for UI
      });
    };

    updateProgress('importing', 0);

    console.log(`[useImportService] Starting ${module} import: ${items.length} items in ${totalBatches} batches of ${batchSize}`);

    for (let i = 0; i < totalBatches; i++) {
      const batchItems = items.slice(i * batchSize, (i + 1) * batchSize);
      
      try {
        console.log(`[useImportService] Sending batch ${i + 1}/${totalBatches} for ${module} (${batchItems.length} items)`);
        
        const { data, error } = await supabase.functions.invoke('import-batch', {
          body: {
            jobId,
            tenantId,
            platform,
            module,
            items: batchItems,
            batchIndex: i,
            categoryMap,
          },
        });

        if (error) {
          console.error(`[useImportService] Batch ${i} network error:`, error);
          // Don't abort entire import on batch failure - record and continue
          allErrors.push({
            index: i * batchSize,
            identifier: `batch-${i}`,
            error: `Erro de rede no batch ${i + 1}: ${error.message}`,
          });
          totalFailed += batchItems.length;
          totalProcessed += batchItems.length;
        } else if (data?.success && data.results) {
          const result = data.results as BatchResult;
          allResults.push(result);
          
          totalProcessed += result.processed;
          totalImported += result.imported + result.updated;
          totalFailed += result.failed;
          totalSkipped += result.skipped;
          
          if (result.itemErrors?.length > 0) {
            allErrors.push(...result.itemErrors.map(e => ({
              ...e,
              index: e.index + (i * batchSize), // Adjust index for global position
            })));
          }
        } else {
          console.error(`[useImportService] Batch ${i} failed:`, data?.error);
          allErrors.push({
            index: i * batchSize,
            identifier: `batch-${i}`,
            error: data?.error || 'Erro desconhecido no batch',
          });
          totalFailed += batchItems.length;
          totalProcessed += batchItems.length;
        }

        updateProgress('importing', i + 1);
      } catch (err: any) {
        console.error(`[useImportService] Batch ${i} exception:`, err);
        allErrors.push({
          index: i * batchSize,
          identifier: `batch-${i}`,
          error: `Exceção no batch ${i + 1}: ${err.message}`,
        });
        totalFailed += batchItems.length;
        totalProcessed += batchItems.length;
        updateProgress('importing', i + 1);
      }

      // Small delay between batches to prevent rate limiting
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const finalStatus = totalFailed === items.length ? 'failed' : 'completed';
    updateProgress(finalStatus, totalBatches);

    return {
      success: totalFailed < items.length,
      results: allResults,
      error: allErrors.length > 0 ? `${allErrors.length} erro(s) durante importação` : undefined,
    };
  }, []);

  return {
    health,
    isChecking,
    checkHealth,
    importWithBatches,
    batchSize: DEFAULT_BATCH_SIZE,
  };
}
