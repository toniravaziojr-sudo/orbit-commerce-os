// =============================================
// BUILDER TOOLBAR - Top toolbar with actions
// =============================================

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Undo2,
  Redo2,
  Save,
  Upload,
  MoreVertical,
  RotateCcw,
  History,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  CreditCard,
  Loader2,
  Eye,
  Globe,
} from 'lucide-react';
import { getPreviewUrlWithValidation } from '@/lib/publicUrls';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrimaryPublicHost } from '@/hooks/usePrimaryPublicHost';

interface BuilderToolbarProps {
  pageTitle: string;
  pageType: string;
  pageId?: string; // For institutional/landing pages (page ID)
  tenantSlug?: string;
  pageSlug?: string; // For institutional/landing pages
  templateSetId?: string; // For multi-template system - preserve across page changes
  isDirty: boolean;
  isPublished?: boolean; // Whether the store is already published
  canUndo: boolean;
  canRedo: boolean;
  isSaving?: boolean;
  isPublishing?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPublish: () => void;
  onReset?: () => void;
  onViewHistory?: () => void;
  onSettings?: () => void;
  onBack: () => void;
  onPageChange?: (pageType: string) => void;
  onPageChangeCheck?: (targetUrl: string) => boolean; // Returns true if navigation can proceed
  // Example selectors - product selector UI removed from toolbar (use right panel)
  exampleProductId?: string;
  exampleCategoryId?: string;
  onExampleCategoryChange?: (categoryId: string) => void;
}

