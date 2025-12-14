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

  // Otherwise, show the template list (management view)
  return (
    <TooltipProvider>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gerenciador de Páginas</h1>
            <p className="text-muted-foreground">
              Gerencie e personalize as páginas da sua loja
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/storefront/builder?edit=home')}>
              <Pencil className="h-4 w-4 mr-2" />
              Abrir Editor
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-sm">
                  Clique em "Abrir Editor" para editar páginas. 
                  Use esta tela para gerenciar status e ver detalhes.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {templatesLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <span className="text-xl">🛒</span>
                </div>
                <div>
                  <CardTitle className="text-lg">E-commerce (Páginas Padrão)</CardTitle>
                  <CardDescription>
                    Templates fixos do e-commerce — não podem ser excluídos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-border rounded-lg border">
                {(Object.keys(pageTypeInfo) as PageType[]).map((pageType) => {
                  const info = pageTypeInfo[pageType];
                  const template = templates?.find(t => t.page_type === pageType);
                  const hasPublished = !!template?.published_version;
                  const hasDraft = !!template?.draft_version;
                  const lastUpdated = template?.updated_at;

                  return (
                    <div 
                      key={pageType} 
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{info.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{info.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {info.description}
                            {lastUpdated && (
                              <span className="ml-2">
                                · {format(new Date(lastUpdated), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {hasPublished ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1 text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            Publicado
                          </Badge>
                        ) : hasDraft ? (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            Rascunho
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Não editado
                          </Badge>
                        )}
                        <div className="flex gap-1">
                          <Button
                            onClick={() => navigate(`/storefront/builder?edit=${pageType}`)}
                            variant="ghost"
                            size="sm"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
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
                                  variant="ghost"
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
