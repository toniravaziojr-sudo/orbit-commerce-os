// =============================================
// STOREFRONT PAGE - Public institutional page via Builder
// =============================================

import { useParams, useSearchParams, Link } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicPageTemplate } from '@/hooks/usePublicTemplate';
import { usePreviewPageTemplate } from '@/hooks/usePreviewTemplate';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { BlockRenderContext } from '@/lib/builder/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Home, FileX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StorefrontPage() {
  const { tenantSlug, pageSlug } = useParams<{ tenantSlug: string; pageSlug: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';

  const { storeSettings, headerMenu, footerMenu, isPublished, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  
  // Use preview hook if in preview mode, otherwise use public hook
  const publicPage = usePublicPageTemplate(tenantSlug || '', pageSlug || '');
  const previewPage = usePreviewPageTemplate(tenantSlug || '', pageSlug || '');
  
  const pageData = isPreviewMode ? previewPage : publicPage;

  // Loading state
  if (pageData.isLoading || storeLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-16 w-full" />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  // Store not published (and not in preview mode)
  if (!isPreviewMode && !isPublished) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <FileX className="h-4 w-4" />
          <AlertTitle>Loja não disponível</AlertTitle>
          <AlertDescription>
            Esta loja não está publicada no momento.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check preview access
  const canPreview = isPreviewMode 
    ? ('canPreview' in pageData ? Boolean(pageData.canPreview) : true) 
    : true;

  // Page not found
  if (!pageData.content && !pageData.isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <FileX className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-4">Página não encontrada</h1>
        <p className="text-muted-foreground mb-6">
          A página que você procura não existe ou não está publicada.
        </p>
        <Link 
          to={`/store/${tenantSlug}`}
          className="inline-flex items-center text-primary hover:underline"
        >
          <Home className="h-4 w-4 mr-2" />
          Voltar para a loja
        </Link>
      </div>
    );
  }

  // Build context for block rendering
  const context: BlockRenderContext = {
    tenantSlug: tenantSlug || '',
    isPreview: isPreviewMode,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      primary_color: storeSettings?.primary_color || undefined,
      social_instagram: storeSettings?.social_instagram || undefined,
      social_facebook: storeSettings?.social_facebook || undefined,
      social_whatsapp: storeSettings?.social_whatsapp || undefined,
      store_description: storeSettings?.store_description || undefined,
    },
    headerMenu: headerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
    footerMenu: footerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
    // Page-specific context
    page: {
      title: pageData.pageTitle || '',
      slug: pageSlug || '',
    },
  };

  return (
    <PublicTemplateRenderer
      content={pageData.content!}
      context={context}
      isLoading={false}
      error={pageData.error}
      isPreviewMode={isPreviewMode}
      canPreview={canPreview}
    />
  );
}
