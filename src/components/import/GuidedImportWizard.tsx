import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Package, FolderTree, Users, ShoppingCart, Palette, Globe, CheckCircle2 } from 'lucide-react';
import { StoreUrlInput } from './StoreUrlInput';
import { ImportStep, ImportStepConfig } from './ImportStep';
import { useImportJobs, useImportData } from '@/hooks/useImportJobs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getAdapter } from '@/lib/import/platforms';
import { useAuth } from '@/hooks/useAuth';
interface GuidedImportWizardProps {
  onComplete?: () => void;
}

type WizardStep = 'url' | 'import-steps' | 'complete';

interface StepStatus {
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'processing';
  importedCount?: number;
}

const IMPORT_STEPS: ImportStepConfig[] = [
  {
    id: 'products',
    title: 'Produtos',
    description: 'Importar produtos, variantes e imagens via arquivo JSON ou CSV',
    icon: <Package className="h-5 w-5" />,
    canSkip: true,
    importMethod: 'file',
  },
  {
    id: 'customers',
    title: 'Clientes',
    description: 'Importar clientes e endereços via arquivo JSON ou CSV',
    icon: <Users className="h-5 w-5" />,
    canSkip: true,
    importMethod: 'file',
  },
  {
    id: 'orders',
    title: 'Pedidos',
    description: 'Importar histórico de pedidos via arquivo JSON ou CSV',
    icon: <ShoppingCart className="h-5 w-5" />,
    canSkip: true,
    importMethod: 'file',
  },
  {
    id: 'categories',
    title: 'Categorias',
    description: 'Extrair categorias e menu de navegação automaticamente do site',
    icon: <FolderTree className="h-5 w-5" />,
    required: true,
    canSkip: false,
    importMethod: 'scrape',
  },
  {
    id: 'visual',
    title: 'Visual da Loja',
    description: 'Extrair banners, logos, cores e identidade visual automaticamente',
    icon: <Palette className="h-5 w-5" />,
    requiresPrevious: ['categories'],
    canSkip: false,
    importMethod: 'scrape',
  },
];

