import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Package, FolderTree, Users, ShoppingCart, Palette, Globe, CheckCircle2, Menu } from 'lucide-react';
import { StoreUrlInput } from './StoreUrlInput';
import { ImportStep, ImportStepConfig } from './ImportStep';
import { useImportJobs, useImportData } from '@/hooks/useImportJobs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { getAdapter } from '@/lib/import/platforms';
import { useAuth } from '@/hooks/useAuth';
import { generateBlockId } from '@/lib/builder/utils';
import type { BlockNode } from '@/lib/builder/types';

// Generate home page content from imported visual data
function generateHomePageContent(heroBanners: any[], menuId?: string): BlockNode {
  const children: BlockNode[] = [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: menuId || '',
        showSearch: true,
        showCart: true,
        sticky: true,
      },
    },
  ];

  // Add HeroBanner if banners exist
  if (heroBanners.length > 0) {
    children.push({
      id: generateBlockId('HeroBanner'),
      type: 'HeroBanner',
      props: {
        slides: heroBanners.map((banner, idx) => ({
          id: `slide-${idx}`,
          imageDesktop: banner.imageDesktop || '',
          imageMobile: banner.imageMobile || banner.imageDesktop || '',
          linkUrl: banner.linkUrl || '',
          altText: banner.altText || `Banner ${idx + 1}`,
        })),
        autoplaySeconds: 5,
        bannerWidth: 'full',
        showArrows: true,
        showDots: true,
      },
    });
  }

  // Add CategoryList section
  children.push({
    id: generateBlockId('Section'),
    type: 'Section',
    props: { padding: 'lg' },
    children: [{
      id: generateBlockId('CategoryList'),
      type: 'CategoryList',
      props: { title: 'Categorias', layout: 'grid', columns: 4 },
    }],
  });

  // Add ProductGrid section
  children.push({
    id: generateBlockId('Section'),
    type: 'Section',
    props: { backgroundColor: '#f9fafb', padding: 'lg' },
    children: [{
      id: generateBlockId('ProductGrid'),
      type: 'ProductGrid',
      props: { title: 'Produtos em Destaque', source: 'featured', columns: 4, limit: 8, showPrice: true },
    }],
  });

  // Add Footer
  children.push({
    id: generateBlockId('Footer'),
    type: 'Footer',
    props: {
      menuId: '',
      showSocial: true,
      copyrightText: `© ${new Date().getFullYear()} Minha Loja. Todos os direitos reservados.`,
    },
  });

  return {
    id: 'root',
    type: 'Page',
    props: {},
    children,
  };
}

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
    id: 'categories',
    title: 'Categorias',
    description: 'Extrair categorias com banners automaticamente do site',
    icon: <FolderTree className="h-5 w-5" />,
    required: true,
    canSkip: false,
    importMethod: 'scrape',
  },
  {
    id: 'menu',
    title: 'Menu',
    description: 'Extrair menu de navegação e vincular às categorias importadas',
    icon: <Menu className="h-5 w-5" />,
    requiresPrevious: ['categories'],
    canSkip: true,
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
  {
    id: 'products',
    title: 'Produtos',
    description: 'Importar produtos e vincular às categorias importadas via arquivo JSON ou CSV',
    icon: <Package className="h-5 w-5" />,
    requiresPrevious: ['categories'],
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
];

interface VisualImportData {
  heroBanners: any[];
  menuItems: any[];
  categories: any[];
  branding: any;
  sections: any[];
  unsupportedSections: string[];
}

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
  const [visualImportData, setVisualImportData] = useState<VisualImportData | null>(null);
  const [createdMenuId, setCreatedMenuId] = useState<string | null>(null);
  
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

  // Fetch category page to extract banner
  const fetchCategoryBanner = async (categoryUrl: string): Promise<{ bannerDesktop?: string; bannerMobile?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { 
          url: categoryUrl,
          options: {
            formats: ['html'],
            onlyMainContent: false,
          }
        },
      });

      if (error || !data?.success) return {};

      const html = data.data?.html || data.html || '';
      
      // Look for collection/category banner in the page
      const bannerPatterns = [
        // Shopify collection image
        /<img[^>]*class="[^"]*collection[^"]*"[^>]*src=["']([^"']+)["']/i,
        // Generic category banner
        /<img[^>]*class="[^"]*(?:banner|hero|categoria)[^"]*"[^>]*src=["']([^"']+)["']/i,
        // Picture source for category
        /<div[^>]*class="[^"]*(?:collection|category|banner)[^"]*"[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i,
        // Background image style
        /class="[^"]*(?:collection|category|hero)[^"]*"[^>]*style="[^"]*background[^"]*url\(['"]?([^'")\s]+)['"]?\)/i,
        // Any large image at the top of the page (first 5000 chars)
      ];

      for (const pattern of bannerPatterns) {
        const match = pattern.exec(html);
        if (match && match[1]) {
          let bannerUrl = match[1];
          // Normalize URL
          if (bannerUrl.startsWith('//')) {
            bannerUrl = `https:${bannerUrl}`;
          } else if (!bannerUrl.startsWith('http')) {
            try {
              const baseUrl = new URL(categoryUrl).origin;
              bannerUrl = new URL(bannerUrl, baseUrl).href;
            } catch {}
          }
          return { bannerDesktop: bannerUrl };
        }
      }

      return {};
    } catch (error) {
      console.error('Error fetching category banner:', error);
      return {};
    }
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
        const detectedPlatform = analysisResult?.platform?.toLowerCase()?.trim() || 'generic';
        const platformMap: Record<string, string> = {
          'shopify': 'shopify',
          'woocommerce': 'woocommerce',
          'nuvemshop': 'nuvemshop',
          'tiendanube': 'nuvemshop',
          'vtex': 'vtex',
          'loja integrada': 'loja_integrada',
          'lojaintegrada': 'loja_integrada',
          'tray': 'tray',
          'yampi': 'yampi',
          'bagy': 'bagy',
          'wix': 'wix',
        };
        const platform = platformMap[detectedPlatform] || 'generic';
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

        // Call import-visual edge function for deep extraction (only once)
        let visualData = visualImportData;
        if (!visualData) {
          const { data: extractedData, error: visualError } = await supabase.functions.invoke('import-visual', {
            body: { 
              url: storeUrl,
              html: scrapedData.html || '',
              platform: analysisResult?.platform,
            }
          });

          if (visualError) {
            console.error('Error calling import-visual:', visualError);
          }

          if (extractedData?.success) {
            visualData = {
              heroBanners: extractedData.heroBanners || [],
              menuItems: extractedData.menuItems || [],
              categories: extractedData.categories || [],
              branding: extractedData.branding || {},
              sections: extractedData.sections || [],
              unsupportedSections: extractedData.unsupportedSections || [],
            };
            setVisualImportData(visualData);
          }
        }

        if (stepId === 'categories') {
          // Get categories from visual extraction
          let categoriesToSave = visualData?.categories || [];
          
          // Fallback to basic link extraction if no categories found
          if (categoriesToSave.length === 0) {
            const links = scrapedData.links || [];
            const categoryLinks = links.filter((link: string) => 
              link.includes('/categoria') || 
              link.includes('/category') || 
              link.includes('/collections') ||
              link.includes('/c/')
            );
            
            categoriesToSave = categoryLinks.map((link: string) => {
              try {
                const url = new URL(link);
                const pathParts = url.pathname.split('/').filter(Boolean);
                const slug = pathParts[pathParts.length - 1] || '';
                const name = slug
                  .replace(/-/g, ' ')
                  .replace(/_/g, ' ')
                  .split(' ')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
                
                return { name, slug, url: link };
              } catch {
                return null;
              }
            }).filter(Boolean);
          }

          // Remove duplicates
          const uniqueCategories = categoriesToSave.filter((cat: any, index: number, self: any[]) =>
            cat && index === self.findIndex((c: any) => c?.slug === cat.slug)
          );

          // Fetch banners for each category (limit to first 10 to avoid too many requests)
          const categoriesToFetchBanners = uniqueCategories.slice(0, 10);
          toast.info(`Buscando banners de ${categoriesToFetchBanners.length} categorias...`);
          
          for (const cat of categoriesToFetchBanners) {
            if (cat.url) {
              const bannerData = await fetchCategoryBanner(cat.url);
              if (bannerData.bannerDesktop) {
                cat.bannerDesktop = bannerData.bannerDesktop;
                cat.bannerMobile = bannerData.bannerMobile || bannerData.bannerDesktop;
              }
            }
          }

          // Save categories to database with banners
          if (uniqueCategories.length > 0) {
            for (const cat of uniqueCategories) {
              if (!cat) continue;
              const { error } = await supabase
                .from('categories')
                .upsert({
                  tenant_id: currentTenant.id,
                  name: cat.name,
                  slug: cat.slug,
                  is_active: true,
                  image_url: cat.imageUrl || null,
                  banner_desktop_url: cat.bannerDesktop || null,
                  banner_mobile_url: cat.bannerMobile || null,
                }, { onConflict: 'tenant_id,slug' });
              
              if (error && !error.message.includes('duplicate')) {
                console.error('Error saving category:', error);
              }
            }
          }
          
          importedCount = uniqueCategories.length;

        } else if (stepId === 'menu') {
          // Create menu from extracted items with hierarchy
          // Link menu items to imported categories when possible
          const menuItems = visualData?.menuItems || [];
          
          if (menuItems.length > 0) {
            // Fetch imported categories to link menu items
            const { data: importedCategories } = await supabase
              .from('categories')
              .select('id, slug, name')
              .eq('tenant_id', currentTenant.id);
            
            const categoryMap = new Map<string, { id: string; slug: string }>();
            (importedCategories || []).forEach(cat => {
              categoryMap.set(cat.slug.toLowerCase(), { id: cat.id, slug: cat.slug });
              categoryMap.set(cat.name.toLowerCase(), { id: cat.id, slug: cat.slug });
            });
            
            // Helper to find category match from URL or label
            const findCategoryMatch = (url: string, label: string) => {
              // Try to extract slug from internal URL
              const internalMatch = url.match(/\/categoria\/([^/?#]+)/i) || url.match(/\/c\/([^/?#]+)/i);
              if (internalMatch) {
                const slug = internalMatch[1].toLowerCase();
                if (categoryMap.has(slug)) {
                  return categoryMap.get(slug);
                }
              }
              // Try to match by label
              const labelLower = label.toLowerCase().replace(/\s+/g, '-');
              if (categoryMap.has(labelLower)) {
                return categoryMap.get(labelLower);
              }
              if (categoryMap.has(label.toLowerCase())) {
                return categoryMap.get(label.toLowerCase());
              }
              return null;
            };
            
            // Create header menu
            const { data: menuData, error: menuError } = await supabase
              .from('menus')
              .upsert({
                tenant_id: currentTenant.id,
                name: 'Menu Principal',
                location: 'header',
              }, { onConflict: 'tenant_id,location' })
              .select('id')
              .single();

            if (menuError) {
              console.error('Error creating menu:', menuError);
            } else if (menuData) {
              setCreatedMenuId(menuData.id);
              
              // Delete existing menu items
              await supabase
                .from('menu_items')
                .delete()
                .eq('menu_id', menuData.id);

              // Insert menu items with hierarchy and category links
              let sortOrder = 0;
              for (const item of menuItems) {
                const categoryMatch = findCategoryMatch(item.internalUrl || item.url, item.label);
                
                // Determine item type and URL based on category match
                const itemType = categoryMatch ? 'category' : (item.type || 'link');
                const itemUrl = categoryMatch 
                  ? `/categoria/${categoryMatch.slug}` 
                  : (item.internalUrl || item.url);
                const refId = categoryMatch?.id || null;
                
                // Insert parent item
                const { data: parentItem, error: parentError } = await supabase
                  .from('menu_items')
                  .insert({
                    tenant_id: currentTenant.id,
                    menu_id: menuData.id,
                    label: item.label,
                    url: itemUrl,
                    item_type: itemType,
                    ref_id: refId,
                    sort_order: sortOrder++,
                  })
                  .select('id')
                  .single();
                
                if (parentError) {
                  console.error('Error inserting parent menu item:', parentError);
                  continue;
                }
                
                // Insert children if any
                if (item.children && item.children.length > 0 && parentItem) {
                  for (let i = 0; i < item.children.length; i++) {
                    const child = item.children[i];
                    const childCategoryMatch = findCategoryMatch(child.internalUrl || child.url, child.label);
                    
                    const childItemType = childCategoryMatch ? 'category' : (child.type || 'link');
                    const childUrl = childCategoryMatch 
                      ? `/categoria/${childCategoryMatch.slug}` 
                      : (child.internalUrl || child.url);
                    const childRefId = childCategoryMatch?.id || null;
                    
                    await supabase
                      .from('menu_items')
                      .insert({
                        tenant_id: currentTenant.id,
                        menu_id: menuData.id,
                        label: child.label,
                        url: childUrl,
                        item_type: childItemType,
                        ref_id: childRefId,
                        parent_id: parentItem.id,
                        sort_order: i,
                      });
                  }
                }
              }
              
              // Count total items including children
              const totalItems = menuItems.reduce((acc, item) => 
                acc + 1 + (item.children?.length || 0), 0);
              importedCount = totalItems;
            }
          } else {
            toast.info('Nenhum item de menu encontrado no site.');
          }
          
        } else if (stepId === 'visual') {
          // Extract visual elements and create home page with blocks
          const branding = scrapedData.branding || visualData?.branding || {};
          const heroBanners = visualData?.heroBanners || [];
          const sections = visualData?.sections || [];
          const unsupportedSections = visualData?.unsupportedSections || [];
          
          // Get current tenant settings first
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('settings, logo_url')
            .eq('id', currentTenant.id)
            .single();
          
          const currentSettings = (tenantData?.settings as Record<string, any>) || {};
          
          const visualConfig = {
            logo: branding.images?.logo || branding.logo || null,
            favicon: branding.images?.favicon || branding.favicon || null,
            primaryColor: branding.colors?.primary || branding.primaryColor || null,
            secondaryColor: branding.colors?.secondary || branding.secondaryColor || null,
            accentColor: branding.colors?.accent || branding.accentColor || null,
            backgroundColor: branding.colors?.background || null,
            textColor: branding.colors?.textPrimary || null,
            fontFamily: branding.typography?.fontFamilies?.primary || branding.fonts?.[0]?.family || null,
            headingFont: branding.typography?.fontFamilies?.heading || null,
            colorScheme: branding.colorScheme || 'light',
          };

          // Update tenant settings
          const updatedSettings = {
            ...currentSettings,
            visual: visualConfig,
            imported_from: storeUrl,
            imported_at: new Date().toISOString(),
          };

          const updateData: any = { settings: updatedSettings };
          if (visualConfig.logo) {
            updateData.logo_url = visualConfig.logo;
          }

          await supabase
            .from('tenants')
            .update(updateData)
            .eq('id', currentTenant.id);

          // Create home page with imported visual blocks
          if (heroBanners.length > 0) {
            const homePageContent = generateHomePageContent(heroBanners, createdMenuId || undefined);
            
            // Check if home page exists
            const { data: existingHome } = await supabase
              .from('store_pages')
              .select('id')
              .eq('tenant_id', currentTenant.id)
              .eq('is_homepage', true)
              .single();

            if (existingHome) {
              // Update existing home page content
              await supabase
                .from('store_pages')
                .update({ 
                  content: homePageContent as unknown as Json,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingHome.id);
            } else {
              // Create new home page
              await supabase
                .from('store_pages')
                .insert([{
                  tenant_id: currentTenant.id,
                  title: 'Home',
                  slug: 'home',
                  type: 'home',
                  is_homepage: true,
                  is_published: true,
                  status: 'published',
                  content: homePageContent as unknown as Json,
                }]);
            }
            
            importedCount = heroBanners.length + sections.length;
            toast.success(`${heroBanners.length} banners importados para a página inicial!`);
          } else {
            importedCount = visualConfig.logo ? 1 : 0;
            toast.info('Nenhum banner encontrado. Logo e cores foram importados se disponíveis.');
          }

          // Notify about unsupported sections
          if (unsupportedSections.length > 0) {
            toast.warning(
              `Alguns módulos não foram importados: ${unsupportedSections.join(', ')}. Entre em contato com o suporte para mais informações.`,
              { duration: 8000 }
            );
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
  }, [scrapedData, analysisResult, importData, moveToNextStep, currentTenant, storeUrl, visualImportData, createdMenuId, fetchCategoryBanner]);

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
                * Categorias são obrigatórias para importar o Menu e Visual da Loja
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
