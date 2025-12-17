// =============================================
// STOREFRONT ACCOUNT HUB - Customer account main page
// =============================================

import { Link, useParams, useSearchParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Package, MessageCircle, User, ShoppingBag, Info } from 'lucide-react';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { getWhatsAppHref } from '@/lib/contactHelpers';

export default function StorefrontAccount() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const { storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const homeTemplate = usePublicTemplate(tenantSlug || '', 'home');

  const isDemoMode = searchParams.has('demoAccount');

  // Build context for block rendering
  const context: BlockRenderContext = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
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
  };

  const homeContent = homeTemplate.content as BlockNode | null;
  const headerNode = homeContent?.children?.find(child => child.type === 'Header');
  const footerNode = homeContent?.children?.find(child => child.type === 'Footer');

  // WhatsApp support link
  const whatsappNumber = storeSettings?.social_whatsapp || '+5511919555920';
  const whatsappMessage = `Olá! Preciso de suporte.`;
  const whatsappHref = getWhatsAppHref(whatsappNumber, whatsappMessage);

  if (storeLoading || homeTemplate.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      {headerNode && (
        <BlockRenderer node={headerNode} context={context} isEditing={false} />
      )}

      {/* Main Content */}
      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Minha Conta</h1>
            <p className="text-muted-foreground">
              Gerencie seus pedidos e informações
            </p>
          </div>

          {/* Demo mode notice */}
          {isDemoMode && (
            <Alert className="mb-6 border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Modo demonstração ativo.</strong> Você está visualizando dados de exemplo.
              </AlertDescription>
            </Alert>
          )}

          {/* Auth notice when not in demo mode */}
          {!isDemoMode && (
            <Alert className="mb-6 border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Acesso limitado.</strong> Para ver seus pedidos reais, entre em contato conosco.
                <br />
                <span className="text-sm">
                  Para testar a interface, adicione <code className="bg-amber-100 px-1 rounded">?demoAccount=1</code> à URL.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Navigation Cards */}
          <div className="grid gap-4">
            {/* Meus Pedidos */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Meus Pedidos</CardTitle>
                    <CardDescription>Acompanhe seus pedidos e entregas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link 
                  to={`/store/${tenantSlug}/conta/pedidos${isDemoMode ? '?demoAccount=1' : ''}`}
                >
                  <Button className="w-full">
                    Ver pedidos
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Suporte */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Suporte</CardTitle>
                    <CardDescription>Tire suas dúvidas pelo WhatsApp</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Falar no WhatsApp
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Back to store */}
          <div className="mt-8 text-center">
            <Link to={`/store/${tenantSlug}`}>
              <Button variant="ghost">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Voltar à loja
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      {footerNode && (
        <BlockRenderer node={footerNode} context={context} isEditing={false} />
      )}
    </div>
  );
}