export function GuidedImportWizard({ onComplete }: GuidedImportWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('url');
  const [storeUrl, setStoreUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    success: boolean;
    platform?: string;
    error?: string;
    data?: any;
  } | null>(null);
  
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(() => {
    const initial: Record<string, StepStatus> = {};
    IMPORT_STEPS.forEach((step, index) => {
      initial[step.id] = { status: index === 0 ? 'active' : 'pending' };
    });
    return initial;
  });

  const [scrapedData, setScrapedData] = useState<any>(null);
  const { createJob } = useImportJobs();
  const { importData } = useImportData();
  const { currentTenant } = useAuth();
  const handleAnalyzeStore = useCallback(async () => {
    if (!storeUrl.trim()) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      let formattedUrl = storeUrl.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { 
          url: formattedUrl,
          options: {
            formats: ['markdown', 'html', 'links', 'branding'],
            onlyMainContent: false,
          }
        },
      });

      if (error) throw error;

      if (data?.success) {
        setScrapedData(data.data || data);
        setAnalysisResult({
          success: true,
          platform: detectPlatformFromHtml(data.data?.html || data.html || ''),
          data: data.data || data,
        });
        toast.success('Loja analisada com sucesso!');
      } else {
        throw new Error(data?.error || 'Falha ao analisar a loja');
      }
    } catch (error: any) {
      console.error('Error analyzing store:', error);
      setAnalysisResult({
        success: false,
        error: error.message || 'Não foi possível analisar a loja. Verifique a URL.',
      });
      toast.error('Erro ao analisar a loja');
    } finally {
      setIsAnalyzing(false);
    }
  }, [storeUrl]);

  const detectPlatformFromHtml = (html: string): string => {
    if (html.includes('Shopify') || html.includes('shopify')) return 'Shopify';
    if (html.includes('WooCommerce') || html.includes('woocommerce')) return 'WooCommerce';
    if (html.includes('Nuvemshop') || html.includes('nuvemshop')) return 'Nuvemshop';
    if (html.includes('VTEX') || html.includes('vtex')) return 'VTEX';
    if (html.includes('Loja Integrada') || html.includes('lojaintegrada')) return 'Loja Integrada';
    if (html.includes('Tray') || html.includes('tray.com')) return 'Tray';
    if (html.includes('Yampi') || html.includes('yampi')) return 'Yampi';
    return 'Plataforma não identificada';
  };

  const moveToNextStep = useCallback((currentStepId: string) => {
    const currentIndex = IMPORT_STEPS.findIndex(s => s.id === currentStepId);
    if (currentIndex < IMPORT_STEPS.length - 1) {
      const nextStep = IMPORT_STEPS[currentIndex + 1];
      setStepStatuses(prev => ({
        ...prev,
        [nextStep.id]: { status: 'active' },
      }));
    } else {
      setWizardStep('complete');
    }
  }, []);

  const parseFileContent = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          if (file.name.endsWith('.json')) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              resolve(parsed);
            } else {
              resolve(parsed.data || parsed.items || parsed.products || parsed.customers || parsed.orders || [parsed]);
            }
          } else if (file.name.endsWith('.csv')) {
            resolve(parseCSV(content));
          } else {
            reject(new Error('Formato não suportado. Use JSON ou CSV.'));
          }
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file);
    });
  };

  const parseCSV = (content: string): any[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index];
        });
        data.push(obj);
      }
    }

    return data;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImportStep = useCallback(async (stepId: string, file?: File) => {
    const step = IMPORT_STEPS.find(s => s.id === stepId);
    if (!step) return;

    setStepStatuses(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], status: 'processing' },
    }));

    try {
      let importedCount = 0;

      if (step.importMethod === 'file' && file) {
        const data = await parseFileContent(file);
        
        if (data.length === 0) {
          throw new Error('Arquivo vazio ou sem dados válidos');
        }

        // Normalize and import data
        const platform = analysisResult?.platform?.toLowerCase() || 'generic';
        const adapter = getAdapter(platform as any);
        
        let normalizedData = data;
        if (adapter) {
          if (stepId === 'products' && adapter.normalizeProduct) {
            normalizedData = data.map(item => adapter.normalizeProduct!(item));
          } else if (stepId === 'customers' && adapter.normalizeCustomer) {
            normalizedData = data.map(item => adapter.normalizeCustomer!(item));
          } else if (stepId === 'orders' && adapter.normalizeOrder) {
            normalizedData = data.map(item => adapter.normalizeOrder!(item));
          }
        }

        const result = await importData(platform, stepId as any, normalizedData);
        importedCount = result?.results?.imported || data.length;
        
      } else if (step.importMethod === 'scrape' && scrapedData) {
        if (!currentTenant?.id) {
          throw new Error('Tenant não encontrado');
        }

        if (stepId === 'categories') {
          // Extract categories from links
          const links = scrapedData.links || [];
          const categoryLinks = links.filter((link: string) => 
            link.includes('/categoria') || 
            link.includes('/category') || 
            link.includes('/collections') ||
            link.includes('/c/')
          );
          
          // Extract category names from URLs
          const categories = categoryLinks.map((link: string) => {
            const url = new URL(link);
            const pathParts = url.pathname.split('/').filter(Boolean);
            const slug = pathParts[pathParts.length - 1] || '';
            const name = slug
              .replace(/-/g, ' ')
              .replace(/_/g, ' ')
              .split(' ')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            
            return { name, slug };
          }).filter((cat: any) => cat.name && cat.slug);

          // Remove duplicates
          const uniqueCategories = categories.filter((cat: any, index: number, self: any[]) =>
            index === self.findIndex((c) => c.slug === cat.slug)
          );

          // Save categories to database
          if (uniqueCategories.length > 0) {
            for (const cat of uniqueCategories) {
              const { error } = await supabase
                .from('categories')
                .upsert({
                  tenant_id: currentTenant.id,
                  name: cat.name,
                  slug: cat.slug,
                  is_active: true,
                }, { onConflict: 'tenant_id,slug' });
              
              if (error && !error.message.includes('duplicate')) {
                console.error('Error saving category:', error);
              }
            }
          }
          
          importedCount = uniqueCategories.length;
          
        } else if (stepId === 'visual') {
          // Extract visual elements from branding data
          const branding = scrapedData.branding;
          
          if (branding) {
            // Get current tenant settings first to preserve existing data
            const { data: tenantData } = await supabase
              .from('tenants')
              .select('settings, logo_url')
              .eq('id', currentTenant.id)
              .single();
            
            const currentSettings = (tenantData?.settings as Record<string, any>) || {};
            
            const visualConfig = {
              logo: branding.images?.logo || branding.logo || null,
              favicon: branding.images?.favicon || null,
              primaryColor: branding.colors?.primary || null,
              secondaryColor: branding.colors?.secondary || null,
              accentColor: branding.colors?.accent || null,
              backgroundColor: branding.colors?.background || null,
              textColor: branding.colors?.textPrimary || null,
              fontFamily: branding.typography?.fontFamilies?.primary || branding.fonts?.[0]?.family || null,
              headingFont: branding.typography?.fontFamilies?.heading || null,
              colorScheme: branding.colorScheme || 'light',
            };

            // Merge with existing settings
            const updatedSettings = {
              ...currentSettings,
              visual: visualConfig,
              imported_from: storeUrl,
              imported_at: new Date().toISOString(),
            };

            // Update tenant settings with visual config
            const updateData: any = { settings: updatedSettings };
            
            // Also update logo_url if available
            if (visualConfig.logo) {
              updateData.logo_url = visualConfig.logo;
            }

            const { error } = await supabase
              .from('tenants')
              .update(updateData)
              .eq('id', currentTenant.id);

            if (error) {
              console.error('Error saving visual config:', error);
              throw new Error('Erro ao salvar configurações visuais');
            }

            importedCount = 1;
          } else {
            // Even without branding, mark as imported
            importedCount = 0;
            toast.info('Não foi possível extrair dados visuais da loja');
          }
        }
      }

      setStepStatuses(prev => ({
        ...prev,
        [stepId]: { status: 'completed', importedCount },
      }));

      toast.success(`${step.title} importado com sucesso!`);
      moveToNextStep(stepId);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erro ao importar: ${error.message}`);
      setStepStatuses(prev => ({
        ...prev,
        [stepId]: { ...prev[stepId], status: 'active' },
      }));
    }
  }, [scrapedData, analysisResult, importData, moveToNextStep]);

  const handleSkipStep = useCallback((stepId: string) => {
    setStepStatuses(prev => ({
      ...prev,
      [stepId]: { status: 'skipped' },
    }));
    moveToNextStep(stepId);
  }, [moveToNextStep]);

  const canProceedFromUrl = analysisResult?.success;

  const isStepDisabled = (step: ImportStepConfig): boolean => {
    if (!step.requiresPrevious) return false;
    return step.requiresPrevious.some(reqId => {
      const reqStatus = stepStatuses[reqId]?.status;
      return reqStatus !== 'completed';
    });
  };

  return (
    <Card className="max-w-3xl mx-auto border-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {wizardStep === 'url' && 'Importar Loja'}
          {wizardStep === 'import-steps' && 'Importação Guiada'}
          {wizardStep === 'complete' && 'Importação Concluída'}
        </CardTitle>
        <CardDescription>
          {wizardStep === 'url' && 'Informe o link da sua loja para começar a migração'}
          {wizardStep === 'import-steps' && 'Siga as etapas para importar os dados da sua loja'}
          {wizardStep === 'complete' && 'Sua loja foi importada com sucesso!'}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-[400px]">
        {wizardStep === 'url' && (
          <StoreUrlInput
            url={storeUrl}
            onUrlChange={setStoreUrl}
            onAnalyze={handleAnalyzeStore}
            isAnalyzing={isAnalyzing}
            analysisResult={analysisResult}
          />
        )}

        {wizardStep === 'import-steps' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 mb-6">
              <p className="text-sm">
                <span className="font-medium">Loja:</span>{' '}
                <span className="text-muted-foreground">{storeUrl}</span>
                {analysisResult?.platform && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {analysisResult.platform}
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-3">
              {IMPORT_STEPS.map((step) => (
                <ImportStep
                  key={step.id}
                  step={step}
                  status={stepStatuses[step.id]?.status || 'pending'}
                  onImport={(file) => handleImportStep(step.id, file)}
                  onSkip={() => handleSkipStep(step.id)}
                  isDisabled={isStepDisabled(step)}
                  importedCount={stepStatuses[step.id]?.importedCount}
                />
              ))}
            </div>

            {stepStatuses.categories?.status !== 'completed' && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                * Categorias são obrigatórias para importar o Visual da Loja
              </p>
            )}
          </div>
        )}

        {wizardStep === 'complete' && (
          <div className="text-center space-y-6 py-8">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Importação concluída!</h3>
              <p className="text-muted-foreground">
                Os dados da sua loja foram importados com sucesso.
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-left max-w-md mx-auto">
              <h4 className="font-medium mb-2">Resumo:</h4>
              <ul className="text-sm space-y-1">
                {IMPORT_STEPS.map(step => {
                  const status = stepStatuses[step.id];
                  return (
                    <li key={step.id} className="flex items-center gap-2">
                      {status?.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                      <span className={status?.status === 'completed' ? '' : 'text-muted-foreground'}>
                        {step.title}
                        {status?.importedCount !== undefined && status.importedCount > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({status.importedCount})
                          </span>
                        )}
                        {status?.status === 'skipped' && (
                          <span className="text-muted-foreground ml-1">(pulado)</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {wizardStep === 'url' && (
          <>
            <div />
            <Button 
              onClick={() => setWizardStep('import-steps')} 
              disabled={!canProceedFromUrl}
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {wizardStep === 'import-steps' && (
          <>
            <Button variant="outline" onClick={() => setWizardStep('url')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div />
          </>
        )}

        {wizardStep === 'complete' && (
          <>
            <div />
            <Button onClick={onComplete}>
              Concluir
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
