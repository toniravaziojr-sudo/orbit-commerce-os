import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Loader2, Palette, FolderTree, FileText, Menu, ArrowRight, SkipForward, AlertCircle } from 'lucide-react';
import { ProgressWithETA } from '@/components/ui/progress-with-eta';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { generateBlockId } from '@/lib/builder/utils';
import type { BlockNode } from '@/lib/builder/types';

// Types for the structure import
export type ImportStepStatus = 'pending' | 'processing' | 'completed' | 'skipped' | 'error';

export interface StructureImportState {
  visual: ImportStepStatus;
  categories: ImportStepStatus;
  pages: ImportStepStatus;
  menus: ImportStepStatus;
}

export interface ImportStats {
  visual: {
    colors: number;
    contact: number;
    social: number;
    banners: number;
  };
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

// Required order of import steps
const IMPORT_ORDER = ['visual', 'categories', 'pages', 'menus'] as const;
type ImportStepKey = typeof IMPORT_ORDER[number];

const STEP_CONFIG: Record<ImportStepKey, { label: string; description: string; icon: React.ReactNode }> = {
  visual: {
    label: 'Visual da Loja',
    description: 'Cores, logo, informações de contato e redes sociais',
    icon: <Palette className="h-5 w-5" />,
  },
  categories: {
    label: 'Categorias',
    description: 'Categorias de produtos detectadas nos menus',
    icon: <FolderTree className="h-5 w-5" />,
  },
  pages: {
    label: 'Páginas Institucionais',
    description: 'Sobre, Políticas, FAQ e outras páginas de texto',
    icon: <FileText className="h-5 w-5" />,
  },
  menus: {
    label: 'Menus (Header/Footer)',
    description: 'Estrutura de navegação com hierarquia',
    icon: <Menu className="h-5 w-5" />,
  },
};

// Generate home page content from imported visual data
function generateHomePageContent(heroBanners: any[], menuId?: string): BlockNode {
  const children: BlockNode[] = [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: { menuId: menuId || '', showSearch: true, showCart: true, sticky: true },
    },
  ];

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

  children.push({
    id: generateBlockId('Section'),
    type: 'Section',
    props: { padding: 'lg' },
    children: [{ id: generateBlockId('CategoryList'), type: 'CategoryList', props: { title: 'Categorias', layout: 'grid', columns: 4 } }],
  });

  children.push({
    id: generateBlockId('Section'),
    type: 'Section',
    props: { backgroundColor: '#f9fafb', padding: 'lg' },
    children: [{ id: generateBlockId('ProductGrid'), type: 'ProductGrid', props: { title: 'Produtos em Destaque', source: 'featured', columns: 4, limit: 8, showPrice: true } }],
  });

  children.push({
    id: generateBlockId('Footer'),
    type: 'Footer',
    props: { menuId: '', showSocial: true, copyrightText: `© ${new Date().getFullYear()} Minha Loja. Todos os direitos reservados.` },
  });

  return { id: 'root', type: 'Page', props: {}, children };
}

