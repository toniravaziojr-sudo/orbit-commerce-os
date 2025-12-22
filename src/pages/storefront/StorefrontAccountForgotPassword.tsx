// =============================================
// STOREFRONT FORGOT PASSWORD - Password recovery page
// =============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, ArrowLeft, Check } from 'lucide-react';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { supabase } from '@/integrations/supabase/client';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';
import { useCanonicalDomain } from '@/contexts/StorefrontConfigContext';
import { getCanonicalOrigin } from '@/lib/canonicalUrls';

export default function StorefrontAccountForgotPassword() {
  const tenantSlug = useTenantSlug();
  const urls = useStorefrontUrls(tenantSlug);
  const { storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const homeTemplate = usePublicTemplate(tenantSlug || '', 'home');
  
  // Get canonical domain for auth redirects
  const canonicalDomainContext = useCanonicalDomain();
  const customDomain = canonicalDomainContext?.customDomain || null;
  const canonicalOrigin = getCanonicalOrigin(customDomain, tenantSlug || '');

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Build context
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

  const homeContent = homeTemplate.content as BlockNode | null;
  const headerNode = homeContent?.children?.find(child => child.type === 'Header');
  const footerNode = homeContent?.children?.find(child => child.type === 'Footer');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Use canonical origin (custom domain or platform subdomain) with clean URL
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${canonicalOrigin}/conta/redefinir-senha`,
      });

      if (resetError) {
        setError('Erro ao enviar email. Verifique o endereço e tente novamente.');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
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
      {/* Header */}
      {headerNode && (
        <BlockRenderer node={headerNode} context={context} isEditing={false} />
      )}

      {/* Main Content */}
      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-md">
          {/* Back link */}
          <Link 
            to={`${urls.account()}/login`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar ao login
          </Link>

          <Card>
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-2">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Esqueceu sua senha?</CardTitle>
              <CardDescription>
                Informe seu email para receber as instruções de recuperação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Email enviado!</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Enviamos um link para <strong>{email}</strong>. 
                      Verifique sua caixa de entrada e spam.
                    </p>
                  </div>
                  <Link to={`${urls.account()}/login`}>
                    <Button variant="outline" className="w-full">
                      Voltar ao login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar link de recuperação'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      {footerNode && (
        <BlockRenderer node={footerNode} context={context} isEditing={false} />
      )}
    </div>
  );
}
