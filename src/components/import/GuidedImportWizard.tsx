import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Package, FolderTree, Users, ShoppingCart, Palette, Globe, CheckCircle2, Menu, FileText, Loader2, Upload, AlertTriangle } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';

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

// Wizard steps: url -> file-import -> structure-import -> complete
type WizardStep = 'url' | 'file-import' | 'structure-import' | 'complete';

// Sub-steps within structure import (Etapa 3 - Estrutura da Loja)
interface StructureImportProgress {
  pages: 'pending' | 'processing' | 'completed' | 'error';
  categories: 'pending' | 'processing' | 'completed' | 'error';
  menus: 'pending' | 'processing' | 'completed' | 'error';
  visual: 'pending' | 'processing' | 'completed' | 'error';
}

interface ImportStats {
  pages: number;
  categories: number;
  menuItems: number;
  banners: number;
}

// File import steps (Etapa 2 - arquivos)
const FILE_IMPORT_STEPS: ImportStepConfig[] = [
  {
    id: 'products',
    title: 'Produtos',
    description: 'Importar catálogo de produtos via arquivo JSON ou CSV',
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
];

export function GuidedImportWizard({ onComplete }: GuidedImportWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('url');
  const [storeUrl, setStoreUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    success: boolean;
    platform?: string;
    confidence?: string;
    error?: string;
    data?: any;
  } | null>(null);
  
  // Structure import state (Etapa 3 - Estrutura da Loja)
  const [isImportingStructure, setIsImportingStructure] = useState(false);
  const [structureProgress, setStructureProgress] = useState<StructureImportProgress>({
    pages: 'pending',
    categories: 'pending',
    menus: 'pending',
    visual: 'pending',
  });
  const [importStats, setImportStats] = useState<ImportStats>({
    pages: 0,
    categories: 0,
    menuItems: 0,
    banners: 0,
  });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  
  // File import state (Etapa 3)
  const [fileStepStatuses, setFileStepStatuses] = useState<Record<string, {
    status: 'pending' | 'active' | 'completed' | 'skipped' | 'processing' | 'error';
    importedCount?: number;
    errorMessage?: string;
  }>>(() => {
    const initial: Record<string, any> = {};
    FILE_IMPORT_STEPS.forEach((step, index) => {
      initial[step.id] = { status: index === 0 ? 'active' : 'pending' };
    });
    return initial;
  });
  
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [createdMenuId, setCreatedMenuId] = useState<string | null>(null);
  
  const { importData } = useImportData();
  const { currentTenant } = useAuth();

  // Etapa 1: Analyze store URL and detect platform
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
        const html = data.data?.html || data.html || '';
        const platform = detectPlatformFromHtml(html);
        
        setScrapedData(data.data || data);
        setAnalysisResult({
          success: true,
          platform: platform.name,
          confidence: platform.confidence,
          data: data.data || data,
        });
        toast.success(`Loja analisada! Plataforma detectada: ${platform.name}`);
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

  const detectPlatformFromHtml = (html: string): { name: string; confidence: string } => {
    const htmlLower = html.toLowerCase();
    
    // Shopify signals
    const shopifySignals = [
      htmlLower.includes('shopify'),
      htmlLower.includes('cdn.shopify.com'),
      htmlLower.includes('/collections/'),
      htmlLower.includes('myshopify.com'),
    ].filter(Boolean).length;
    
    if (shopifySignals >= 2) return { name: 'Shopify', confidence: 'alta' };
    if (shopifySignals >= 1) return { name: 'Shopify', confidence: 'média' };
    
    // WooCommerce
    if (htmlLower.includes('woocommerce') || htmlLower.includes('wp-content')) {
      return { name: 'WooCommerce', confidence: 'alta' };
    }
    
    // Nuvemshop
    if (htmlLower.includes('nuvemshop') || htmlLower.includes('tiendanube')) {
      return { name: 'Nuvemshop', confidence: 'alta' };
    }
    
    // VTEX
    if (htmlLower.includes('vtex') || htmlLower.includes('vteximg')) {
      return { name: 'VTEX', confidence: 'alta' };
    }
    
    // Loja Integrada
    if (htmlLower.includes('lojaintegrada')) {
      return { name: 'Loja Integrada', confidence: 'alta' };
    }
    
    // Tray
    if (htmlLower.includes('tray.com')) {
      return { name: 'Tray', confidence: 'alta' };
    }
    
    // Yampi
    if (htmlLower.includes('yampi')) {
      return { name: 'Yampi', confidence: 'alta' };
    }
    
    return { name: 'Plataforma não identificada', confidence: 'baixa' };
  };

  // Etapa 3: Import store structure (pages, categories, menus, visual) in one click
  const handleImportStoreStructure = useCallback(async () => {
    if (!currentTenant?.id || !scrapedData) {
      toast.error('Dados da loja não disponíveis');
      return;
    }

    setIsImportingStructure(true);
    setImportErrors([]);
    const stats: ImportStats = { pages: 0, categories: 0, menuItems: 0, banners: 0 };
    
    try {
      // Step 1: Get better HTML with JS rendered (for menus)
      let htmlToUse = scrapedData.html || '';
      
      setStructureProgress(prev => ({ ...prev, pages: 'processing' }));
      toast.info('Extraindo estrutura da loja...');
      
      // Try to get better HTML for JS-rendered content
      try {
        const { data: betterScrape, error: scrapeError } = await supabase.functions.invoke('firecrawl-scrape', {
          body: { 
            url: storeUrl,
            options: {
              formats: ['html', 'links'],
              onlyMainContent: false,
              waitFor: 3000,
            }
          }
        });
        
        if (!scrapeError && betterScrape?.data?.html) {
          htmlToUse = betterScrape.data.html;
        }
      } catch (e) {
        console.log('Fallback scrape failed, using original HTML');
      }
      
      // Step 2: Call import-visual edge function for deep extraction
      const { data: visualData, error: visualError } = await supabase.functions.invoke('import-visual', {
        body: { 
          url: storeUrl,
          html: htmlToUse,
          platform: analysisResult?.platform,
        }
      });

      if (visualError) {
        throw new Error(`Erro ao extrair visual: ${visualError.message}`);
      }

      if (!visualData?.success) {
        throw new Error(visualData?.error || 'Falha na extração visual');
      }

      console.log('Visual extraction result:', {
        banners: visualData.heroBanners?.length || 0,
        categories: visualData.categories?.length || 0,
        menuItems: visualData.menuItems?.length || 0,
      });

      // === STEP 2.1: Import Pages (institutional/informational) ===
      setStructureProgress(prev => ({ ...prev, pages: 'processing' }));
      
      // Get institutional pages from visual extraction (from footer links)
      const institutionalPages = visualData.institutionalPages || [];
      
      if (institutionalPages.length > 0) {
        toast.info(`Importando ${institutionalPages.length} páginas institucionais...`);
        
        try {
          const { data: pagesResult, error: pagesError } = await supabase.functions.invoke('import-pages', {
            body: {
              tenantId: currentTenant.id,
              pages: institutionalPages,
              platform: analysisResult?.platform,
              storeUrl: storeUrl, // Pass storeUrl for relative URL resolution
            }
          });
          
          if (pagesError) {
            console.error('Error importing pages:', pagesError);
            setImportErrors(prev => [...prev, `Erro ao importar páginas: ${pagesError.message}`]);
          } else if (pagesResult?.success) {
            stats.pages = pagesResult.results?.imported || 0;
            console.log(`Imported ${stats.pages} institutional pages`);
          }
        } catch (e) {
          console.error('Error calling import-pages:', e);
        }
      } else {
        // Fallback: try to detect pages from menu items
        const pageItems = (visualData.menuItems || []).filter((item: any) => 
          item.type === 'page' || 
          /\/(?:pages?|pagina|sobre|contato|politica|termos)/i.test(item.url || '')
        );
        
        if (pageItems.length > 0) {
          const pagesToImport = pageItems.map((item: any) => ({
            title: item.label,
            slug: item.internalUrl?.replace('/pagina/', '') || item.url.split('/').pop() || item.label.toLowerCase().replace(/\s+/g, '-'),
            url: item.url,
            source: 'header' as const,
          }));
          
          const { data: pagesResult } = await supabase.functions.invoke('import-pages', {
            body: { tenantId: currentTenant.id, pages: pagesToImport, storeUrl: storeUrl }
          });
          
          stats.pages = pagesResult?.results?.imported || 0;
        }
      }
      
      setStructureProgress(prev => ({ ...prev, pages: 'completed' }));
      
      // === STEP 2.2: Import Categories (FLAT - no hierarchy in categories) ===
      setStructureProgress(prev => ({ ...prev, categories: 'processing' }));
      
      const allCategories: Array<{
        name: string;
        slug: string;
        url?: string;
        imageUrl?: string;
        bannerDesktop?: string;
        bannerMobile?: string;
      }> = [];
      const processedSlugs = new Set<string>();
      
      // Extract slug from URL
      const extractSlugFromUrl = (url: string): string | null => {
        const match = /\/(?:collections?|categoria|category|c)\/([^/?#]+)/i.exec(url);
        return match ? match[1] : null;
      };
      
      // Process menu items to extract categories (FLAT - no parent_id)
      const processMenuItem = (item: any) => {
        const slug = extractSlugFromUrl(item.url || '');
        if ((item.type === 'category' || slug) && slug && !processedSlugs.has(slug)) {
          allCategories.push({
            name: item.label || item.name,
            slug: slug,
            url: item.url,
          });
          processedSlugs.add(slug);
        }
        
        // Process children (also flat, NOT as subcategories)
        if (item.children && item.children.length > 0) {
          for (const child of item.children) {
            processMenuItem(child);
          }
        }
      };
      
      for (const item of (visualData.menuItems || [])) {
        processMenuItem(item);
      }
      
      // Add categories from visual extraction
      for (const cat of (visualData.categories || [])) {
        if (cat && cat.slug && !processedSlugs.has(cat.slug)) {
          allCategories.push({
            name: cat.name,
            slug: cat.slug,
            url: cat.url,
            imageUrl: cat.imageUrl,
            bannerDesktop: cat.bannerDesktop,
            bannerMobile: cat.bannerMobile,
          });
          processedSlugs.add(cat.slug);
        }
      }
      
      // Save categories as FLAT (parent_id = null always)
      const slugToIdMap = new Map<string, string>();
      const categoryUrlMap = new Map<string, string>(); // slug -> original URL for banner extraction
      
      for (const cat of allCategories) {
        if (!cat || !cat.slug) continue;
        
        // Store URL for later banner extraction
        if (cat.url) {
          categoryUrlMap.set(cat.slug, cat.url);
        }
        
        const { data, error } = await supabase
          .from('categories')
          .upsert({
            tenant_id: currentTenant.id,
            name: cat.name,
            slug: cat.slug,
            is_active: true,
            image_url: cat.imageUrl || null,
            banner_desktop_url: cat.bannerDesktop || null,
            banner_mobile_url: cat.bannerMobile || null,
            parent_id: null, // FLAT - hierarchy is ONLY in menus
          }, { onConflict: 'tenant_id,slug' })
          .select('id, slug')
          .single();
        
        if (data) {
          slugToIdMap.set(cat.slug, data.id);
        }
        if (error && !error.message.includes('duplicate')) {
          console.error('Error saving category:', error);
        }
      }
      
      stats.categories = allCategories.length;
      
      // === STEP 2.2.1: Extract banners + products using new unified edge function ===
      toast.info('Extraindo banners e produtos das categorias...');
      let bannersExtracted = 0;
      let totalProductsLinked = 0;
      
      // Get all products for this tenant for matching
      const { data: existingProducts } = await supabase
        .from('products')
        .select('id, slug, name')
        .eq('tenant_id', currentTenant.id);
      
      // Create maps for matching products
      const productBySlug = new Map<string, { id: string; name: string }>();
      const productByName = new Map<string, { id: string; slug: string }>();
      
      if (existingProducts) {
        existingProducts.forEach(p => {
          productBySlug.set(p.slug.toLowerCase(), { id: p.id, name: p.name });
          const normalizedName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
          productByName.set(normalizedName, { id: p.id, slug: p.slug });
        });
      }
      
      for (const [slug, categoryUrl] of categoryUrlMap) {
        try {
          const categoryId = slugToIdMap.get(slug);
          if (!categoryId) continue;
          
          // Call import-category-data edge function (extracts products + banners + internalizes assets)
          const { data: categoryData, error: categoryError } = await supabase.functions.invoke('import-category-data', {
            body: { 
              categoryUrl, 
              categorySlug: slug,
              tenantId: currentTenant.id,
              platform: analysisResult?.platform,
            }
          });
          
          if (categoryError) {
            console.error(`Error importing category ${slug}:`, categoryError.message);
            continue;
          }
          
          if (!categoryData?.success) {
            console.log(`Failed to import category ${slug}:`, categoryData?.error);
            continue;
          }
          
          console.log(`Category ${slug}: ${categoryData.productCount} products, banners: ${!!categoryData.bannerDesktopUrl}`);
          
          // Update category with internalized banner URLs
          if (categoryData.bannerDesktopUrl || categoryData.bannerMobileUrl) {
            await supabase
              .from('categories')
              .update({
                banner_desktop_url: categoryData.bannerDesktopUrl || null,
                banner_mobile_url: categoryData.bannerMobileUrl || categoryData.bannerDesktopUrl || null,
              })
              .eq('id', categoryId);
            
            bannersExtracted++;
          }
          
          // Link products to this category
          const productHandles: string[] = categoryData.products || [];
          
          for (const handle of productHandles) {
            const normalizedHandle = handle.toLowerCase();
            let productId: string | null = null;
            
            // Try exact slug match
            if (productBySlug.has(normalizedHandle)) {
              productId = productBySlug.get(normalizedHandle)!.id;
            } else {
              // Try name-based match
              if (productByName.has(normalizedHandle)) {
                productId = productByName.get(normalizedHandle)!.id;
              }
            }
            
            if (productId) {
              // Check if link already exists
              const { data: existing } = await supabase
                .from('product_categories')
                .select('id')
                .eq('product_id', productId)
                .eq('category_id', categoryId)
                .maybeSingle();
              
              if (!existing) {
                // Get max position
                const { data: maxPos } = await supabase
                  .from('product_categories')
                  .select('position')
                  .eq('category_id', categoryId)
                  .order('position', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                const newPosition = (maxPos?.position || 0) + 1;
                
                const { error: linkError } = await supabase
                  .from('product_categories')
                  .insert({
                    product_id: productId,
                    category_id: categoryId,
                    position: newPosition,
                  });
                
                if (!linkError) {
                  totalProductsLinked++;
                }
              }
            }
          }
          
          // Log warning if expected products != found products
          if (productHandles.length > 0) {
            const linkedForThisCategory = productHandles.filter(h => 
              productBySlug.has(h.toLowerCase()) || productByName.has(h.toLowerCase())
            ).length;
            
            if (linkedForThisCategory < productHandles.length) {
              console.warn(`Category ${slug}: Found ${productHandles.length} products on source, but only ${linkedForThisCategory} matched internal products`);
            }
          }
        } catch (e) {
          console.error(`Error processing category ${slug}:`, e);
        }
      }
      
      console.log(`Extracted banners for ${bannersExtracted} categories, linked ${totalProductsLinked} products`);
      
      // === STEP 2.2.2: Aggregate products for parent categories (from menu hierarchy) ===
      // Note: Product linking is now done inside the loop above via import-category-data edge function
      toast.info('Agregando produtos para categorias mãe...');
      
      // Get menu items with hierarchy to identify parent categories
      const { data: menuItemsForAgg } = await supabase
        .from('menu_items')
        .select('id, ref_id, item_type, parent_id')
        .eq('tenant_id', currentTenant.id)
        .eq('item_type', 'category')
        .not('ref_id', 'is', null);
      
      if (menuItemsForAgg && menuItemsForAgg.length > 0) {
        // Build parent-child relationship
        const parentToChildren = new Map<string, string[]>();
        
        menuItemsForAgg.forEach(item => {
          if (item.parent_id && item.ref_id) {
            // This is a child item - find its parent's category
            const parent = menuItemsForAgg.find(m => m.id === item.parent_id);
            if (parent && parent.ref_id) {
              if (!parentToChildren.has(parent.ref_id)) {
                parentToChildren.set(parent.ref_id, []);
              }
              parentToChildren.get(parent.ref_id)!.push(item.ref_id);
            }
          }
        });
        
        // For each parent category, get all products from children and link them
        let aggregatedProducts = 0;
        
        for (const [parentCategoryId, childCategoryIds] of parentToChildren) {
          // Get all products from child categories
          const { data: childProducts } = await supabase
            .from('product_categories')
            .select('product_id')
            .in('category_id', childCategoryIds);
          
          if (childProducts && childProducts.length > 0) {
            const uniqueProductIds = [...new Set(childProducts.map(cp => cp.product_id))];
            
            for (const productId of uniqueProductIds) {
              // Check if product is already linked to parent
              const { data: existingLink } = await supabase
                .from('product_categories')
                .select('id')
                .eq('product_id', productId)
                .eq('category_id', parentCategoryId)
                .maybeSingle();
              
              if (!existingLink) {
                const { data: maxPos } = await supabase
                  .from('product_categories')
                  .select('position')
                  .eq('category_id', parentCategoryId)
                  .order('position', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                const newPosition = (maxPos?.position || 0) + 1;
                
                const { error: linkError } = await supabase
                  .from('product_categories')
                  .insert({
                    product_id: productId,
                    category_id: parentCategoryId,
                    position: newPosition,
                  });
                
                if (!linkError) {
                  aggregatedProducts++;
                }
              }
            }
          }
        }
        
        console.log(`Aggregated ${aggregatedProducts} products to parent categories`);
      }
      
      setStructureProgress(prev => ({ ...prev, categories: 'completed' }));
      
      // === STEP 2.3: Import Menus (Header AND Footer with hierarchy) ===
      setStructureProgress(prev => ({ ...prev, menus: 'processing' }));
      
      const headerMenuItems = visualData.menuItems || [];
      const footerMenuItems = visualData.footerMenuItems || [];
      let menuId: string | null = null;
      
      // Fetch imported categories to link menu items
      const { data: importedCategories } = await supabase
        .from('categories')
        .select('id, slug, name')
        .eq('tenant_id', currentTenant.id);
      
      const categoryMap = new Map<string, { id: string; slug: string }>();
      (importedCategories || []).forEach(cat => {
        categoryMap.set(cat.slug.toLowerCase(), { id: cat.id, slug: cat.slug });
        categoryMap.set(cat.name.toLowerCase().replace(/\s+/g, '-'), { id: cat.id, slug: cat.slug });
      });
      
      // Fetch imported pages to link menu items
      const { data: importedPages } = await supabase
        .from('store_pages')
        .select('id, slug, title')
        .eq('tenant_id', currentTenant.id);
      
      const pageMap = new Map<string, { id: string; slug: string }>();
      (importedPages || []).forEach(page => {
        pageMap.set(page.slug.toLowerCase(), { id: page.id, slug: page.slug });
        pageMap.set(page.title.toLowerCase().replace(/\s+/g, '-'), { id: page.id, slug: page.slug });
      });
      
      // Helper to find category match from URL or label
      const findCategoryMatch = (url: string, label: string) => {
        const collectionMatch = url.match(/\/(?:collections?|categoria|category|c)\/([^/?#]+)/i);
        if (collectionMatch) {
          const slug = collectionMatch[1].toLowerCase();
          if (categoryMap.has(slug)) {
            return categoryMap.get(slug);
          }
        }
        const labelSlug = label.toLowerCase().replace(/\s+/g, '-');
        if (categoryMap.has(labelSlug)) {
          return categoryMap.get(labelSlug);
        }
        return null;
      };
      
      // Helper to find page match from URL or label
      const findPageMatch = (url: string, label: string) => {
        const pageMatch = url.match(/\/(?:pages?|pagina|policies)\/([^/?#]+)/i);
        if (pageMatch) {
          const slug = pageMatch[1].toLowerCase();
          if (pageMap.has(slug)) {
            return pageMap.get(slug);
          }
        }
        const labelSlug = label.toLowerCase().replace(/\s+/g, '-');
        if (pageMap.has(labelSlug)) {
          return pageMap.get(labelSlug);
        }
        return null;
      };
      
      // Helper to insert menu items with hierarchy
      const insertMenuItems = async (items: any[], targetMenuId: string) => {
        let sortOrder = 0;
        let totalItems = 0;
        
        for (const item of items) {
          const categoryMatch = findCategoryMatch(item.internalUrl || item.url || '', item.label || '');
          const pageMatch = !categoryMatch ? findPageMatch(item.internalUrl || item.url || '', item.label || '') : null;
          
          let itemType = item.type || 'external';
          let itemUrl = item.internalUrl || item.url || '#';
          let refId = null;
          
          if (categoryMatch) {
            itemType = 'category';
            itemUrl = `/categoria/${categoryMatch.slug}`;
            refId = categoryMatch.id;
          } else if (pageMatch) {
            itemType = 'page';
            itemUrl = `/pagina/${pageMatch.slug}`;
            refId = pageMatch.id;
          }
          
          // Insert parent item
          const { data: parentItem, error: parentError } = await supabase
            .from('menu_items')
            .insert({
              tenant_id: currentTenant.id,
              menu_id: targetMenuId,
              label: item.label,
              url: itemUrl,
              item_type: itemType,
              ref_id: refId,
              sort_order: sortOrder++,
              parent_id: null,
            })
            .select('id')
            .single();
          
          if (parentError) {
            console.error('Error inserting menu item:', parentError);
            continue;
          }
          
          totalItems++;
          
          // Insert children with parent_id
          if (item.children && item.children.length > 0 && parentItem) {
            for (let i = 0; i < item.children.length; i++) {
              const child = item.children[i];
              const childCategoryMatch = findCategoryMatch(child.internalUrl || child.url || '', child.label || '');
              const childPageMatch = !childCategoryMatch ? findPageMatch(child.internalUrl || child.url || '', child.label || '') : null;
              
              let childItemType = child.type || 'external';
              let childUrl = child.internalUrl || child.url || '#';
              let childRefId = null;
              
              if (childCategoryMatch) {
                childItemType = 'category';
                childUrl = `/categoria/${childCategoryMatch.slug}`;
                childRefId = childCategoryMatch.id;
              } else if (childPageMatch) {
                childItemType = 'page';
                childUrl = `/pagina/${childPageMatch.slug}`;
                childRefId = childPageMatch.id;
              }
              
              const { error: childError } = await supabase
                .from('menu_items')
                .insert({
                  tenant_id: currentTenant.id,
                  menu_id: targetMenuId,
                  label: child.label,
                  url: childUrl,
                  item_type: childItemType,
                  ref_id: childRefId,
                  parent_id: parentItem.id,
                  sort_order: i,
                });
              
              if (childError) {
                console.error('Error inserting child menu item:', childError);
              } else {
                totalItems++;
              }
            }
          }
        }
        
        return totalItems;
      };
      
      let totalMenuItems = 0;
      
      // === HEADER MENU ===
      if (headerMenuItems.length > 0) {
        const { data: headerMenuData, error: headerMenuError } = await supabase
          .from('menus')
          .upsert({
            tenant_id: currentTenant.id,
            name: 'Menu Header',
            location: 'header',
          }, { onConflict: 'tenant_id,location' })
          .select('id')
          .single();

        if (headerMenuError) {
          console.error('Error creating header menu:', headerMenuError);
          setImportErrors(prev => [...prev, 'Erro ao criar menu do header']);
        } else if (headerMenuData) {
          menuId = headerMenuData.id;
          setCreatedMenuId(headerMenuData.id);
          
          // Delete existing menu items for idempotency
          await supabase
            .from('menu_items')
            .delete()
            .eq('menu_id', headerMenuData.id);

          const headerItemsCount = await insertMenuItems(headerMenuItems, headerMenuData.id);
          totalMenuItems += headerItemsCount;
          console.log(`Imported ${headerItemsCount} header menu items`);
        }
      }
      
      // === FOOTER MENUS (Footer 1 = Categorias, Footer 2 = Institucional) ===
      if (footerMenuItems.length > 0) {
        // Helper to check if item is a category link
        const isCategoryItem = (item: any): boolean => {
          const url = item.internalUrl || item.url || '';
          const categoryMatch = findCategoryMatch(url, item.label || '');
          if (categoryMatch) return true;
          // Check URL patterns for categories
          if (/\/(?:collections?|categoria|category|c)\//i.test(url)) return true;
          return false;
        };
        
        // Helper to check if item is institutional/policy page
        const isInstitutionalItem = (item: any): boolean => {
          const url = item.internalUrl || item.url || '';
          const label = (item.label || '').toLowerCase();
          // Check URL patterns for pages
          if (/\/(?:pages?|pagina|policies)\//i.test(url)) return true;
          // Check common institutional labels
          const institutionalKeywords = [
            'política', 'politica', 'policy', 'policies',
            'termos', 'terms', 'privacidade', 'privacy',
            'troca', 'devolução', 'devoluçao', 'return', 'refund',
            'entrega', 'delivery', 'envio', 'shipping',
            'sobre', 'about', 'quem somos', 'contato', 'contact',
            'faq', 'ajuda', 'help', 'suporte', 'support'
          ];
          if (institutionalKeywords.some(kw => label.includes(kw))) return true;
          return false;
        };
        
        // Separate items into categories (footer_1) and institutional (footer_2)
        const categoryFooterItems: any[] = [];
        const institutionalFooterItems: any[] = [];
        
        for (const item of footerMenuItems) {
          if (isCategoryItem(item)) {
            categoryFooterItems.push(item);
          } else {
            institutionalFooterItems.push(item);
          }
        }
        
        // === FOOTER 1: Categories + Native links (Rastreio, Blog) ===
        const { data: footer1Data, error: footer1Error } = await supabase
          .from('menus')
          .upsert({
            tenant_id: currentTenant.id,
            name: 'Menu',
            location: 'footer_1',
          }, { onConflict: 'tenant_id,location' })
          .select('id')
          .single();

        if (footer1Error) {
          console.error('Error creating footer_1 menu:', footer1Error);
          setImportErrors(prev => [...prev, 'Erro ao criar menu Footer 1']);
        } else if (footer1Data) {
          await supabase
            .from('menu_items')
            .delete()
            .eq('menu_id', footer1Data.id);

          // Insert category items
          let footer1ItemsCount = await insertMenuItems(categoryFooterItems, footer1Data.id);
          
          // Add native pages as default items: Blog and Rastreio
          const nativeItems = [
            { label: 'Blog', url: '/blog', item_type: 'internal' },
            { label: 'Rastreio', url: '/rastreio', item_type: 'internal' },
          ];
          
          let sortOrder = categoryFooterItems.length;
          for (const native of nativeItems) {
            const { error: nativeError } = await supabase
              .from('menu_items')
              .insert({
                tenant_id: currentTenant.id,
                menu_id: footer1Data.id,
                label: native.label,
                url: native.url,
                item_type: native.item_type,
                ref_id: null,
                sort_order: sortOrder++,
                parent_id: null,
              });
            
            if (!nativeError) {
              footer1ItemsCount++;
            }
          }
          
          totalMenuItems += footer1ItemsCount;
          console.log(`Imported ${footer1ItemsCount} footer_1 (categories + native) menu items`);
        }
        
        // === FOOTER 2: Institutional/Policies (excluding Blog/Rastreio which are native) ===
        // Filter out items that are already added as native to footer_1
        const filteredInstitutionalItems = institutionalFooterItems.filter(item => {
          const label = (item.label || '').toLowerCase();
          // Skip Blog and Rastreio - they are native pages added to footer_1
          if (label === 'blog' || label === 'rastreio' || label === 'rastrear' || label === 'tracking') {
            return false;
          }
          return true;
        });
        
        if (filteredInstitutionalItems.length > 0) {
          const { data: footer2Data, error: footer2Error } = await supabase
            .from('menus')
            .upsert({
              tenant_id: currentTenant.id,
              name: 'Políticas',
              location: 'footer_2',
            }, { onConflict: 'tenant_id,location' })
            .select('id')
            .single();

          if (footer2Error) {
            console.error('Error creating footer_2 menu:', footer2Error);
            setImportErrors(prev => [...prev, 'Erro ao criar menu Footer 2']);
          } else if (footer2Data) {
            await supabase
              .from('menu_items')
              .delete()
              .eq('menu_id', footer2Data.id);

            const footer2ItemsCount = await insertMenuItems(filteredInstitutionalItems, footer2Data.id);
            totalMenuItems += footer2ItemsCount;
            console.log(`Imported ${footer2ItemsCount} footer_2 (institutional) menu items`);
          }
        }
        
        console.log(`Footer 1: ${categoryFooterItems.length} categories + 2 native, Footer 2: ${filteredInstitutionalItems.length} institutional`);
      }
      
      if (headerMenuItems.length === 0 && footerMenuItems.length === 0) {
        toast.info('Nenhum item de menu encontrado no site.');
      }
      
      stats.menuItems = totalMenuItems;
      
      setStructureProgress(prev => ({ ...prev, menus: 'completed' }));
      
      // === STEP 2.4: Import Home Page + Visual (banners, branding, business info) ===
      setStructureProgress(prev => ({ ...prev, visual: 'processing' }));
      
      const heroBanners = visualData.heroBanners || [];
      const branding = scrapedData.branding || visualData.branding || {};
      
      // Update tenant settings with visual config
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

      // === UPDATE STORE_SETTINGS with colors and business info ===
      const storeSettingsUpdate: Record<string, any> = {};
      
      // Apply colors to store_settings
      if (visualConfig.primaryColor) {
        storeSettingsUpdate.primary_color = visualConfig.primaryColor;
      }
      if (visualConfig.secondaryColor) {
        storeSettingsUpdate.secondary_color = visualConfig.secondaryColor;
      }
      if (visualConfig.accentColor) {
        storeSettingsUpdate.accent_color = visualConfig.accentColor;
      }
      if (visualConfig.logo) {
        storeSettingsUpdate.logo_url = visualConfig.logo;
      }
      if (visualConfig.favicon) {
        storeSettingsUpdate.favicon_url = visualConfig.favicon;
      }
      
      // Extract business info from visualData.contactInfo (newly extracted)
      const contactInfo = visualData.contactInfo || scrapedData.contactInfo || branding.contactInfo || {};
      if (contactInfo.phone) {
        storeSettingsUpdate.contact_phone = contactInfo.phone;
      }
      if (contactInfo.whatsapp) {
        storeSettingsUpdate.contact_whatsapp = contactInfo.whatsapp;
      }
      if (contactInfo.email) {
        storeSettingsUpdate.contact_email = contactInfo.email;
      }
      if (contactInfo.address) {
        storeSettingsUpdate.contact_address = contactInfo.address;
      }
      if (contactInfo.cnpj) {
        storeSettingsUpdate.business_cnpj = contactInfo.cnpj;
      }
      if (contactInfo.legalName) {
        storeSettingsUpdate.business_legal_name = contactInfo.legalName;
      }
      if (contactInfo.supportHours) {
        storeSettingsUpdate.contact_support_hours = contactInfo.supportHours;
      }
      
      // Extract social media links from visualData.socialLinks (newly extracted)
      const socialLinks = visualData.socialLinks || scrapedData.socialLinks || branding.socialLinks || {};
      if (socialLinks.facebook) {
        storeSettingsUpdate.social_facebook = socialLinks.facebook;
      }
      if (socialLinks.instagram) {
        storeSettingsUpdate.social_instagram = socialLinks.instagram;
      }
      if (socialLinks.tiktok) {
        storeSettingsUpdate.social_tiktok = socialLinks.tiktok;
      }
      if (socialLinks.youtube) {
        storeSettingsUpdate.social_youtube = socialLinks.youtube;
      }
      if (socialLinks.twitter) {
        storeSettingsUpdate.social_twitter = socialLinks.twitter;
      }
      if (socialLinks.linkedin) {
        storeSettingsUpdate.social_linkedin = socialLinks.linkedin;
      }
      if (socialLinks.pinterest) {
        storeSettingsUpdate.social_pinterest = socialLinks.pinterest;
      }
      
      // Only update if we have something to update
      if (Object.keys(storeSettingsUpdate).length > 0) {
        const { error: storeSettingsError } = await supabase
          .from('store_settings')
          .update(storeSettingsUpdate)
          .eq('tenant_id', currentTenant.id);
        
        if (storeSettingsError) {
          console.error('Error updating store_settings:', storeSettingsError);
          // Try upsert if record doesn't exist
          await supabase
            .from('store_settings')
            .upsert({
              tenant_id: currentTenant.id,
              ...storeSettingsUpdate,
            }, { onConflict: 'tenant_id' });
        }
        
        console.log('Updated store_settings with colors and business info:', Object.keys(storeSettingsUpdate));
      }

      // Create and publish home page with banners
      if (heroBanners.length > 0) {
        const homePageContent = generateHomePageContent(heroBanners, menuId || undefined);
        
        // Initialize storefront templates
        await supabase.rpc('initialize_storefront_templates', { 
          p_tenant_id: currentTenant.id 
        });
        
        // Archive old published versions
        await supabase
          .from('store_page_versions')
          .update({ status: 'archived' })
          .eq('tenant_id', currentTenant.id)
          .eq('entity_type', 'template')
          .eq('page_type', 'home')
          .eq('status', 'published');
        
        // Get max version
        const { data: maxVersionData } = await supabase
          .from('store_page_versions')
          .select('version')
          .eq('tenant_id', currentTenant.id)
          .eq('entity_type', 'template')
          .eq('page_type', 'home')
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const newVersion = (maxVersionData?.version || 0) + 1;
        
        // Insert new published version
        const { error: insertError } = await supabase
          .from('store_page_versions')
          .insert([{
            tenant_id: currentTenant.id,
            entity_type: 'template',
            version: newVersion,
            status: 'published',
            content: homePageContent as unknown as Json,
            page_type: 'home',
          }]);
        
        if (insertError) {
          console.error('Error inserting home template version:', insertError);
          setImportErrors(prev => [...prev, 'Erro ao publicar página inicial']);
        } else {
          // Update template to point to this version
          await supabase
            .from('storefront_page_templates')
            .update({ 
              published_version: newVersion,
              draft_version: newVersion,
            })
            .eq('tenant_id', currentTenant.id)
            .eq('page_type', 'home');
        }
        
        stats.banners = heroBanners.length;
      }
      
      setStructureProgress(prev => ({ ...prev, visual: 'completed' }));
      setImportStats(stats);
      
      toast.success('Estrutura da loja importada com sucesso!');
      
    } catch (error: any) {
      console.error('Visual import error:', error);
      const errorMessage = error.message || 'Erro ao importar estrutura visual';
      setImportErrors(prev => [...prev, errorMessage]);
      toast.error(errorMessage);
      
      // Mark current step as error
      setStructureProgress(prev => {
        if (prev.pages === 'processing') return { ...prev, pages: 'error' };
        if (prev.categories === 'processing') return { ...prev, categories: 'error' };
        if (prev.menus === 'processing') return { ...prev, menus: 'error' };
        if (prev.visual === 'processing') return { ...prev, visual: 'error' };
        return prev;
      });
    } finally {
      setIsImportingStructure(false);
    }
  }, [currentTenant, scrapedData, storeUrl, analysisResult]);

  // Check if structure import is complete
  const isStructureImportComplete = 
    structureProgress.pages === 'completed' &&
    structureProgress.categories === 'completed' &&
    structureProgress.menus === 'completed' &&
    structureProgress.visual === 'completed';

  // Calculate structure import progress percentage
  const getStructureProgressPercent = () => {
    const steps = ['pages', 'categories', 'menus', 'visual'] as const;
    const completed = steps.filter(s => structureProgress[s] === 'completed').length;
    return (completed / steps.length) * 100;
  };

  // Etapa 3: File import handlers
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
    // Normalize line endings and remove BOM
    let normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (normalizedContent.charCodeAt(0) === 0xFEFF) {
      normalizedContent = normalizedContent.substring(1);
    }
    
    // Detect delimiter
    const firstLine = normalizedContent.split('\n')[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';
    
    // Parse all fields including multi-line quoted values
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < normalizedContent.length; i++) {
      const char = normalizedContent[i];
      const nextChar = normalizedContent[i + 1];
      
      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote
            currentField += '"';
            i++;
          } else {
            // End of quoted field
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === delimiter) {
          currentRow.push(currentField.trim());
          currentField = '';
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.length > 0 && currentRow.some(f => f !== '')) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }
    
    // Push last field and row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f !== '')) {
        rows.push(currentRow);
      }
    }
    
    if (rows.length < 2) return [];
    
    // Parse headers - normalize them
    const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, '').replace(/^\ufeff/, ''));
    const rawData: any[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const obj: any = {};
      
      // Handle rows with different number of columns (be lenient)
      headers.forEach((header, index) => {
        obj[header] = values[index] !== undefined ? values[index] : '';
      });
      
      // Only add rows that have at least one non-empty value
      if (Object.values(obj).some(v => v !== '')) {
        rawData.push(obj);
      }
    }
    
    // Check if this is a Shopify product export (has Handle column and multiple rows per product)
    const hasHandle = headers.some(h => h.toLowerCase() === 'handle');
    const hasTitle = headers.some(h => h.toLowerCase() === 'title');
    const hasVariantSKU = headers.some(h => h.toLowerCase().includes('variant') && h.toLowerCase().includes('sku'));
    
    if (hasHandle && hasTitle && hasVariantSKU) {
      // Group rows by Handle and merge variant data
      return groupShopifyProductRows(rawData);
    }
    
    return rawData;
  };

  // Group Shopify CSV rows by Handle (products with variants have multiple rows)
  const groupShopifyProductRows = (rows: any[]): any[] => {
    const productMap = new Map<string, any>();

    for (const row of rows) {
      const handle = row['Handle'] || '';
      if (!handle) continue;

      if (!productMap.has(handle)) {
        // First row for this product - use as base (has the title and main info)
        productMap.set(handle, {
          ...row,
          variants: [],
          images: [],
        });
      }

      const product = productMap.get(handle)!;
      
      // Fill in missing fields from the first row (Shopify only puts Title on first row)
      if (!product['Title'] && row['Title']) product['Title'] = row['Title'];
      if (!product['Body (HTML)'] && row['Body (HTML)']) product['Body (HTML)'] = row['Body (HTML)'];
      if (!product['Vendor'] && row['Vendor']) product['Vendor'] = row['Vendor'];
      if (!product['Type'] && row['Type']) product['Type'] = row['Type'];
      if (!product['Tags'] && row['Tags']) product['Tags'] = row['Tags'];
      if (!product['Published'] && row['Published']) product['Published'] = row['Published'];
      if (!product['SEO Title'] && row['SEO Title']) product['SEO Title'] = row['SEO Title'];
      if (!product['SEO Description'] && row['SEO Description']) product['SEO Description'] = row['SEO Description'];

      // Add variant data if present
      const variantSKU = row['Variant SKU'];
      const variantPrice = row['Variant Price'];
      if (variantSKU || variantPrice) {
        product.variants.push({
          sku: variantSKU || null,
          price: variantPrice || '0',
          compare_at_price: row['Variant Compare At Price'] || null,
          inventory_quantity: parseInt(row['Variant Inventory Qty'] || '0', 10),
          weight: parseFloat(row['Variant Grams'] || row['Variant Weight'] || '0') || null,
          barcode: row['Variant Barcode'] || null,
          option1: row['Option1 Value'] || null,
          option2: row['Option2 Value'] || null,
          option3: row['Option3 Value'] || null,
          title: [row['Option1 Value'], row['Option2 Value'], row['Option3 Value']]
            .filter(Boolean)
            .join(' / ') || 'Default',
        });
      }

      // Add image if present and not duplicate
      const imageSrc = row['Image Src'];
      if (imageSrc && !product.images.some((img: any) => img.src === imageSrc)) {
        product.images.push({
          src: imageSrc,
          alt: row['Image Alt Text'] || null,
          position: product.images.length,
        });
      }
    }

    // Convert Map to array and set first variant as main product data if no direct price
    return Array.from(productMap.values()).map(product => {
      // If product doesn't have direct price/sku, use first variant
      if (!product['Variant Price'] && product.variants.length > 0) {
        const firstVariant = product.variants[0];
        product['Variant Price'] = firstVariant.price;
        product['Variant SKU'] = firstVariant.sku;
        product['Variant Compare At Price'] = firstVariant.compare_at_price;
        product['Variant Inventory Qty'] = firstVariant.inventory_quantity?.toString() || '0';
        product['Variant Grams'] = firstVariant.weight?.toString() || '';
        product['Variant Barcode'] = firstVariant.barcode;
      }
      
      console.log('[GuidedImportWizard] Produto agrupado:', {
        handle: product['Handle'],
        title: product['Title'],
        price: product['Variant Price'],
        sku: product['Variant SKU'],
        imagesCount: product.images?.length || 0,
        variantsCount: product.variants?.length || 0,
      });
      
      return product;
    });
  };

  const handleFileImportStep = useCallback(async (stepId: string, file?: File) => {
    if (!file || !currentTenant?.id) return;

    setFileStepStatuses(prev => ({
      ...prev,
      [stepId]: { ...prev[stepId], status: 'processing' },
    }));

    try {
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
        'tray': 'tray',
        'yampi': 'yampi',
      };
      const platform = platformMap[detectedPlatform] || 'generic';
      const adapter = getAdapter(platform as any);
      
      let normalizedData = data;
      if (adapter) {
        try {
          if (stepId === 'products' && adapter.normalizeProduct) {
            normalizedData = data.map(item => adapter.normalizeProduct!(item)).filter(Boolean);
          } else if (stepId === 'customers' && adapter.normalizeCustomer) {
            normalizedData = data.map(item => adapter.normalizeCustomer!(item)).filter(Boolean);
          } else if (stepId === 'orders' && adapter.normalizeOrder) {
            normalizedData = data.map(item => adapter.normalizeOrder!(item)).filter(Boolean);
          }
        } catch (normError: any) {
          console.error('Normalization error:', normError);
          // Continue with raw data if normalization fails
        }
      }

      // Filter out invalid entries
      let validData = normalizedData;
      if (stepId === 'customers') {
        validData = normalizedData.filter((item: any) => {
          const email = item.email || item.Email || item['Customer Email'] || item['E-mail'];
          return email && typeof email === 'string' && email.includes('@');
        });
        if (validData.length === 0) {
          throw new Error('Nenhum cliente com email válido encontrado no arquivo');
        }
      } else if (stepId === 'orders') {
        validData = normalizedData.filter((item: any) => {
          const orderNum = item.order_number || item.Name || item['Order Number'] || item['Pedido'];
          return orderNum !== undefined && orderNum !== '';
        });
        if (validData.length === 0) {
          throw new Error('Nenhum pedido válido encontrado no arquivo');
        }
      } else if (stepId === 'products') {
        validData = normalizedData.filter((item: any) => {
          const name = item.name || item.Title || item.Handle || item.title;
          return name && typeof name === 'string' && name.trim() !== '';
        });
        if (validData.length === 0) {
          throw new Error('Nenhum produto válido encontrado no arquivo');
        }
      }

      // For products, fetch existing categories to create a mapping
      let categoryMap: Record<string, string> | undefined;
      if (stepId === 'products') {
        const { data: categories } = await supabase
          .from('categories')
          .select('id, slug')
          .eq('tenant_id', currentTenant.id);
        
        if (categories && categories.length > 0) {
          categoryMap = {};
          categories.forEach(cat => {
            categoryMap![cat.slug] = cat.id;
          });
        }
      }

      const result = await importData(platform, stepId as any, validData, categoryMap);
      const importedCount = result?.results?.imported || validData.length;

      setFileStepStatuses(prev => ({
        ...prev,
        [stepId]: { status: 'completed', importedCount },
      }));

      toast.success(`${importedCount} itens importados com sucesso!`);

      // Activate next step
      const currentIndex = FILE_IMPORT_STEPS.findIndex(s => s.id === stepId);
      if (currentIndex < FILE_IMPORT_STEPS.length - 1) {
        const nextStep = FILE_IMPORT_STEPS[currentIndex + 1];
        setFileStepStatuses(prev => ({
          ...prev,
          [nextStep.id]: { status: 'active' },
        }));
      }
    } catch (error: any) {
      console.error('File import error:', error);
      const errorMsg = error.message || 'Erro desconhecido na importação';
      toast.error(`Erro ao importar: ${errorMsg}`);
      
      setFileStepStatuses(prev => ({
        ...prev,
        [stepId]: { status: 'error', errorMessage: errorMsg },
      }));

      // Still activate next step so user can continue
      const currentIndex = FILE_IMPORT_STEPS.findIndex(s => s.id === stepId);
      if (currentIndex < FILE_IMPORT_STEPS.length - 1) {
        const nextStep = FILE_IMPORT_STEPS[currentIndex + 1];
        setFileStepStatuses(prev => ({
          ...prev,
          [nextStep.id]: { status: 'active' },
        }));
      }
    }
  }, [analysisResult, importData, currentTenant]);

  const handleSkipFileStep = useCallback((stepId: string) => {
    setFileStepStatuses(prev => ({
      ...prev,
      [stepId]: { status: 'skipped' },
    }));
    
    const currentIndex = FILE_IMPORT_STEPS.findIndex(s => s.id === stepId);
    if (currentIndex < FILE_IMPORT_STEPS.length - 1) {
      const nextStep = FILE_IMPORT_STEPS[currentIndex + 1];
      setFileStepStatuses(prev => ({
        ...prev,
        [nextStep.id]: { status: 'active' },
      }));
    }
  }, []);

  const canProceedFromUrl = analysisResult?.success;

  const getStepStatusIcon = (status: 'pending' | 'processing' | 'completed' | 'error') => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  return (
    <Card className="max-w-3xl mx-auto border-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {wizardStep === 'url' && 'Etapa 1: Análise da Loja'}
          {wizardStep === 'file-import' && 'Etapa 2: Importação de Dados'}
          {wizardStep === 'structure-import' && 'Etapa 3: Estrutura da Loja'}
          {wizardStep === 'complete' && 'Importação Concluída'}
        </CardTitle>
        <CardDescription>
          {wizardStep === 'url' && 'Informe o link da sua loja para identificar a plataforma'}
          {wizardStep === 'file-import' && 'Importar produtos, clientes e pedidos via arquivo'}
          {wizardStep === 'structure-import' && 'Importar páginas, categorias, menus e visual da loja'}
          {wizardStep === 'complete' && 'Sua loja foi importada com sucesso!'}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-[400px]">
        {/* ETAPA 1: URL Analysis */}
        {wizardStep === 'url' && (
          <StoreUrlInput
            url={storeUrl}
            onUrlChange={setStoreUrl}
            onAnalyze={handleAnalyzeStore}
            isAnalyzing={isAnalyzing}
            analysisResult={analysisResult}
          />
        )}

        {/* ETAPA 2: File Import */}
        {wizardStep === 'file-import' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 mb-6">
              <p className="text-sm">
                <span className="font-medium">Loja:</span>{' '}
                <span className="text-muted-foreground">{storeUrl}</span>
                {analysisResult?.platform && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {analysisResult.platform} ({analysisResult.confidence})
                  </span>
                )}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 mb-6">
              <p className="text-sm text-muted-foreground">
                Importe produtos, clientes e pedidos via arquivo JSON ou CSV exportado da sua plataforma. Esta etapa é <strong>opcional</strong>.
              </p>
            </div>

            <div className="space-y-3">
              {FILE_IMPORT_STEPS.map((step) => (
                <ImportStep
                  key={step.id}
                  step={step}
                  status={fileStepStatuses[step.id]?.status || 'pending'}
                  onImport={(file) => handleFileImportStep(step.id, file)}
                  onSkip={() => handleSkipFileStep(step.id)}
                  isDisabled={false}
                  importedCount={fileStepStatuses[step.id]?.importedCount}
                  errorMessage={fileStepStatuses[step.id]?.errorMessage}
                />
              ))}
            </div>
          </div>
        )}

        {/* ETAPA 3: Structure Import */}
        {wizardStep === 'structure-import' && (
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm">
                <span className="font-medium">Loja:</span>{' '}
                <span className="text-muted-foreground">{storeUrl}</span>
                {analysisResult?.platform && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {analysisResult.platform} ({analysisResult.confidence})
                  </span>
                )}
              </p>
            </div>

            {!isImportingStructure && !isStructureImportComplete && (
              <div className="text-center py-8 space-y-6">
                <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                  <FolderTree className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Importar Estrutura da Loja</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Com um clique, vamos importar automaticamente: páginas institucionais, categorias, menus (header/footer com hierarquia) e a página inicial com banners.
                  </p>
                </div>
                <Button size="lg" onClick={handleImportStoreStructure}>
                  <Globe className="h-4 w-4 mr-2" />
                  Importar Estrutura da Loja
                </Button>
              </div>
            )}

            {(isImportingStructure || isStructureImportComplete) && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Progress value={getStructureProgressPercent()} className="flex-1" />
                  <span className="text-sm text-muted-foreground">
                    {Math.round(getStructureProgressPercent())}%
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getStepStatusIcon(structureProgress.pages)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Páginas da Loja</p>
                      <p className="text-xs text-muted-foreground">Sobre, Contato, Políticas, etc.</p>
                    </div>
                    {structureProgress.pages === 'completed' && importStats.pages > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {importStats.pages} encontradas
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getStepStatusIcon(structureProgress.categories)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Categorias</p>
                      <p className="text-xs text-muted-foreground">Páginas de listagem de produtos</p>
                    </div>
                    {structureProgress.categories === 'completed' && importStats.categories > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {importStats.categories} importadas
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getStepStatusIcon(structureProgress.menus)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Menus (Header/Footer)</p>
                      <p className="text-xs text-muted-foreground">Com hierarquia de dropdowns preservada</p>
                    </div>
                    {structureProgress.menus === 'completed' && importStats.menuItems > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {importStats.menuItems} itens
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getStepStatusIcon(structureProgress.visual)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Visual da Loja</p>
                      <p className="text-xs text-muted-foreground">Página inicial, banners e cores</p>
                    </div>
                    {structureProgress.visual === 'completed' && importStats.banners > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {importStats.banners} banners
                      </span>
                    )}
                  </div>
                </div>

                {importErrors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-4">
                    <p className="text-sm font-medium text-destructive mb-1">Erros encontrados:</p>
                    <ul className="text-xs text-destructive/80 list-disc list-inside">
                      {importErrors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {isStructureImportComplete && (
                  <div className="text-center pt-4">
                    <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Estrutura da loja importada com sucesso!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* COMPLETE */}
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
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Categorias: {importStats.categories}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Itens de Menu: {importStats.menuItems}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Banners: {importStats.banners}</span>
                </li>
                {Object.entries(fileStepStatuses).map(([stepId, status]) => {
                  const step = FILE_IMPORT_STEPS.find(s => s.id === stepId);
                  if (!step || status.status === 'pending') return null;
                  return (
                    <li key={stepId} className="flex items-center gap-2">
                      {status.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                      <span className={status.status === 'completed' ? '' : 'text-muted-foreground'}>
                        {step.title}
                        {status.importedCount !== undefined && status.importedCount > 0 && (
                          <span className="text-muted-foreground ml-1">
                            ({status.importedCount})
                          </span>
                        )}
                        {status.status === 'skipped' && (
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
              onClick={() => setWizardStep('file-import')} 
              disabled={!canProceedFromUrl}
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {wizardStep === 'file-import' && (
          <>
            <Button variant="outline" onClick={() => setWizardStep('url')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={() => setWizardStep('structure-import')}>
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {wizardStep === 'structure-import' && (
          <>
            <Button variant="outline" onClick={() => setWizardStep('file-import')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button 
              onClick={() => setWizardStep('complete')}
              disabled={!isStructureImportComplete}
            >
              Concluir
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {wizardStep === 'complete' && (
          <>
            <div />
            <Button onClick={onComplete}>
              Fechar
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
