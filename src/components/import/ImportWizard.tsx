import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { PlatformSelector } from './PlatformSelector';
import { ModuleSelector } from './ModuleSelector';
import { DataUploader } from './DataUploader';
import { DataPreview } from './DataPreview';
import { ImportProgress } from './ImportProgress';
import { ImportServiceStatus } from './ImportServiceStatus';
import { useImportJobs } from '@/hooks/useImportJobs';
import { useImportService } from '@/hooks/useImportService';
import { getAdapter } from '@/lib/import/platforms';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface ImportWizardProps {
  onComplete?: () => void;
}

type Step = 'platform' | 'modules' | 'upload' | 'preview' | 'importing' | 'complete';

export function ImportWizard({ onComplete }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('platform');
  const [platform, setPlatform] = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, any[]>>({});
  const [normalizedData, setNormalizedData] = useState<Record<string, any[]>>({});
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [stats, setStats] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serviceOnline, setServiceOnline] = useState(false);

  const { currentTenant } = useAuth();
  const { createJob, updateJobStatus } = useImportJobs();
  const { checkHealth, importWithBatches, health } = useImportService();

  // Check service health when entering preview step
  useEffect(() => {
    if (step === 'preview') {
      checkHealth();
    }
  }, [step, checkHealth]);

  const handleModuleToggle = useCallback((module: string) => {
    setModules(prev => 
      prev.includes(module) 
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  }, []);

  const handleDataLoaded = useCallback((data: Record<string, any[]>) => {
    setRawData(data);
    
    // Normalize data based on platform
    if (platform) {
      const adapter = getAdapter(platform as any);
      const normalized: Record<string, any[]> = {};
      
      Object.entries(data).forEach(([module, items]) => {
        try {
          if (module === 'products' && adapter?.normalizeProduct) {
            normalized.products = items.map(item => adapter.normalizeProduct!(item));
          } else if (module === 'categories' && adapter?.normalizeCategory) {
            normalized.categories = items.map(item => adapter.normalizeCategory!(item));
          } else if (module === 'customers' && adapter?.normalizeCustomer) {
            normalized.customers = items.map(item => adapter.normalizeCustomer!(item));
          } else if (module === 'orders' && adapter?.normalizeOrder) {
            normalized.orders = items.map(item => adapter.normalizeOrder!(item));
          } else {
            normalized[module] = items;
          }
        } catch (error: any) {
          console.error(`Error normalizing ${module}:`, error);
          toast.error(`Erro ao normalizar ${module}: ${error.message}`);
        }
      });
      
      setNormalizedData(normalized);
    }
  }, [platform]);

  const handleStartImport = useCallback(async () => {
    if (!platform || !currentTenant?.id) return;

    // Double-check service is online
    const isOnline = await checkHealth();
    if (!isOnline) {
      toast.error('Serviço de importação indisponível. Tente novamente.');
      return;
    }

    setStep('importing');
    setIsProcessing(true);
    setErrors([]);

    try {
      const job = await createJob.mutateAsync({ platform, modules });
      
      const allErrors: any[] = [];
      const allStats: Record<string, any> = {};
      const importProgress: Record<string, any> = {};

      // Build category map if importing products with categories
      let categoryMap: Record<string, string> | undefined;
      if (modules.includes('products') && normalizedData.categories?.length > 0) {
        // First import categories and build the map
        // This would require fetching categories after import to get IDs
      }

      for (const module of modules) {
        const data = normalizedData[module];
        if (!data?.length) continue;

        importProgress[module] = { current: 0, total: data.length, status: 'processing' };
        setProgress({ ...importProgress });

        try {
          const result = await importWithBatches(
            currentTenant.id,
            platform,
            module as any,
            data,
            job.id,
            categoryMap,
            (batchProgress) => {
              importProgress[module] = {
                current: batchProgress.processedItems,
                total: batchProgress.totalItems,
                status: batchProgress.status === 'completed' ? 'completed' : 
                        batchProgress.status === 'failed' ? 'failed' : 'processing',
                batch: `${batchProgress.currentBatch}/${batchProgress.totalBatches}`,
              };
              setProgress({ ...importProgress });
              
              // Collect errors as they come in
              if (batchProgress.errors.length > 0) {
                allErrors.push(...batchProgress.errors.filter(e => 
                  !allErrors.some(existing => 
                    existing.identifier === e.identifier && existing.error === e.error
                  )
                ));
                setErrors([...allErrors]);
              }
            }
          );

          allStats[module] = {
            imported: result.results.reduce((sum, r) => sum + r.imported + r.updated, 0),
            skipped: result.results.reduce((sum, r) => sum + r.skipped, 0),
            failed: result.results.reduce((sum, r) => sum + r.failed, 0),
          };

          importProgress[module] = { 
            current: data.length, 
            total: data.length, 
            status: result.success ? 'completed' : 'completed_with_errors' 
          };
        } catch (error: any) {
          console.error(`[ImportWizard] Module ${module} failed:`, error);
          importProgress[module] = { current: 0, total: data.length, status: 'failed' };
          allErrors.push({ item: module, error: error.message });
        }

        setProgress({ ...importProgress });
        setStats({ ...allStats });
      }

      setErrors(allErrors);

      await updateJobStatus.mutateAsync({
        jobId: job.id,
        status: allErrors.length > 0 ? 'completed' : 'completed',
        progress: importProgress,
        stats: allStats,
      });

      setStep('complete');
      
      const totalImported = Object.values(allStats).reduce((sum: number, s: any) => 
        sum + (s.imported || 0), 0
      );
      toast.success(`Importação concluída! ${totalImported} itens importados.`);
    } catch (error: any) {
      toast.error('Erro na importação: ' + error.message);
      setStep('complete');
    } finally {
      setIsProcessing(false);
    }
  }, [platform, modules, normalizedData, currentTenant?.id, createJob, updateJobStatus, checkHealth, importWithBatches]);

  const canProceed = () => {
    switch (step) {
      case 'platform': return !!platform;
      case 'modules': return modules.length > 0;
      case 'upload': return Object.keys(normalizedData).length > 0;
      case 'preview': return serviceOnline;
      default: return false;
    }
  };

  const handleNext = () => {
    const steps: Step[] = ['platform', 'modules', 'upload', 'preview'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    } else if (step === 'preview') {
      handleStartImport();
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['platform', 'modules', 'upload', 'preview'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>
          {step === 'platform' && 'Importar Dados'}
          {step === 'modules' && 'Selecionar Módulos'}
          {step === 'upload' && 'Carregar Dados'}
          {step === 'preview' && 'Revisar Dados'}
          {step === 'importing' && 'Importando...'}
          {step === 'complete' && 'Importação Concluída'}
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-[400px]">
        {step === 'platform' && (
          <PlatformSelector selected={platform} onSelect={setPlatform} />
        )}

        {step === 'modules' && (
          <ModuleSelector selected={modules} onToggle={handleModuleToggle} />
        )}

        {step === 'upload' && platform && (
          <DataUploader
            platform={platform}
            modules={modules}
            onDataLoaded={handleDataLoaded}
          />
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <ImportServiceStatus 
              onStatusChange={setServiceOnline} 
              autoCheck={true}
            />
            <DataPreview data={normalizedData} modules={modules} />
          </div>
        )}

        {(step === 'importing' || step === 'complete') && (
          <ImportProgress
            modules={modules}
            progress={progress}
            stats={stats}
            status={step === 'importing' ? 'processing' : 'completed'}
            errors={errors}
          />
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {step !== 'platform' && step !== 'importing' && step !== 'complete' && (
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        )}

        {step === 'complete' && (
          <Button variant="outline" onClick={onComplete}>
            Fechar
          </Button>
        )}

        {step !== 'importing' && step !== 'complete' && (
          <Button 
            onClick={handleNext} 
            disabled={!canProceed() || isProcessing}
            className="ml-auto"
          >
            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {step === 'preview' ? 'Iniciar Importação' : 'Próximo'}
            {step !== 'preview' && <ChevronRight className="h-4 w-4 ml-2" />}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
