import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStorefrontTemplates } from '@/hooks/useBuilderData';
import { useTemplateSets } from '@/hooks/useTemplatesSets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Eye, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPreviewUrlForEditor, getPublicHomeUrl } from '@/lib/publicUrls';
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'tracking' | 'blog';

const pageTypeInfo: Record<PageType, { title: string; description: string; icon: string; isSystem?: boolean }> = {
  home: { title: 'Página Inicial', description: 'Página principal da loja', icon: '🏠' },
  category: { title: 'Categoria', description: 'Listagem de produtos', icon: '📁' },
  product: { title: 'Produto', description: 'Detalhes do produto', icon: '📦' },
  cart: { title: 'Carrinho', description: 'Carrinho de compras', icon: '🛒' },
  checkout: { title: 'Checkout', description: 'Página de sistema - configure em Integrações', icon: '💳', isSystem: true },
  thank_you: { title: 'Obrigado', description: 'Confirmação do pedido', icon: '✅' },
  account: { title: 'Minha Conta', description: 'Hub do cliente', icon: '👤' },
  account_orders: { title: 'Pedidos', description: 'Lista de pedidos', icon: '📋' },
  account_order_detail: { title: 'Pedido', description: 'Detalhe do pedido', icon: '📄' },
  tracking: { title: 'Rastreio', description: 'Página de rastreio de pedidos', icon: '📍', isSystem: true },
  blog: { title: 'Blog', description: 'Índice do blog', icon: '📰', isSystem: true },
};

export function StorefrontPagesTab() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);
  const { data: templates, isLoading: templatesLoading } = useStorefrontTemplates();
  const { publishedTemplateId } = useTemplateSets();

  const getPreviewUrl = (pageType: PageType) => {
    if (!currentTenant) return '#';
    return getPreviewUrlForEditor(currentTenant.slug, pageType);
  };

  const navigateToBuilder = (pageType: PageType) => {
    const templateParam = publishedTemplateId ? `&templateId=${publishedTemplateId}` : '';
    navigate(`/storefront/builder?edit=${pageType}${templateParam}`);
  };

  if (templatesLoading) {
    return (
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
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* E-commerce Pages */}
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
                        onClick={() => navigateToBuilder(pageType)}
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
                            onClick={() => {
                              if (primaryOrigin) {
                                const previewPath = getPreviewUrl(pageType);
                                const absoluteUrl = buildPublicStorefrontUrl(primaryOrigin, previewPath);
                                window.open(absoluteUrl, '_blank');
                              }
                            }}
                            disabled={!primaryOrigin}
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
                              onClick={() => window.open(getPublicHomeUrl(currentTenant?.slug || ''), '_blank')}
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
      </div>
    </TooltipProvider>
  );
}