// =============================================
// STOREFRONT CHECKOUT - Public checkout page
// =============================================
// SISTEMA: Esta página renderiza o CheckoutStepWizard diretamente.
// O checkout é uma página de sistema (não editável por blocos).
// A configuração de layout pode ser feita via Admin > Integrações.

import { useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader';
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter';
import { CheckoutStepWizard } from '@/components/storefront/checkout/CheckoutStepWizard';
import { Loader2 } from 'lucide-react';

export default function StorefrontCheckout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const { tenant, storeSettings, headerMenu, footerMenu, isLoading } = usePublicStorefront(tenantSlug || '');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loja não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Simplified header for checkout */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          {storeSettings?.logo_url ? (
            <img 
              src={storeSettings.logo_url} 
              alt={storeSettings.store_name || 'Logo'} 
              className="h-10 object-contain"
            />
          ) : (
            <span className="text-xl font-bold text-foreground">
              {storeSettings?.store_name || tenant?.name}
            </span>
          )}
        </div>
        {/* Simple menu for checkout */}
        {headerMenu?.items && headerMenu.items.length > 0 && (
          <nav className="border-t">
            <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-6">
              {headerMenu.items.slice(0, 3).map((item) => (
                <a 
                  key={item.id} 
                  href={item.url || '#'}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main checkout content */}
      <main className="flex-1 bg-muted/30">
        <CheckoutStepWizard tenantId={tenant.id} />
      </main>

      {/* Simplified footer for checkout */}
      <footer className="border-t bg-background py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            {storeSettings?.business_legal_name || storeSettings?.store_name || tenant?.name}
            {storeSettings?.business_cnpj && ` - CNPJ: ${storeSettings.business_cnpj}`}
          </p>
          <p className="mt-1">Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
