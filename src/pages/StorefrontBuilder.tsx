// =============================================
// STOREFRONT BUILDER PAGE - Admin page for builder
// =============================================

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useStorefrontTemplates, useTemplateVersion } from '@/hooks/useBuilderData';
import { VisualBuilder } from '@/components/builder/VisualBuilder';
import { BlockRenderContext } from '@/lib/builder/types';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Eye, CheckCircle2 } from 'lucide-react';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout';

const pageTypeInfo: Record<PageType, { title: string; description: string; icon: string }> = {
  home: { title: 'Página Inicial', description: 'Página principal da loja', icon: '🏠' },
  category: { title: 'Página de Categoria', description: 'Template para listagem de produtos por categoria', icon: '📁' },
  product: { title: 'Página de Produto', description: 'Template para detalhes do produto', icon: '📦' },
  cart: { title: 'Carrinho', description: 'Página do carrinho de compras', icon: '🛒' },
  checkout: { title: 'Checkout', description: 'Página de finalização da compra', icon: '💳' },
};

export default function StorefrontBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { settings: storeSettings } = useStoreSettings();
  
  const editingPageType = searchParams.get('edit') as PageType | null;
  
  const { data: templates, isLoading: templatesLoading } = useStorefrontTemplates();
  const { data: templateData, isLoading: templateLoading } = useTemplateVersion(
    editingPageType || 'home', 
    'draft'
  );

  // If editing a specific page type, show the builder
  if (editingPageType && currentTenant) {
    const context: BlockRenderContext = {
      tenantSlug: currentTenant.slug,
      isPreview: false,
      settings: {
        store_name: storeSettings?.store_name || currentTenant.name,
        logo_url: storeSettings?.logo_url || undefined,
        primary_color: storeSettings?.primary_color || undefined,
      },
    };

    if (templateLoading) {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <Skeleton className="h-8 w-48 mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando editor...</p>
          </div>
        </div>
      );
    }

    return (
      <VisualBuilder
        tenantId={currentTenant.id}
        pageType={editingPageType}
        initialContent={templateData?.content}
        context={context}
      />
    );
  }

  // Otherwise, show the template list
  return (
    <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Construtor de Páginas</h1>
          <p className="text-muted-foreground">
            Personalize as páginas da sua loja com o editor visual
          </p>
        </div>

        {templatesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(pageTypeInfo) as PageType[]).map((pageType) => {
              const info = pageTypeInfo[pageType];
              const template = templates?.find(t => t.page_type === pageType);
              const hasPublished = !!template?.published_version;
              const hasDraft = !!template?.draft_version;

              return (
                <Card key={pageType} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{info.icon}</span>
                        <CardTitle className="text-lg">{info.title}</CardTitle>
                      </div>
                      <div className="flex gap-1">
                        {hasPublished && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Publicado
                          </Badge>
                        )}
                        {hasDraft && !hasPublished && (
                          <Badge variant="secondary" className="text-xs">
                            Rascunho
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>{info.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => navigate(`/admin/storefront/builder?edit=${pageType}`)}
                        className="flex-1"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      {hasPublished && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(`/store/${currentTenant?.slug}`, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info section */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Clique em "Editar" para abrir o editor visual de cada página</p>
            <p>• Adicione, remova e reorganize blocos para personalizar o layout</p>
            <p>• Use o modo "Preview" para visualizar como ficará para os clientes</p>
            <p>• Salve como rascunho para continuar depois ou publique para ir ao ar</p>
          </CardContent>
        </Card>
      </div>
  );
}