export function StructureImportStep({ tenantId, storeUrl, scrapedData, analysisResult, onComplete }: StructureImportStepProps) {
  const [progress, setProgress] = useState<StructureImportState>({
    visual: 'pending',
    categories: 'pending',
    pages: 'pending',
    menus: 'pending',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<ImportStepKey | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [stats, setStats] = useState<ImportStats>({
    visual: { colors: 0, contact: 0, social: 0, banners: 0 },
    categories: 0,
    pages: 0,
    menuItems: 0,
  });
  
  // Visual data cached from first extraction
  const [visualData, setVisualData] = useState<any>(null);
  const [createdMenuId, setCreatedMenuId] = useState<string | null>(null);

  // Get the current step that should be active (first non-completed step in order)
  const getCurrentActiveStep = useCallback((): ImportStepKey | null => {
    for (const step of IMPORT_ORDER) {
      if (progress[step] === 'pending') return step;
    }
    return null;
  }, [progress]);

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
  // STEP 1: IMPORT VISUAL
  // ========================================
  const importVisual = useCallback(async () => {
    setIsProcessing(true);
    setCurrentStep('visual');
    setProgress(p => ({ ...p, visual: 'processing' }));
    
    try {
      // Try to get better HTML with JS rendered
      let htmlToUse = scrapedData?.html || '';
      
      try {
        const { data: betterScrape } = await supabase.functions.invoke('firecrawl-scrape', {
          body: { 
            url: storeUrl,
            options: { formats: ['html', 'links'], onlyMainContent: false, waitFor: 3000 }
          }
        });
        if (betterScrape?.data?.html) htmlToUse = betterScrape.data.html;
      } catch (e) {
        console.log('Fallback scrape failed, using original HTML');
      }

      // Call import-visual edge function
      const { data, error } = await supabase.functions.invoke('import-visual', {
        body: { url: storeUrl, html: htmlToUse, platform: analysisResult?.platform }
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha na extração visual');

      setVisualData(data);

      // Apply visual data to store_settings
      const storeSettingsUpdate: Record<string, any> = {};
      const branding = data.branding || {};
      const contactInfo = data.contactInfo || {};
      const socialLinks = data.socialLinks || {};

      let colorsImported = 0;
      let contactImported = 0;
      let socialImported = 0;

      // Colors - use correct column names from store_settings table
      if (branding.primaryColor) { storeSettingsUpdate.primary_color = branding.primaryColor; colorsImported++; }
      if (branding.secondaryColor) { storeSettingsUpdate.secondary_color = branding.secondaryColor; colorsImported++; }
      if (branding.accentColor) { storeSettingsUpdate.accent_color = branding.accentColor; colorsImported++; }

      // Contact info - use correct column names from store_settings table
      if (contactInfo.phone) { storeSettingsUpdate.contact_phone = contactInfo.phone; contactImported++; }
      if (contactInfo.whatsapp) { storeSettingsUpdate.social_whatsapp = contactInfo.whatsapp; contactImported++; }
      if (contactInfo.email) { storeSettingsUpdate.contact_email = contactInfo.email; contactImported++; }
      if (contactInfo.address) { storeSettingsUpdate.contact_address = contactInfo.address; contactImported++; }
      if (contactInfo.cnpj) { storeSettingsUpdate.business_cnpj = contactInfo.cnpj; contactImported++; }
      if (contactInfo.legalName) { storeSettingsUpdate.business_legal_name = contactInfo.legalName; contactImported++; }
      if (contactInfo.supportHours) { storeSettingsUpdate.contact_support_hours = contactInfo.supportHours; contactImported++; }

      // Social links - use correct column names from store_settings table
      // Note: social_twitter, social_linkedin, social_pinterest don't exist in store_settings
      // They should be stored in social_custom JSON array if needed
      if (socialLinks.facebook) { storeSettingsUpdate.social_facebook = socialLinks.facebook; socialImported++; }
      if (socialLinks.instagram) { storeSettingsUpdate.social_instagram = socialLinks.instagram; socialImported++; }
      if (socialLinks.tiktok) { storeSettingsUpdate.social_tiktok = socialLinks.tiktok; socialImported++; }
      if (socialLinks.youtube) { storeSettingsUpdate.social_youtube = socialLinks.youtube; socialImported++; }
      
      // Store additional social links in social_custom array
      const customSocial: Array<{ platform: string; url: string }> = [];
      if (socialLinks.twitter) { customSocial.push({ platform: 'twitter', url: socialLinks.twitter }); socialImported++; }
      if (socialLinks.linkedin) { customSocial.push({ platform: 'linkedin', url: socialLinks.linkedin }); socialImported++; }
      if (socialLinks.pinterest) { customSocial.push({ platform: 'pinterest', url: socialLinks.pinterest }); socialImported++; }
      if (customSocial.length > 0) { storeSettingsUpdate.social_custom = customSocial; }

      if (Object.keys(storeSettingsUpdate).length > 0) {
        const { error: updateError } = await supabase.from('store_settings').update(storeSettingsUpdate).eq('tenant_id', tenantId);
        if (updateError) {
          await supabase.from('store_settings').upsert({ tenant_id: tenantId, ...storeSettingsUpdate }, { onConflict: 'tenant_id' });
        }
      }

      // Create home page with banners
      const heroBanners = data.heroBanners || [];
      if (heroBanners.length > 0) {
        const homePageContent = generateHomePageContent(heroBanners);
        await supabase.rpc('initialize_storefront_templates', { p_tenant_id: tenantId });
        await supabase.from('store_page_versions').update({ status: 'archived' })
          .eq('tenant_id', tenantId).eq('entity_type', 'template').eq('page_type', 'home').eq('status', 'published');
        
        const { data: maxVersionData } = await supabase.from('store_page_versions')
          .select('version').eq('tenant_id', tenantId).eq('entity_type', 'template').eq('page_type', 'home')
          .order('version', { ascending: false }).limit(1).maybeSingle();
        
        const newVersion = (maxVersionData?.version || 0) + 1;
        await supabase.from('store_page_versions').insert([{
          tenant_id: tenantId, entity_type: 'template', version: newVersion, status: 'published',
          content: homePageContent as unknown as Json, page_type: 'home',
        }]);
        
        await supabase.from('storefront_page_templates').update({ published_version: newVersion, draft_version: newVersion })
          .eq('tenant_id', tenantId).eq('page_type', 'home');
      }

      setStats(s => ({ ...s, visual: { colors: colorsImported, contact: contactImported, social: socialImported, banners: heroBanners.length } }));
      setProgress(p => ({ ...p, visual: 'completed' }));
      toast.success(`Visual importado: ${colorsImported} cores, ${contactImported} contatos, ${socialImported} redes sociais, ${heroBanners.length} banners`);
    } catch (err: any) {
      console.error('Error importing visual:', err);
      setErrors(e => [...e, `Visual: ${err.message}`]);
      setProgress(p => ({ ...p, visual: 'error' }));
      toast.error(`Erro ao importar visual: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }, [tenantId, storeUrl, scrapedData, analysisResult]);

  // ========================================
  // STEP 2: IMPORT CATEGORIES
  // ========================================
  const importCategories = useCallback(async () => {
    setIsProcessing(true);
    setCurrentStep('categories');
    setProgress(p => ({ ...p, categories: 'processing' }));

    try {
      // Use cached visual data or fetch fresh
      let data = visualData;
      if (!data) {
        const { data: freshData, error } = await supabase.functions.invoke('import-visual', {
          body: { url: storeUrl, html: scrapedData?.html || '', platform: analysisResult?.platform }
        });
        if (error) throw new Error(error.message);
        data = freshData;
        setVisualData(data);
      }

      const allCategories: Array<{ name: string; slug: string; url?: string }> = [];
      const processedSlugs = new Set<string>();

      const extractSlugFromUrl = (url: string): string | null => {
        const match = /\/(?:collections?|categoria|category|c)\/([^/?#]+)/i.exec(url);
        return match ? match[1] : null;
      };

      // Process menu items
      const processMenuItem = (item: any) => {
        const slug = extractSlugFromUrl(item.url || '');
        if ((item.type === 'category' || slug) && slug && !processedSlugs.has(slug)) {
          allCategories.push({ name: item.label || item.name, slug, url: item.url });
          processedSlugs.add(slug);
        }
        if (item.children) item.children.forEach(processMenuItem);
      };

      (data.menuItems || []).forEach(processMenuItem);
      (data.categories || []).forEach((cat: any) => {
        if (cat?.slug && !processedSlugs.has(cat.slug)) {
          allCategories.push({ name: cat.name, slug: cat.slug, url: cat.url });
          processedSlugs.add(cat.slug);
        }
      });

      // Save categories
      let importedCount = 0;
      for (const cat of allCategories) {
        if (!cat?.slug) continue;
        const { error } = await supabase.from('categories').upsert({
          tenant_id: tenantId,
          name: cat.name || cat.slug,
          slug: cat.slug.toLowerCase(),
          is_active: true,
        }, { onConflict: 'tenant_id,slug' });
        
        if (!error) importedCount++;
      }

      setStats(s => ({ ...s, categories: importedCount }));
      setProgress(p => ({ ...p, categories: 'completed' }));
      toast.success(`${importedCount} categorias importadas`);
    } catch (err: any) {
      console.error('Error importing categories:', err);
      setErrors(e => [...e, `Categorias: ${err.message}`]);
      setProgress(p => ({ ...p, categories: 'error' }));
      toast.error(`Erro ao importar categorias: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }, [tenantId, storeUrl, scrapedData, analysisResult, visualData]);

  // ========================================
  // STEP 3: IMPORT PAGES
  // ========================================
  const importPages = useCallback(async () => {
    setIsProcessing(true);
    setCurrentStep('pages');
    setProgress(p => ({ ...p, pages: 'processing' }));

    try {
      let data = visualData;
      if (!data) {
        const { data: freshData, error } = await supabase.functions.invoke('import-visual', {
          body: { url: storeUrl, html: scrapedData?.html || '', platform: analysisResult?.platform }
        });
        if (error) throw new Error(error.message);
        data = freshData;
        setVisualData(data);
      }

      const institutionalPages = data.institutionalPages || [];
      let importedCount = 0;

      if (institutionalPages.length > 0) {
        const { data: result, error } = await supabase.functions.invoke('import-pages', {
          body: { tenantId, pages: institutionalPages, platform: analysisResult?.platform, storeUrl }
        });

        if (error) {
          console.error('Error calling import-pages:', error);
          setErrors(e => [...e, `Páginas: ${error.message}`]);
        } else if (result?.success) {
          importedCount = result.results?.imported || 0;
        } else if (result?.error) {
          setErrors(e => [...e, `Páginas: ${result.error}`]);
        }
      }

      setStats(s => ({ ...s, pages: importedCount }));
      setProgress(p => ({ ...p, pages: 'completed' }));
      toast.success(importedCount > 0 ? `${importedCount} páginas importadas` : 'Nenhuma página institucional encontrada');
    } catch (err: any) {
      console.error('Error importing pages:', err);
      setErrors(e => [...e, `Páginas: ${err.message}`]);
      setProgress(p => ({ ...p, pages: 'error' }));
      toast.error(`Erro ao importar páginas: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }, [tenantId, storeUrl, scrapedData, analysisResult, visualData]);

  // ========================================
  // STEP 4: IMPORT MENUS
  // ========================================
  const importMenus = useCallback(async () => {
    setIsProcessing(true);
    setCurrentStep('menus');
    setProgress(p => ({ ...p, menus: 'processing' }));

    try {
      let data = visualData;
      if (!data) {
        const { data: freshData, error } = await supabase.functions.invoke('import-visual', {
          body: { url: storeUrl, html: scrapedData?.html || '', platform: analysisResult?.platform }
        });
        if (error) throw new Error(error.message);
        data = freshData;
        setVisualData(data);
      }

      const headerMenuItems = data.menuItems || [];
      const footerMenuItems = data.footerMenuItems || [];
      let totalMenuItems = 0;

      // Get imported categories and pages for linking
      const { data: importedCategories } = await supabase.from('categories').select('id, slug, name').eq('tenant_id', tenantId);
      const { data: importedPages } = await supabase.from('store_pages').select('id, slug, title').eq('tenant_id', tenantId);

      const categoryMap = new Map<string, { id: string; slug: string }>();
      (importedCategories || []).forEach(cat => {
        categoryMap.set(cat.slug.toLowerCase(), { id: cat.id, slug: cat.slug });
        categoryMap.set(cat.name.toLowerCase().replace(/\s+/g, '-'), { id: cat.id, slug: cat.slug });
      });

      const pageMap = new Map<string, { id: string; slug: string }>();
      (importedPages || []).forEach(page => {
        pageMap.set(page.slug.toLowerCase(), { id: page.id, slug: page.slug });
        pageMap.set(page.title.toLowerCase().replace(/\s+/g, '-'), { id: page.id, slug: page.slug });
      });

      const findCategoryMatch = (url: string, label: string) => {
        const match = url.match(/\/(?:collections?|categoria|category|c)\/([^/?#]+)/i);
        if (match && categoryMap.has(match[1].toLowerCase())) return categoryMap.get(match[1].toLowerCase());
        const labelSlug = label.toLowerCase().replace(/\s+/g, '-');
        return categoryMap.get(labelSlug) || null;
      };

      const findPageMatch = (url: string, label: string) => {
        const match = url.match(/\/(?:pages?|pagina|policies)\/([^/?#]+)/i);
        if (match && pageMap.has(match[1].toLowerCase())) return pageMap.get(match[1].toLowerCase());
        const labelSlug = label.toLowerCase().replace(/\s+/g, '-');
        return pageMap.get(labelSlug) || null;
      };

      const insertMenuItems = async (items: any[], menuId: string) => {
        let count = 0;
        let sortOrder = 0;

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

          const { data: parentItem, error } = await supabase.from('menu_items').insert({
            tenant_id: tenantId, menu_id: menuId, label: item.label, url: itemUrl,
            item_type: itemType, ref_id: refId, sort_order: sortOrder++, parent_id: null,
          }).select('id').single();

          if (error) continue;
          count++;

          // Insert children
          if (item.children && parentItem) {
            for (let i = 0; i < item.children.length; i++) {
              const child = item.children[i];
              const childCategoryMatch = findCategoryMatch(child.internalUrl || child.url || '', child.label || '');
              const childPageMatch = !childCategoryMatch ? findPageMatch(child.internalUrl || child.url || '', child.label || '') : null;

              let childType = child.type || 'external';
              let childUrl = child.internalUrl || child.url || '#';
              let childRefId = null;

              if (childCategoryMatch) {
                childType = 'category';
                childUrl = `/categoria/${childCategoryMatch.slug}`;
                childRefId = childCategoryMatch.id;
              } else if (childPageMatch) {
                childType = 'page';
                childUrl = `/pagina/${childPageMatch.slug}`;
                childRefId = childPageMatch.id;
              }

              const { error: childError } = await supabase.from('menu_items').insert({
                tenant_id: tenantId, menu_id: menuId, label: child.label, url: childUrl,
                item_type: childType, ref_id: childRefId, parent_id: parentItem.id, sort_order: i,
              });

              if (!childError) count++;
            }
          }
        }
        return count;
      };

      // Header Menu
      if (headerMenuItems.length > 0) {
        const { data: headerMenu } = await supabase.from('menus')
          .upsert({ tenant_id: tenantId, name: 'Menu Header', location: 'header' }, { onConflict: 'tenant_id,location' })
          .select('id').single();

        if (headerMenu) {
          setCreatedMenuId(headerMenu.id);
          await supabase.from('menu_items').delete().eq('menu_id', headerMenu.id);
          totalMenuItems += await insertMenuItems(headerMenuItems, headerMenu.id);
        }
      }

      // Footer Menu 1 (Categorias)
      const categoryFooterItems = footerMenuItems.filter((item: any) => 
        /\/(?:collections?|categoria|category|c)\//i.test(item.url || '')
      );
      if (categoryFooterItems.length > 0) {
        const { data: footer1 } = await supabase.from('menus')
          .upsert({ tenant_id: tenantId, name: 'Footer 1', location: 'footer_1' }, { onConflict: 'tenant_id,location' })
          .select('id').single();
        if (footer1) {
          await supabase.from('menu_items').delete().eq('menu_id', footer1.id);
          totalMenuItems += await insertMenuItems(categoryFooterItems, footer1.id);
        }
      }

      // Footer Menu 2 (Institucional)
      const institutionalFooterItems = footerMenuItems.filter((item: any) => 
        /\/(?:pages?|pagina|policies)\//i.test(item.url || '')
      );
      if (institutionalFooterItems.length > 0) {
        const { data: footer2 } = await supabase.from('menus')
          .upsert({ tenant_id: tenantId, name: 'Footer 2', location: 'footer_2' }, { onConflict: 'tenant_id,location' })
          .select('id').single();
        if (footer2) {
          await supabase.from('menu_items').delete().eq('menu_id', footer2.id);
          totalMenuItems += await insertMenuItems(institutionalFooterItems, footer2.id);
        }
      }

      setStats(s => ({ ...s, menuItems: totalMenuItems }));
      setProgress(p => ({ ...p, menus: 'completed' }));
      toast.success(`${totalMenuItems} itens de menu importados`);

      // Call onComplete when menus (last step) is done
      if (isAllDone || (progress.visual !== 'pending' && progress.categories !== 'pending' && progress.pages !== 'pending')) {
        onComplete(stats);
      }
    } catch (err: any) {
      console.error('Error importing menus:', err);
      setErrors(e => [...e, `Menus: ${err.message}`]);
      setProgress(p => ({ ...p, menus: 'error' }));
      toast.error(`Erro ao importar menus: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentStep(null);
    }
  }, [tenantId, storeUrl, scrapedData, analysisResult, visualData, stats, progress, onComplete, isAllDone]);

  // Skip a step
  const skipStep = useCallback((step: ImportStepKey) => {
    setProgress(p => ({ ...p, [step]: 'skipped' }));
    toast.info(`${STEP_CONFIG[step].label} pulado`);
  }, []);

  // Handler map
  const stepHandlers: Record<ImportStepKey, () => Promise<void>> = {
    visual: importVisual,
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
      case 'visual':
        const v = stats.visual;
        return `${v.colors} cores, ${v.contact} contatos, ${v.social} redes, ${v.banners} banners`;
      case 'categories':
        return `${stats.categories} importadas`;
      case 'pages':
        return stats.pages > 0 ? `${stats.pages} importadas` : 'Nenhuma encontrada';
      case 'menus':
        return `${stats.menuItems} itens`;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning about order */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Ordem obrigatória:</strong> Para que a importação funcione corretamente, siga a ordem: Visual → Categorias → Páginas → Menus.
          Você pode pular etapas, mas os menus só serão corretamente vinculados se categorias e páginas forem importados antes.
        </AlertDescription>
      </Alert>

      {/* Steps */}
      <div className="space-y-3">
        {IMPORT_ORDER.map((step, index) => {
          const config = STEP_CONFIG[step];
          const status = progress[step];
          const canStart = canStartStep(step);
          const isActive = currentStep === step;
          const statsText = renderStepStats(step);

          return (
            <Card key={step} className={`transition-colors ${isActive ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Step number and icon */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-5">{index + 1}.</span>
                    {getStatusIcon(status)}
                  </div>

                  {/* Step info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {config.icon}
                      <span className="font-medium">{config.label}</span>
                      {statsText && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {statsText}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{config.description}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
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
                          {isProcessing && isActive ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4 mr-1" />
                          )}
                          Importar
                        </Button>
                      </>
                    )}
                    {status === 'completed' && (
                      <span className="text-sm text-green-600 font-medium">Concluído</span>
                    )}
                    {status === 'skipped' && (
                      <span className="text-sm text-muted-foreground">Pulado</span>
                    )}
                    {status === 'error' && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setProgress(p => ({ ...p, [step]: 'pending' }));
                      }}>
                        Tentar novamente
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Completion message */}
      {isAllDone && (
        <div className="text-center py-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Estrutura da loja importada!
          </p>
        </div>
      )}
    </div>
  );
}
