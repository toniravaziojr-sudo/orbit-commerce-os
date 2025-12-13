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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Eye, CheckCircle2, Clock, ExternalLink, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout';

const pageTypeInfo: Record<PageType, { title: string; description: string; icon: string }> = {
  home: { title: 'Página Inicial', description: 'Página principal da loja', icon: '🏠' },
  category: { title: 'Categoria', description: 'Listagem de produtos', icon: '📁' },
  product: { title: 'Produto', description: 'Detalhes do produto', icon: '📦' },
  cart: { title: 'Carrinho', description: 'Carrinho de compras', icon: '🛒' },
  checkout: { title: 'Checkout', description: 'Finalização', icon: '💳' },
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
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
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

  const getPreviewUrl = (pageType: PageType) => {
    if (!currentTenant) return '#';
    const base = `/store/${currentTenant.slug}`;
    switch (pageType) {
      case 'home': return `${base}?preview=1`;
      case 'category': return `${base}/c/exemplo?preview=1`;
      case 'product': return `${base}/p/exemplo?preview=1`;
      case 'cart': return `${base}/cart?preview=1`;
      case 'checkout': return `${base}/checkout?preview=1`;
      default: return `${base}?preview=1`;
    }
  };

  // Otherwise, show the template list
  return (
    <TooltipProvider>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Construtor de Páginas</h1>
            <p className="text-muted-foreground">
              Personalize as páginas da sua loja
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                Ajuda
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-sm">
                Clique em "Editar" para personalizar cada página. 
                Use o preview para visualizar e depois publique.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {templatesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-32 mt-1" />
                </CardHeader>
                <CardContent className="pt-0">
                  <Skeleton className="h-9 w-full" />
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
              const lastUpdated = template?.updated_at;

              return (
                <Card 
                  key={pageType} 
                  className="group hover:shadow-md transition-all hover:border-primary/30"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{info.icon}</span>
                        <div>
                          <CardTitle className="text-base">{info.title}</CardTitle>
                          <CardDescription className="text-xs">
                            {info.description}
                          </CardDescription>
                        </div>
                      </div>
                      {hasPublished ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Publicado
                        </Badge>
                      ) : hasDraft ? (
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          Rascunho
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Não editado
                        </Badge>
                      )}
                    </div>
                    {lastUpdated && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Atualizado {format(new Date(lastUpdated), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => navigate(`/admin/storefront/builder?edit=${pageType}`)}
                        className="flex-1"
                        size="sm"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getPreviewUrl(pageType), '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Prévia</TooltipContent>
                      </Tooltip>
                      {hasPublished && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/store/${currentTenant?.slug}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver publicado</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