export function BuilderToolbar({
  pageTitle,
  pageType,
  pageId,
  tenantSlug,
  pageSlug,
  templateSetId,
  isDirty,
  isPublished = false,
  canUndo,
  canRedo,
  isSaving = false,
  isPublishing = false,
  onUndo,
  onRedo,
  onSave,
  onPublish,
  onReset,
  onViewHistory,
  onBack,
  onPageChangeCheck,
  exampleProductId,
  exampleCategoryId,
  onExampleCategoryChange,
}: BuilderToolbarProps) {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, tenantSlug);
  const { canPublishStore, needsPaymentMethod, isBasicPlan } = useSubscriptionStatus();

  // Fetch products for Product template (for preview URL only, no UI selector)
  const { data: products } = useQuery({
    queryKey: ['builder-example-products', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, slug')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active')
        .order('name')
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id && pageType === 'product',
  });

  // Fetch categories for Category template
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['builder-example-categories', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('name')
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id && pageType === 'category',
  });

  // Fetch institutional and landing pages for the dropdown
  const { data: storePages } = useQuery({
    queryKey: ['builder-store-pages', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('store_pages')
        .select('id, title, slug, type, template_id')
        .eq('tenant_id', currentTenant.id)
        .in('type', ['institutional', 'landing_page'])
        .order('title');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  // Resolve the correct selector value for page_template or institutional type
  // When editing a page template or institutional page, we need to show the correct page
  const resolvedSelectorValue = (() => {
    // For page_template, find the page that uses this template ID
    if (pageType === 'page_template' && pageId && storePages) {
      const associatedPage = storePages.find(p => p.template_id === pageId);
      if (associatedPage) {
        return `page:${associatedPage.id}`;
      }
    }
    // For institutional pages (imported pages with own content), use the pageId directly
    if (pageType === 'institutional' && pageId && storePages) {
      const page = storePages.find(p => p.id === pageId);
      if (page) {
        return `page:${pageId}`;
      }
    }
    // For normal page types, use pageType directly
    return pageType;
  })();

  // Auto-select first product/category if none selected
  const effectiveProductId = exampleProductId || (products?.length ? products[0].id : undefined);
  const effectiveCategoryId = exampleCategoryId || (categories?.length ? categories[0].id : undefined);

  // Build preview URL based on page type and selected example with validation
  const getPreviewResult = () => {
    if (!tenantSlug) return { url: null, canPreview: false, reason: 'Tenant não definido' };
    
    // For product, use the selected example's slug if available
    if (pageType === 'product') {
      if (!effectiveProductId) {
        return { url: null, canPreview: false, reason: 'Selecione um produto de exemplo no painel direito' };
      }
      const product = products?.find(p => p.id === effectiveProductId);
      if (product?.slug) {
        return getPreviewUrlWithValidation(tenantSlug, pageType, product.slug);
      }
      return { url: null, canPreview: false, reason: 'Produto sem slug definido' };
    }
    
    if (pageType === 'category') {
      // Preview só funciona se tiver categoria real cadastrada
      if (!effectiveCategoryId) {
        return { url: null, canPreview: false, reason: 'Cadastre uma categoria para visualizar preview externo' };
      }
      const category = categories?.find(c => c.id === effectiveCategoryId);
      if (category?.slug) {
        return getPreviewUrlWithValidation(tenantSlug, pageType, category.slug);
      }
      return { url: null, canPreview: false, reason: 'Categoria sem slug definido' };
    }
    
    // For institutional/landing pages, use the pageSlug prop
    // page_template is treated as institutional for preview purposes
    if (pageType === 'institutional' || pageType === 'landing_page' || pageType === 'page_template') {
      return getPreviewUrlWithValidation(tenantSlug, 'institutional', pageSlug);
    }
    
    return getPreviewUrlWithValidation(tenantSlug, pageType);
  };

  const previewResult = getPreviewResult();

  // Preview: Opens store on APP origin with ?preview=1 to see DRAFT content
  // MUST use app origin (not public domain) so /store/{tenantSlug} routes work
  const handleOpenDraftPreview = () => {
    if (previewResult.url) {
      const appOrigin = window.location.origin;
      // previewResult.url already has the correct /store/{tenantSlug}/... path for app domain
      // and may already include ?preview=1 from getPreviewUrlWithValidation
      const hasPreviewParam = previewResult.url.includes('preview=1');
      const url = hasPreviewParam 
        ? `${appOrigin}${previewResult.url}` 
        : `${appOrigin}${previewResult.url}${previewResult.url.includes('?') ? '&' : '?'}preview=1`;
      window.open(url, '_blank');
    }
  };

  // View Store: Opens PUBLISHED store on PUBLIC domain (custom domain or platform subdomain)
  // Strips /store/{tenantSlug} prefix since public domain uses root-relative paths
  const handleOpenPublishedStore = () => {
    if (previewResult.url && primaryOrigin) {
      // Remove /store/{tenantSlug} prefix and ?preview=1 for clean published URL
      let publicPath = previewResult.url.replace(/^\/store\/[^/]+/, '');
      publicPath = publicPath.replace(/[?&]preview=1/, '').replace(/\?$/, '');
      const absoluteUrl = `${primaryOrigin}${publicPath || '/'}`;
      window.open(absoluteUrl, '_blank');
    }
  };

  const handlePageChange = (value: string) => {
    // Build the target URL first
    let targetUrl: string;
    if (value.startsWith('page:')) {
      const pageId = value.replace('page:', '');
      targetUrl = `/pages/${pageId}/builder`;
    } else {
      const templateParam = templateSetId ? `&templateId=${templateSetId}` : '';
      targetUrl = `/storefront/builder?edit=${value}${templateParam}`;
    }

    // Use the parent's check function if available (shows proper dialog)
    if (onPageChangeCheck) {
      const canProceed = onPageChangeCheck(targetUrl);
      if (!canProceed) {
        return; // Navigation blocked, dialog will be shown by parent
      }
    }
    
    // Navigate to the target
    navigate(targetUrl);
  };

  // Separate institutional and landing pages
  const institutionalPages = storePages?.filter(p => p.type === 'institutional') || [];
  const landingPages = storePages?.filter(p => p.type === 'landing_page') || [];

  return (
    <div className="h-11 flex items-center justify-between px-3 bg-background border-b shadow-sm">
      {/* Left: Breadcrumb & Page Selector */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 h-7 px-2 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
        
        <Separator orientation="vertical" className="h-5" />
        
        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
          <span>Builder</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
        
        {/* Page Selector */}
        <Select value={resolvedSelectorValue} onValueChange={handlePageChange}>
          <SelectTrigger className="w-[180px] h-7 text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            <SelectItem value="home">🏠 Página Inicial</SelectItem>
            <SelectItem value="category">📁 Categoria</SelectItem>
            <SelectItem value="product">📦 Produto</SelectItem>
            <SelectItem value="cart">🛒 Carrinho</SelectItem>
            <SelectItem value="checkout">💳 Checkout</SelectItem>
            <SelectItem value="thank_you">✅ Obrigado</SelectItem>
            <SelectItem value="account">👤 Minha Conta</SelectItem>
            <SelectItem value="account_orders">📋 Pedidos</SelectItem>
            <SelectItem value="account_order_detail">📄 Pedido</SelectItem>
            <SelectItem value="tracking">📍 Rastreio</SelectItem>
            <SelectItem value="blog">📰 Blog</SelectItem>
            
            {/* Páginas da Loja */}
            {(institutionalPages.length > 0 || landingPages.length > 0) && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                  Páginas da Loja
                </div>
                {institutionalPages.map((page) => (
                  <SelectItem key={page.id} value={`page:${page.id}`}>
                    📄 {page.title}
                  </SelectItem>
                ))}
                {landingPages.map((page) => (
                  <SelectItem key={page.id} value={`page:${page.id}`}>
                    📄 {page.title}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>

        {/* Category selector removed - category is auto-selected (first available or random) */}

        {/* Dirty indicator */}
        {isDirty && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
            Alterações não salvas
          </Badge>
        )}
      </div>

      {/* Center: Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
          className="h-7 w-7"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Refazer (Ctrl+Y)"
          className="h-7 w-7"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">

        {/* Preview button - opens store with DRAFT content (?preview=1) */}
        {tenantSlug && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenDraftPreview}
            disabled={!previewResult.canPreview}
            title={previewResult.canPreview 
              ? "Visualizar rascunho antes de publicar" 
              : previewResult.reason || "Não é possível visualizar"
            }
            className="gap-1 h-7 px-2 text-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
        )}

        {/* View Published Store - only shown when store is published */}
        {tenantSlug && isPublished && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPublishedStore}
            disabled={!previewResult.canPreview}
            title={previewResult.canPreview 
              ? "Abrir loja publicada" 
              : previewResult.reason || "Não é possível visualizar"
            }
            className="gap-1 h-7 px-2 text-xs"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ver loja</span>
          </Button>
        )}

        {/* Save */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="gap-1 h-7 px-2 text-xs"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isSaving ? 'Salvando...' : 'Salvar'}
          </span>
        </Button>

        {/* Publish with confirmation or payment gate */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              size="sm" 
              disabled={isPublishing} 
              className="gap-1 h-7 px-2 text-xs"
            >
              {isPublishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isPublishing ? 'Publicando...' : 'Publicar'}
              </span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            {needsPaymentMethod && isBasicPlan ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Cadastre seu cartão de crédito
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Para publicar sua loja no plano básico, você precisa cadastrar um cartão de crédito. 
                    Isso é necessário para cobranças da taxa de 2,5% sobre suas vendas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => navigate('/settings/add-payment-method')}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Cadastrar cartão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Publicar alterações?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso tornará as alterações visíveis para todos os visitantes da loja.
                    O conteúdo atual será substituído pelo novo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPublishing}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onPublish} disabled={isPublishing}>
                    {isPublishing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Publicando...
                      </>
                    ) : (
                      'Sim, publicar agora'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onViewHistory && (
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="h-4 w-4 mr-2" />
                Ver histórico
              </DropdownMenuItem>
            )}
            {onReset && (
              <>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restaurar padrão
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restaurar template padrão?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá sobrescrever toda a estrutura atual deste template, 
                        restaurando os blocos essenciais e a ordem padrão.
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onReset}>
                        Sim, restaurar padrão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
