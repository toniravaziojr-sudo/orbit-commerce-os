// =============================================
// PUBLIC TEMPLATE RENDERER - Renders published builder content
// =============================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockNode, BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Eye, Lock, AlertTriangle } from 'lucide-react';
import { applyGlobalLayout, usePublicGlobalLayout } from '@/hooks/useGlobalLayoutIntegration';
import { supabase } from '@/integrations/supabase/client';
import { PageOverrides } from '@/hooks/usePageOverrides';

interface PublicTemplateRendererProps {
  content: BlockNode;
  context: BlockRenderContext;
  isLoading?: boolean;
  error?: Error | null;
  isPreviewMode?: boolean;
  canPreview?: boolean;
  isCheckout?: boolean;
  // For page overrides
  pageType?: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'institutional' | 'landing_page';
  pageId?: string; // For institutional/landing_page
}

export function PublicTemplateRenderer({
  content,
  context,
  isLoading = false,
  error,
  isPreviewMode = false,
  canPreview = true,
  isCheckout = false,
  pageType = 'home',
  pageId,
}: PublicTemplateRendererProps) {
  // Fetch global layout
  const { data: globalLayout, isLoading: layoutLoading } = usePublicGlobalLayout(context.tenantSlug);

  // Fetch page overrides
  const isTemplate = !['institutional', 'landing_page'].includes(pageType);
  const { data: pageOverrides, isLoading: overridesLoading } = useQuery({
    queryKey: ['public-page-overrides', context.tenantSlug, pageType, pageId],
    queryFn: async () => {
      // Get tenant ID from slug
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', context.tenantSlug)
        .single();

      if (!tenant) return null;

      if (isTemplate) {
        // Fetch from storefront_page_templates
        const { data } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenant.id)
          .eq('page_type', pageType)
          .maybeSingle();

        return (data?.page_overrides as PageOverrides) || null;
      } else {
        // Fetch from store_pages
        if (!pageId) return null;
        const { data } = await supabase
          .from('store_pages')
          .select('page_overrides')
          .eq('id', pageId)
          .maybeSingle();

        return (data?.page_overrides as PageOverrides) || null;
      }
    },
    enabled: !!context.tenantSlug && pageType !== 'home' && pageType !== 'checkout',
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Apply global layout to content with page overrides
  const finalContent = useMemo(() => {
    if (!content || !globalLayout) return content;
    return applyGlobalLayout(content, globalLayout, isCheckout, pageOverrides);
  }, [content, globalLayout, isCheckout, pageOverrides]);

  // Show access denied for preview without auth
  if (isPreviewMode && !canPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <Lock className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Você precisa estar autenticado e ser membro desta loja para visualizar o preview.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show error state
  if (error && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>
            {error.message || 'Não foi possível carregar o conteúdo desta página.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading state
  if (isLoading || layoutLoading || overridesLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-16 w-full mb-0" />
        <Skeleton className="h-96 w-full" />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
          <Eye className="h-4 w-4" />
          Modo Preview - Esta é uma visualização do rascunho. As alterações não estão publicadas.
        </div>
      )}
      
      <BlockRenderer
        node={finalContent}
        context={context}
        isEditing={false}
      />
    </>
  );
}

// Empty state for templates that need sample data
export function TemplateEmptyState({ 
  type,
  tenantSlug,
}: { 
  type: 'product' | 'category';
  tenantSlug: string;
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Alert className="max-w-md">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>
          {type === 'product' ? 'Produto não encontrado' : 'Categoria não encontrada'}
        </AlertTitle>
        <AlertDescription>
          {type === 'product' 
            ? 'Este produto não existe ou não está disponível.'
            : 'Esta categoria não existe ou não está ativa.'}
        </AlertDescription>
      </Alert>
    </div>
  );
}
