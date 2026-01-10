import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExtractedSection {
  type: string;
  order: number;
  rawHtml: string;
  metadata?: {
    title?: string;
    itemCount?: number;
    hasImages?: boolean;
    hasCta?: boolean;
    hasVideo?: boolean;
  };
}

export interface ImportedPage {
  type: 'home' | 'institutional' | 'category';
  url: string;
  title: string;
  slug: string;
  sections: ExtractedSection[];
  success: boolean;
  error?: string;
}

export interface BlockImportResult {
  success: boolean;
  homeTemplate?: {
    id: string;
    sectionsCount: number;
  };
  pages: ImportedPage[];
  totalSections: number;
  errors: string[];
}

export interface BlockImportProgress {
  status: 'idle' | 'processing' | 'completed' | 'error';
  currentStep: string;
  progress: number;
  homeSections: number;
  pagesImported: number;
  totalSections: number;
}

export function useBlockImport() {
  const [progress, setProgress] = useState<BlockImportProgress>({
    status: 'idle',
    currentStep: '',
    progress: 0,
    homeSections: 0,
    pagesImported: 0,
    totalSections: 0,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const importBlocks = useCallback(async (
    tenantId: string,
    storeUrl: string,
    platform?: string
  ): Promise<BlockImportResult> => {
    setProgress({
      status: 'processing',
      currentStep: 'Iniciando extração de blocos...',
      progress: 0,
      homeSections: 0,
      pagesImported: 0,
      totalSections: 0,
    });
    setErrors([]);

    try {
      // Step 1: Fetch the store URL to extract content
      setProgress(p => ({ ...p, currentStep: 'Analisando página inicial...', progress: 10 }));
      
      const { data, error } = await supabase.functions.invoke('import-pages-with-blocks', {
        body: {
          tenantId,
          storeUrl,
          platform,
        }
      });

      if (error) {
        throw new Error(error.message || 'Falha na importação de blocos');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido na importação');
      }

      setProgress(p => ({
        ...p,
        status: 'completed',
        currentStep: 'Importação concluída!',
        progress: 100,
        homeSections: data.homeSectionsCount || 0,
        pagesImported: data.pagesImported || 0,
        totalSections: data.totalSections || 0,
      }));

      toast.success(`Importados ${data.totalSections || 0} blocos de ${data.pagesImported + 1} páginas`);

      return {
        success: true,
        homeTemplate: data.homeTemplate ? {
          id: data.homeTemplate.id,
          sectionsCount: data.homeSectionsCount || 0,
        } : undefined,
        pages: data.pages || [],
        totalSections: data.totalSections || 0,
        errors: data.errors || [],
      };
    } catch (err: any) {
      console.error('Block import error:', err);
      const errorMsg = err.message || 'Erro desconhecido';
      setErrors(e => [...e, errorMsg]);
      setProgress(p => ({
        ...p,
        status: 'error',
        currentStep: `Erro: ${errorMsg}`,
      }));
      toast.error(`Erro ao importar blocos: ${errorMsg}`);

      return {
        success: false,
        pages: [],
        totalSections: 0,
        errors: [errorMsg],
      };
    }
  }, []);

  const reset = useCallback(() => {
    setProgress({
      status: 'idle',
      currentStep: '',
      progress: 0,
      homeSections: 0,
      pagesImported: 0,
      totalSections: 0,
    });
    setErrors([]);
  }, []);

  return {
    importBlocks,
    progress,
    errors,
    reset,
    isProcessing: progress.status === 'processing',
    isCompleted: progress.status === 'completed',
    hasError: progress.status === 'error',
  };
}
