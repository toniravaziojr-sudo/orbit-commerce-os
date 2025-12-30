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

// Wizard steps: url -> visual-import -> file-import -> complete
type WizardStep = 'url' | 'visual-import' | 'file-import' | 'complete';

// Sub-steps within visual import (Etapa 2)
interface VisualImportProgress {
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

// File import steps (Etapa 3 - opcional)
const FILE_IMPORT_STEPS: ImportStepConfig[] = [
  {
    id: 'products',
    title: 'Produtos',
    description: 'Importar produtos e vincular às categorias importadas via arquivo JSON ou CSV',
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
  
  // Visual import state (Etapa 2)
  const [isImportingVisual, setIsImportingVisual] = useState(false);
  const [visualProgress, setVisualProgress] = useState<VisualImportProgress>({
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
    status: 'pending' | 'active' | 'completed' | 'skipped' | 'processing';
    importedCount?: number;
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

  // Etapa 2: Import visual structure (pages, categories, menus, visual) in one click
  const handleImportVisualStructure = useCallback(async () => {
    if (!currentTenant?.id || !scrapedData) {
      toast.error('Dados da loja não disponíveis');
      return;
    }

    setIsImportingVisual(true);
    setImportErrors([]);
    const stats: ImportStats = { pages: 0, categories: 0, menuItems: 0, banners: 0 };
    
    try {
      // Step 1: Get better HTML with JS rendered (for menus)
      let htmlToUse = scrapedData.html || '';
      
      setVisualProgress(prev => ({ ...prev, pages: 'processing' }));
      toast.info('Extraindo estrutura visual da loja...');
      
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
      setVisualProgress(prev => ({ ...prev, pages: 'processing' }));
      
      // For now, pages are extracted from menu items with type 'page'
      // TODO: Create actual pages in the pages table
      const pageItems = (visualData.menuItems || []).filter((item: any) => 
        item.type === 'page' || 
        /\/(?:pages?|pagina|sobre|contato|politica|termos)/i.test(item.url || '')
      );
      stats.pages = pageItems.length;
      setVisualProgress(prev => ({ ...prev, pages: 'completed' }));
      
      // === STEP 2.2: Import Categories (FLAT - no hierarchy in categories) ===
      setVisualProgress(prev => ({ ...prev, categories: 'processing' }));
      
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
      
      setVisualProgress(prev => ({ ...prev, categories: 'completed' }));
      
      // === STEP 2.3: Import Menus (with hierarchy - parent_id in menu_items) ===
      setVisualProgress(prev => ({ ...prev, menus: 'processing' }));
      
      const menuItems = visualData.menuItems || [];
      let menuId: string | null = null;
      
      if (menuItems.length > 0) {
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
        
        // Helper to find category match from URL or label
        const findCategoryMatch = (url: string, label: string) => {
          // Try to extract slug from URL
          const collectionMatch = url.match(/\/(?:collections?|categoria|category|c)\/([^/?#]+)/i);
          if (collectionMatch) {
            const slug = collectionMatch[1].toLowerCase();
            if (categoryMap.has(slug)) {
              return categoryMap.get(slug);
            }
          }
          // Try to match by label
          const labelSlug = label.toLowerCase().replace(/\s+/g, '-');
          if (categoryMap.has(labelSlug)) {
            return categoryMap.get(labelSlug);
          }
          return null;
        };
        
        // Create or update header menu
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
          setImportErrors(prev => [...prev, 'Erro ao criar menu principal']);
        } else if (menuData) {
          menuId = menuData.id;
          setCreatedMenuId(menuData.id);
          
          // Delete existing menu items for idempotency
          await supabase
            .from('menu_items')
            .delete()
            .eq('menu_id', menuData.id);

          // Insert menu items WITH HIERARCHY (parent_id in menu_items)
          let sortOrder = 0;
          let totalMenuItems = 0;
          
          for (const item of menuItems) {
            const categoryMatch = findCategoryMatch(item.internalUrl || item.url || '', item.label || '');
            
            // Determine item type and URL based on category match
            const itemType = categoryMatch ? 'category' : (item.type || 'link');
            const itemUrl = categoryMatch 
              ? `/categoria/${categoryMatch.slug}` 
              : (item.internalUrl || item.url || '#');
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
                parent_id: null, // Parent items have no parent
              })
              .select('id')
              .single();
            
            if (parentError) {
              console.error('Error inserting parent menu item:', parentError);
              continue;
            }
            
            totalMenuItems++;
            
            // Insert children with parent_id (THIS IS THE HIERARCHY)
            if (item.children && item.children.length > 0 && parentItem) {
              for (let i = 0; i < item.children.length; i++) {
                const child = item.children[i];
                const childCategoryMatch = findCategoryMatch(child.internalUrl || child.url || '', child.label || '');
                
                const childItemType = childCategoryMatch ? 'category' : (child.type || 'link');
                const childUrl = childCategoryMatch 
                  ? `/categoria/${childCategoryMatch.slug}` 
                  : (child.internalUrl || child.url || '#');
                const childRefId = childCategoryMatch?.id || null;
                
                const { error: childError } = await supabase
                  .from('menu_items')
                  .insert({
                    tenant_id: currentTenant.id,
                    menu_id: menuData.id,
                    label: child.label,
                    url: childUrl,
                    item_type: childItemType,
                    ref_id: childRefId,
                    parent_id: parentItem.id, // HIERARCHY: children reference parent
                    sort_order: i,
                  });
                
                if (childError) {
                  console.error('Error inserting child menu item:', childError);
                } else {
                  totalMenuItems++;
                }
              }
            }
          }
          
          stats.menuItems = totalMenuItems;
        }
      } else {
        toast.info('Nenhum item de menu encontrado no site.');
      }
      
      setVisualProgress(prev => ({ ...prev, menus: 'completed' }));
      
      // === STEP 2.4: Import Home Page + Visual (banners, branding) ===
      setVisualProgress(prev => ({ ...prev, visual: 'processing' }));
      
      const heroBanners = visualData.heroBanners || [];
      const branding = scrapedData.branding || visualData.branding || {};
      
      // Update tenant with visual config
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
      
      setVisualProgress(prev => ({ ...prev, visual: 'completed' }));
      setImportStats(stats);
      
      toast.success('Estrutura visual importada com sucesso!');
      
    } catch (error: any) {
      console.error('Visual import error:', error);
      const errorMessage = error.message || 'Erro ao importar estrutura visual';
      setImportErrors(prev => [...prev, errorMessage]);
      toast.error(errorMessage);
      
      // Mark current step as error
      setVisualProgress(prev => {
        if (prev.pages === 'processing') return { ...prev, pages: 'error' };
        if (prev.categories === 'processing') return { ...prev, categories: 'error' };
        if (prev.menus === 'processing') return { ...prev, menus: 'error' };
        if (prev.visual === 'processing') return { ...prev, visual: 'error' };
        return prev;
      });
    } finally {
      setIsImportingVisual(false);
    }
  }, [currentTenant, scrapedData, storeUrl, analysisResult]);

  // Check if visual import is complete
  const isVisualImportComplete = 
    visualProgress.pages === 'completed' &&
    visualProgress.categories === 'completed' &&
    visualProgress.menus === 'completed' &&
    visualProgress.visual === 'completed';

  // Calculate visual import progress percentage
  const getVisualProgressPercent = () => {
    const steps = ['pages', 'categories', 'menus', 'visual'] as const;
    const completed = steps.filter(s => visualProgress[s] === 'completed').length;
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
        if (stepId === 'products' && adapter.normalizeProduct) {
          normalizedData = data.map(item => adapter.normalizeProduct!(item));
        } else if (stepId === 'customers' && adapter.normalizeCustomer) {
          normalizedData = data.map(item => adapter.normalizeCustomer!(item));
        } else if (stepId === 'orders' && adapter.normalizeOrder) {
          normalizedData = data.map(item => adapter.normalizeOrder!(item));
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

      const result = await importData(platform, stepId as any, normalizedData, categoryMap);
      const importedCount = result?.results?.imported || data.length;

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
      toast.error(`Erro ao importar: ${error.message}`);
      setFileStepStatuses(prev => ({
        ...prev,
        [stepId]: { ...prev[stepId], status: 'active' },
      }));
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
          {wizardStep === 'visual-import' && 'Etapa 2: Importação Visual'}
          {wizardStep === 'file-import' && 'Etapa 3: Importação de Dados (Opcional)'}
          {wizardStep === 'complete' && 'Importação Concluída'}
        </CardTitle>
        <CardDescription>
          {wizardStep === 'url' && 'Informe o link da sua loja para identificar a plataforma'}
          {wizardStep === 'visual-import' && 'Importar páginas, categorias, menus e visual da loja em um clique'}
          {wizardStep === 'file-import' && 'Importar produtos, clientes e pedidos via arquivo (opcional)'}
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

        {/* ETAPA 2: Visual Import (1 click) */}
        {wizardStep === 'visual-import' && (
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

            {!isImportingVisual && !isVisualImportComplete && (
              <div className="text-center py-8 space-y-6">
                <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                  <Palette className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Importar Estrutura Visual</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Com um clique, vamos importar automaticamente: páginas institucionais, categorias, menus (header/footer com hierarquia) e a página inicial com banners.
                  </p>
                </div>
                <Button size="lg" onClick={handleImportVisualStructure}>
                  <Globe className="h-4 w-4 mr-2" />
                  Importar Estrutura Visual
                </Button>
              </div>
            )}

            {(isImportingVisual || isVisualImportComplete) && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Progress value={getVisualProgressPercent()} className="flex-1" />
                  <span className="text-sm text-muted-foreground">
                    {Math.round(getVisualProgressPercent())}%
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getStepStatusIcon(visualProgress.pages)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Páginas Institucionais</p>
                      <p className="text-xs text-muted-foreground">Sobre, Contato, Políticas, etc.</p>
                    </div>
                    {visualProgress.pages === 'completed' && importStats.pages > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {importStats.pages} encontradas
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getStepStatusIcon(visualProgress.categories)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Categorias</p>
                      <p className="text-xs text-muted-foreground">Páginas de listagem de produtos (flat)</p>
                    </div>
                    {visualProgress.categories === 'completed' && importStats.categories > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {importStats.categories} importadas
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getStepStatusIcon(visualProgress.menus)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Menus (Header/Footer)</p>
                      <p className="text-xs text-muted-foreground">Com hierarquia de dropdowns preservada</p>
                    </div>
                    {visualProgress.menus === 'completed' && importStats.menuItems > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {importStats.menuItems} itens
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {getStepStatusIcon(visualProgress.visual)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">Página Inicial + Visual</p>
                      <p className="text-xs text-muted-foreground">Banners, cores e identidade visual</p>
                    </div>
                    {visualProgress.visual === 'completed' && importStats.banners > 0 && (
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

                {isVisualImportComplete && (
                  <div className="text-center pt-4">
                    <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Estrutura visual importada! Você pode continuar para importar produtos, clientes e pedidos via arquivo.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ETAPA 3: File Import (optional) */}
        {wizardStep === 'file-import' && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 mb-6">
              <p className="text-sm text-muted-foreground">
                Esta etapa é <strong>opcional</strong>. Importe produtos, clientes e pedidos via arquivo JSON ou CSV exportado da sua plataforma.
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
                />
              ))}
            </div>
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
              onClick={() => setWizardStep('visual-import')} 
              disabled={!canProceedFromUrl}
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {wizardStep === 'visual-import' && (
          <>
            <Button variant="outline" onClick={() => setWizardStep('url')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button 
              onClick={() => setWizardStep('file-import')}
              disabled={!isVisualImportComplete}
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </>
        )}

        {wizardStep === 'file-import' && (
          <>
            <Button variant="outline" onClick={() => setWizardStep('visual-import')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={() => setWizardStep('complete')}>
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
