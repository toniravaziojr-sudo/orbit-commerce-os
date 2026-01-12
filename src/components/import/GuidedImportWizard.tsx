import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Package, Users, ShoppingCart, CheckCircle2, Loader2 } from 'lucide-react';
import { StoreUrlInput } from './StoreUrlInput';
import { ImportStep } from './ImportStep';
import { StructureImportStep, ImportStats as StructureImportStats } from './StructureImportStep';
import { useImportData } from '@/hooks/useImportJobs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { normalizeData } from '@/lib/import/platforms';
import { parseCSV, consolidateShopifyProducts } from '@/lib/import/utils';
import type { PlatformType } from '@/lib/import/types';
import { useAuth } from '@/hooks/useAuth';

interface GuidedImportWizardProps {
  onComplete?: () => void;
}

type WizardStep = 'url' | 'file-import' | 'structure-import' | 'complete';

interface FileStepConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  canSkip: boolean;
}

const FILE_IMPORT_STEPS: FileStepConfig[] = [
  { id: 'products', title: 'Produtos', description: 'Importar catálogo de produtos via arquivo JSON ou CSV', icon: <Package className="h-5 w-5" />, canSkip: true },
  { id: 'customers', title: 'Clientes', description: 'Importar clientes e endereços via arquivo JSON ou CSV', icon: <Users className="h-5 w-5" />, canSkip: true },
  { id: 'orders', title: 'Pedidos', description: 'Importar histórico de pedidos via arquivo JSON ou CSV', icon: <ShoppingCart className="h-5 w-5" />, canSkip: true },
];

