// =============================================
// PAGE BUILDER - Edit institutional pages with visual builder
// =============================================

import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { usePageBuilder } from '@/hooks/usePageBuilder';
import { VisualBuilder } from '@/components/builder/VisualBuilder';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PageBuilder() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { settings: storeSettings } = useStoreSettings();
  const { page, draftVersion, isLoading } = usePageBuilder(pageId);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando editor...</p>
        </div>
      </div>
    );
  }

  if (!page || !currentTenant) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Página não encontrada</p>
          <Button onClick={() => navigate('/pages')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const context: BlockRenderContext = {
    tenantSlug: currentTenant.slug,
    isPreview: false,
    settings: {
      store_name: storeSettings?.store_name || currentTenant.name,
      logo_url: storeSettings?.logo_url || undefined,
      primary_color: storeSettings?.primary_color || undefined,
    },
  };

  return (
    <VisualBuilder
      tenantId={currentTenant.id}
      pageType="institutional"
      pageId={pageId}
      pageTitle={page.title}
      initialContent={draftVersion?.content}
      context={context}
    />
  );
}
