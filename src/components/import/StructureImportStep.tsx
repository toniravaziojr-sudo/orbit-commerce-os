import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Loader2, FolderTree, FileText, Menu, ArrowRight, SkipForward, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Types for the structure import
export type ImportStepStatus = 'pending' | 'processing' | 'completed' | 'skipped' | 'error';

export interface StructureImportState {
  categories: ImportStepStatus;
  pages: ImportStepStatus;
  menus: ImportStepStatus;
}

export interface ImportStats {
  categories: number;
  pages: number;
  menuItems: number;
}

interface StructureImportStepProps {
  tenantId: string;
  storeUrl: string;
  scrapedData: any;
  analysisResult: { platform?: string; confidence?: string } | null;
  onComplete: (stats: ImportStats) => void;
}

// Required order of import steps (menus LAST - they depend on categories and pages)
const IMPORT_ORDER = ['categories', 'pages', 'menus'] as const;
type ImportStepKey = typeof IMPORT_ORDER[number];

const STEP_CONFIG: Record<ImportStepKey, { label: string; description: string; icon: React.ReactNode }> = {
  categories: {
    label: 'Categorias',
    description: 'Categorias de produtos detectadas nos menus (apenas nome e slug)',
    icon: <FolderTree className="h-5 w-5" />,
  },
  pages: {
    label: 'Páginas Institucionais',
    description: 'Políticas, Termos, Trocas e outras páginas com conteúdo extraído',
    icon: <FileText className="h-5 w-5" />,
  },
  menus: {
    label: 'Menus (Header/Footer)',
    description: 'Estrutura de navegação com hierarquia',
    icon: <Menu className="h-5 w-5" />,
  },
};