export function GuidedImportWizard({ onComplete }: GuidedImportWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('url');
  const [storeUrl, setStoreUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ success: boolean; platform?: string; confidence?: string; error?: string } | null>(null);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [structureImportComplete, setStructureImportComplete] = useState(false);
  const [structureStats, setStructureStats] = useState<StructureImportStats | null>(null);
  
  const [fileStepStatuses, setFileStepStatuses] = useState<Record<string, { status: 'pending' | 'active' | 'completed' | 'skipped' | 'processing' | 'error'; importedCount?: number; errorMessage?: string }>>(() => {
    const initial: Record<string, any> = {};
    FILE_IMPORT_STEPS.forEach((step, index) => {
      initial[step.id] = { status: index === 0 ? 'active' : 'pending' };
    });
    return initial;
  });
  
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
        body: { url: formattedUrl, options: { formats: ['html', 'links'], onlyMainContent: false } }
      });

      if (error) throw error;

      if (data?.success) {
        const html = data.data?.html || data.html || '';
        const platform = detectPlatform(html);
        setScrapedData(data.data || data);
        setAnalysisResult({ success: true, platform: platform.name, confidence: platform.confidence });
        toast.success(`Loja analisada! Plataforma: ${platform.name}`);
      } else {
        throw new Error(data?.error || 'Falha ao analisar');
      }
    } catch (error: any) {
      setAnalysisResult({ success: false, error: error.message });
      toast.error('Erro ao analisar a loja');
    } finally {
      setIsAnalyzing(false);
    }
  }, [storeUrl]);

  const detectPlatform = (html: string): { name: string; confidence: string } => {
    const h = html.toLowerCase();
    if (h.includes('shopify') || h.includes('cdn.shopify.com')) return { name: 'Shopify', confidence: 'alta' };
    if (h.includes('woocommerce')) return { name: 'WooCommerce', confidence: 'alta' };
    if (h.includes('nuvemshop') || h.includes('tiendanube')) return { name: 'Nuvemshop', confidence: 'alta' };
    if (h.includes('vtex')) return { name: 'VTEX', confidence: 'alta' };
    // TRAY detection - strong signals
    if (h.includes('smb.tray') || h.includes('pixel-tray') || h.includes('tray.min.js') || h.includes('traycdn')) return { name: 'Tray', confidence: 'alta' };
    if (h.includes('tray.com.br') || h.includes('traycorp')) return { name: 'Tray', confidence: 'alta' };
    return { name: 'Não identificada', confidence: 'baixa' };
  };

  const handleFileImport = useCallback(async (stepId: string, file: File) => {
    if (!currentTenant?.id) return;
    setFileStepStatuses(prev => ({ ...prev, [stepId]: { status: 'processing' } }));

    try {
      const text = await file.text();
      let data: any[];
      
      const platform = analysisResult?.platform?.toLowerCase() || 'generic';
      
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        data = Array.isArray(parsed) ? parsed : parsed.products || parsed.customers || parsed.orders || [parsed];
      } else {
        // Use proper CSV parser that handles BOM and quoted fields
        const rawRows = parseCSV(text);
        
        // CRITICAL: Detect Shopify CSV structure by checking for Handle + Title columns
        // This ensures consolidation happens even if platform detection failed
        const hasShopifyStructure = stepId === 'products' && rawRows.length > 0 && 
          ('Handle' in rawRows[0] || 'handle' in rawRows[0]) &&
          ('Title' in rawRows[0] || 'title' in rawRows[0]);
        
        const isShopifyPlatform = platform === 'shopify' || platform.includes('shopify');
        const shouldConsolidate = hasShopifyStructure || isShopifyPlatform;
        
        if (shouldConsolidate && stepId === 'products') {
          console.log(`[handleFileImport] Shopify CSV structure detected - consolidating ${rawRows.length} rows (platform: ${platform}, hasStructure: ${hasShopifyStructure})`);
          data = consolidateShopifyProducts(rawRows);
          console.log(`[handleFileImport] Consolidated to ${data.length} products`);
        } else {
          data = rawRows;
        }
      }

      // Debug: Log first few items to verify parsing
      console.log(`[handleFileImport] Processing ${data.length} items from ${file.name} (platform: ${platform})`);
      if (data.length > 0) {
        const sample = JSON.stringify(data[0]);
        console.log('[handleFileImport] First item sample:', sample.substring(0, 800));
        // Verify Title is present for products
        if (stepId === 'products') {
          const title = data[0]['Title'] || data[0]['title'] || data[0]['name'];
          const handle = data[0]['Handle'] || data[0]['handle'];
          console.log(`[handleFileImport] Product check - Title: "${title}", Handle: "${handle}"`);
        }
      }

      // CRITICAL: Use 'shopify' platform for normalization if Shopify structure detected
      // This ensures correct normalization even if platform detection returned unknown
      const hasShopifyData = stepId === 'products' && data.length > 0 && 
        ('Handle' in data[0] || 'handle' in data[0] || 'Title' in data[0] || 'title' in data[0]);
      const effectivePlatform = hasShopifyData ? 'shopify' : platform;

      const dataType = stepId === 'products' ? 'product' : stepId === 'customers' ? 'customer' : 'order';
      const normalized = normalizeData(effectivePlatform as PlatformType, dataType, data);
      
      // Debug: Verify normalization worked
      if (normalized.length > 0 && stepId === 'products') {
        const firstProduct = normalized[0] as any;
        console.log(`[handleFileImport] After normalization (${effectivePlatform}) - name: "${firstProduct.name}", slug: "${firstProduct.slug}", price: ${firstProduct.price}, images: ${firstProduct.images?.length || 0}`);
      }

      const moduleType = stepId as 'products' | 'customers' | 'orders';
      const result = await importData(platform, moduleType, normalized);
      const importedCount = result.results?.imported || 0;
      
      setFileStepStatuses(prev => ({
        ...prev,
        [stepId]: { status: 'completed', importedCount },
      }));
      
      const currentIndex = FILE_IMPORT_STEPS.findIndex(s => s.id === stepId);
      if (currentIndex < FILE_IMPORT_STEPS.length - 1) {
        const nextStep = FILE_IMPORT_STEPS[currentIndex + 1];
        setFileStepStatuses(prev => ({ ...prev, [nextStep.id]: { status: 'active' } }));
      }
      
      toast.success(`${importedCount} ${stepId} importados`);
    } catch (error: any) {
      console.error(`[handleFileImport] Error:`, error);
      setFileStepStatuses(prev => ({ ...prev, [stepId]: { status: 'error', errorMessage: error.message } }));
      toast.error(`Erro: ${error.message}`);
    }
  }, [currentTenant, analysisResult, importData]);

  const handleSkipStep = useCallback((stepId: string) => {
    setFileStepStatuses(prev => {
      const newStatuses = { ...prev, [stepId]: { status: 'skipped' as const } };
      const currentIndex = FILE_IMPORT_STEPS.findIndex(s => s.id === stepId);
      if (currentIndex < FILE_IMPORT_STEPS.length - 1) {
        newStatuses[FILE_IMPORT_STEPS[currentIndex + 1].id] = { status: 'active' };
      }
      return newStatuses;
    });
  }, []);

  const handleStructureComplete = useCallback((stats: StructureImportStats) => {
    setStructureStats(stats);
    setStructureImportComplete(true);
  }, []);

  const canProceed = () => {
    if (wizardStep === 'url') return analysisResult?.success;
    if (wizardStep === 'file-import') return Object.values(fileStepStatuses).every(s => ['completed', 'skipped'].includes(s.status));
    if (wizardStep === 'structure-import') return structureImportComplete;
    return false;
  };

  const handleNext = () => {
    if (wizardStep === 'url') setWizardStep('file-import');
    else if (wizardStep === 'file-import') setWizardStep('structure-import');
    else if (wizardStep === 'structure-import') setWizardStep('complete');
  };

  const handleBack = () => {
    if (wizardStep === 'file-import') setWizardStep('url');
    else if (wizardStep === 'structure-import') setWizardStep('file-import');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {wizardStep === 'url' && 'Etapa 1: URL da Loja'}
          {wizardStep === 'file-import' && 'Etapa 2: Importar Dados (Arquivos)'}
          {wizardStep === 'structure-import' && 'Etapa 3: Estrutura da Loja'}
          {wizardStep === 'complete' && 'Importação Concluída!'}
        </CardTitle>
        <CardDescription>
          {wizardStep === 'url' && 'Informe a URL da loja para detectar a plataforma'}
          {wizardStep === 'file-import' && 'Importe produtos, clientes e pedidos via arquivo'}
          {wizardStep === 'structure-import' && 'Importe categorias, páginas e menus'}
          {wizardStep === 'complete' && 'Todos os dados foram importados'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {wizardStep === 'url' && (
          <StoreUrlInput
            url={storeUrl}
            onUrlChange={setStoreUrl}
            onAnalyze={handleAnalyzeStore}
            isAnalyzing={isAnalyzing}
            analysisResult={analysisResult}
          />
        )}

        {wizardStep === 'file-import' && (
          <div className="space-y-4">
            {FILE_IMPORT_STEPS.map((step) => (
              <ImportStep
                key={step.id}
                step={{
                  id: step.id,
                  title: step.title,
                  description: step.description,
                  icon: step.icon,
                  canSkip: step.canSkip,
                  importMethod: 'file'
                }}
                status={fileStepStatuses[step.id]?.status || 'pending'}
                importedCount={fileStepStatuses[step.id]?.importedCount}
                errorMessage={fileStepStatuses[step.id]?.errorMessage}
                onImport={(file) => file && handleFileImport(step.id, file)}
                onSkip={() => handleSkipStep(step.id)}
              />
            ))}
          </div>
        )}

        {wizardStep === 'structure-import' && currentTenant && (
          <StructureImportStep
            tenantId={currentTenant.id}
            storeUrl={storeUrl}
            scrapedData={scrapedData}
            analysisResult={analysisResult}
            onComplete={handleStructureComplete}
          />
        )}

        {wizardStep === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Importação concluída com sucesso!</p>
            <p className="text-muted-foreground mt-2">
              Categorias: {structureStats?.categories || 0} | Páginas: {structureStats?.pages || 0} | Menus: {structureStats?.menuItems || 0} itens
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={wizardStep === 'url' || wizardStep === 'complete'}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        
        {wizardStep === 'complete' ? (
          <Button onClick={onComplete}>Fechar</Button>
        ) : (
          <Button onClick={handleNext} disabled={!canProceed()}>
            {wizardStep === 'structure-import' ? 'Concluir' : 'Próximo'} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
