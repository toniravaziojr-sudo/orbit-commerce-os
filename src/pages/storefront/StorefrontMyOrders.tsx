// =============================================
// STOREFRONT MY ORDERS - DEPRECATED/REDIRECT
// =============================================
// Esta página foi descontinuada. O fluxo principal é /conta (Minha Conta).
// Mantida para compatibilidade com links antigos - redireciona para /conta.

import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, User, ArrowRight, Info } from 'lucide-react';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';

export default function StorefrontMyOrders() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const homeTemplate = usePublicTemplate(tenantSlug || '', 'home');

  // Build context for block rendering
  const context: BlockRenderContext = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      primary_color: storeSettings?.primary_color || undefined,
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

  // Extract Header and Footer from home template
  const homeContent = homeTemplate.content as BlockNode | null;
  const headerNode = homeContent?.children?.find(child => child.type === 'Header');
  const footerNode = homeContent?.children?.find(child => child.type === 'Footer');

  if (storeLoading || homeTemplate.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Global Header */}
      {headerNode && (
        <BlockRenderer node={headerNode} context={context} isEditing={false} />
      )}

      {/* Main Content - Redirect notice */}
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-lg">
          <Card className="text-center">
            <CardHeader>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Página atualizada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="text-left">
                <Info className="h-4 w-4" />
                <AlertTitle>Novidade!</AlertTitle>
                <AlertDescription>
                  Agora seus pedidos ficam na <strong>Minha Conta</strong>. 
                  Acesse para ver seus pedidos, acompanhar entregas e gerenciar suas informações.
                </AlertDescription>
              </Alert>
              
              <Link to={`/store/${tenantSlug}/conta`}>
                <Button className="w-full h-12" size="lg">
                  Ir para Minha Conta
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              
              <p className="text-xs text-muted-foreground">
                A consulta por e-mail + número do pedido foi substituída pelo acesso à sua conta.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Global Footer */}
      {footerNode && (
        <BlockRenderer node={footerNode} context={context} isEditing={false} />
      )}
    </div>
  );
}