export function StructureImportStep({ tenantId, storeUrl, scrapedData, analysisResult, onComplete }: StructureImportStepProps) {
  const [progress, setProgress] = useState<StructureImportState>({
    categories: 'pending',
    pages: 'pending',
    menus: 'pending',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<ImportStepKey | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [stats, setStats] = useState<ImportStats>({
    categories: 0,
    pages: 0,
    menuItems: 0,
  });

  // Check if a step can be started (previous steps must be completed/skipped)
  const canStartStep = useCallback((step: ImportStepKey): boolean => {
    const stepIndex = IMPORT_ORDER.indexOf(step);
    for (let i = 0; i < stepIndex; i++) {
      const prevStep = IMPORT_ORDER[i];
      if (progress[prevStep] === 'pending' || progress[prevStep] === 'processing') {
        return false;
      }
    }
    return progress[step] === 'pending';
  }, [progress]);

  // Check if all steps are done
  const isAllDone = Object.values(progress).every(s => s === 'completed' || s === 'skipped');

  // ========================================
  // IMPORT CATEGORIES via Edge Function (secure multi-tenant)
  // ========================================
  const importCategories = useCallback(async () => {
    setIsProcessing(true);
    setCurrentStep('categories');
    setProgress(p => ({ ...p, categories: 'processing' }));

    try {
      // Step 1: Create or reuse import job
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          tenant_id: tenantId,
          platform: analysisResult?.platform || 'unknown',
          modules: ['categories'],
          status: 'pending',
          source_url: storeUrl,
          started_at: new Date().toISOString(),
          progress: { categories: { current: 0, total: 0 } },
          stats: { categories: { imported: 0, updated: 0, skipped: 0, failed: 0 } },
        })
        .select('id')
        .single();

      if (jobError) {
        console.error('Error creating import job:', jobError);
        throw new Error('Erro ao criar job de importação');
      }

      const jobId = job?.id;
      if (!jobId) throw new Error('Job ID não retornado');

      // Step 2: Call Edge Function (WITHOUT tenant_id - security!)
      const { data: result, error } = await supabase.functions.invoke('import-store-categories', {
        body: { 
          job_id: jobId,
          source_url: storeUrl,
          platform: analysisResult?.platform || 'unknown',
          // DO NOT send tenant_id - it's derived from job in Edge Function
        }
      });

      if (error) {
        // Check if it's a timeout - data may have been imported anyway
        if (error.message?.includes('connection') || error.message?.includes('timeout') || error.message?.includes('FunctionsHttpError')) {
          // Verify if categories were actually created
          const { count } = await supabase
            .from('categories')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId);
          
          if (count && count > 0) {
            setStats(s => ({ ...s, categories: count }));
            setProgress(p => ({ ...p, categories: 'completed' }));
            toast.success(`Importação concluída! ${count} categorias encontradas`);
            return;
          }
        }
        throw new Error(error.message);
      }
      
      if (!result?.success) throw new Error(result?.error || 'Falha na importação');

      const importedCount = (result.stats?.created || 0) + (result.stats?.updated || 0);
      setStats(s => ({ ...s, categories: importedCount }));
      setProgress(p => ({ ...p, categories: 'completed' }));
      
      if (importedCount > 0) {
        toast.success(`${result.stats?.created || 0} categorias criadas, ${result.stats?.updated || 0} atualizadas`);
      } else {
        toast.info('Nenhuma categoria encontrada para importar');
      }
    } catch (err: any) {
      console.error('Error importing categories:', err);
      setErrors(e => [...e, `Categorias: ${err.message}`]);
      setProgress(p => ({ ...p, categories: 'error' }));
      toast.error(`Erro ao importar categorias: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }, [tenantId, storeUrl, analysisResult]);

  // ========================================
  // IMPORT PAGES (simplified: empty placeholders)
  // ========================================
  const importPages = useCallback(async () => {
    setIsProcessing(true);
    setCurrentStep('pages');
    setProgress(p => ({ ...p, pages: 'processing' }));

    try {
      const { data: result, error } = await supabase.functions.invoke('import-institutional-pages', {
        body: { tenantId, storeUrl }
      });

      if (error) throw new Error(error.message);
      if (!result?.success) throw new Error(result?.error || 'Falha na importação');

      const importedCount = result.pages?.length || 0;
      setStats(s => ({ ...s, pages: importedCount }));
      setProgress(p => ({ ...p, pages: 'completed' }));
      
      if (importedCount > 0) {
        toast.success(`${importedCount} páginas importadas com conteúdo`);
      } else {
        toast.info('Nenhuma página institucional detectada');
      }
    } catch (err: any) {
      console.error('Error importing pages:', err);
      setErrors(e => [...e, `Páginas: ${err.message}`]);
      setProgress(p => ({ ...p, pages: 'error' }));
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }, [tenantId, storeUrl]);

  // ========================================
  // IMPORT MENUS via Edge Function (with hierarchy support)
  // ========================================
  const importMenus = useCallback(async () => {
    setIsProcessing(true);
    setCurrentStep('menus');
    setProgress(p => ({ ...p, menus: 'processing' }));

    try {
      const { data: result, error } = await supabase.functions.invoke('import-menus', {
        body: { tenantId, storeUrl }
      });

      if (error) throw new Error(error.message);
      if (!result?.success) throw new Error(result?.error || 'Falha na importação');

      const totalItems = result.totalItems || 0;
      setStats(s => ({ ...s, menuItems: totalItems }));
      setProgress(p => ({ ...p, menus: 'completed' }));
      
      if (totalItems > 0) {
        toast.success(`${totalItems} itens de menu importados (header: ${result.stats?.header || 0}, footer: ${(result.stats?.footer1 || 0) + (result.stats?.footer2 || 0)})`);
      } else {
        toast.info('Nenhum menu encontrado para importar');
      }

      onComplete({ ...stats, menuItems: totalItems });
    } catch (err: any) {
      console.error('Error importing menus:', err);
      setErrors(e => [...e, `Menus: ${err.message}`]);
      setProgress(p => ({ ...p, menus: 'error' }));
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }, [tenantId, storeUrl, stats, onComplete]);

  // Skip a step
  const skipStep = useCallback((step: ImportStepKey) => {
    setProgress(p => ({ ...p, [step]: 'skipped' }));
    toast.info(`${STEP_CONFIG[step].label} pulado`);
    
    if (step === 'menus') {
      onComplete(stats);
    }
  }, [onComplete, stats]);

  // Handler map
  const stepHandlers: Record<ImportStepKey, () => Promise<void>> = {
    categories: importCategories,
    pages: importPages,
    menus: importMenus,
  };

  // Get icon for status
  const getStatusIcon = (status: ImportStepStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'processing': return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'skipped': return <SkipForward className="h-5 w-5 text-muted-foreground" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  // Render stats for a step
  const renderStepStats = (step: ImportStepKey) => {
    if (progress[step] !== 'completed') return null;

    switch (step) {
      case 'categories':
        return `${stats.categories} importadas`;
      case 'pages':
        return stats.pages > 0 ? `${stats.pages} criadas` : 'Nenhuma encontrada';
      case 'menus':
        return `${stats.menuItems} itens`;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Importe na ordem: Categorias → Páginas → Menus.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {IMPORT_ORDER.map((step, index) => {
          const config = STEP_CONFIG[step];
          const status = progress[step];
          const canStart = canStartStep(step);
          const isActive = currentStep === step;

          return (
            <Card key={step} className={`transition-all ${isActive ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      {status === 'pending' ? (
                        <span className="text-sm font-medium">{index + 1}</span>
                      ) : (
                        getStatusIcon(status)
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {config.icon}
                        {config.label}
                        {renderStepStats(step) && (
                          <span className="text-sm font-normal text-muted-foreground">
                            ({renderStepStats(step)})
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {config.description}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => skipStep(step)}
                          disabled={!canStart || isProcessing}
                        >
                          <SkipForward className="h-4 w-4 mr-1" />
                          Pular
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => stepHandlers[step]()}
                          disabled={!canStart || isProcessing}
                        >
                          {isActive ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4 mr-1" />
                          )}
                          Importar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {isAllDone && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            Importação de estrutura concluída! Categorias: {stats.categories}, Páginas: {stats.pages}, Menu: {stats.menuItems} itens.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
