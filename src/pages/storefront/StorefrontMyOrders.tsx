// =============================================
// STOREFRONT MY ORDERS - Public order lookup page
// =============================================

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Package, Search, ShoppingBag } from 'lucide-react';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';

export default function StorefrontMyOrders() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  
  // Get home template to extract global header/footer
  const homeTemplate = usePublicTemplate(tenantSlug || '', 'home');
  
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<'not_found' | 'coming_soon' | null>(null);

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

  // Extract Header and Footer from home template (global layout)
  const homeContent = homeTemplate.content as BlockNode | null;
  const headerNode = homeContent?.children?.find(child => child.type === 'Header');
  const footerNode = homeContent?.children?.find(child => child.type === 'Footer');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !orderNumber.trim()) return;
    
    setIsSearching(true);
    setSearchResult(null);
    
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For now, always show "coming soon" message
    setSearchResult('coming_soon');
    setIsSearching(false);
  };

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
        <BlockRenderer
          node={headerNode}
          context={context}
          isEditing={false}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Minhas compras</h1>
            <p className="text-muted-foreground">
              Consulte o status do seu pedido
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Buscar pedido
              </CardTitle>
              <CardDescription>
                Informe seu e-mail e número do pedido para consultar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">Número do pedido</Label>
                  <Input
                    id="orderNumber"
                    type="text"
                    placeholder="Ex: PED-25-000001"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSearching || !email.trim() || !orderNumber.trim()}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Buscar
                    </>
                  )}
                </Button>
              </form>

              {/* Search Result */}
              {searchResult === 'coming_soon' && (
                <Alert className="mt-6 border-amber-200 bg-amber-50">
                  <Package className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>Funcionalidade em implementação.</strong>
                    <br />
                    Em breve você poderá consultar seus pedidos diretamente aqui.
                    Entre em contato conosco para mais informações sobre seu pedido.
                  </AlertDescription>
                </Alert>
              )}

              {searchResult === 'not_found' && (
                <Alert className="mt-6 border-destructive/50 bg-destructive/10">
                  <AlertDescription className="text-destructive">
                    Pedido não encontrado. Verifique os dados informados e tente novamente.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Global Footer */}
      {footerNode && (
        <BlockRenderer
          node={footerNode}
          context={context}
          isEditing={false}
        />
      )}
    </div>
  );
}
