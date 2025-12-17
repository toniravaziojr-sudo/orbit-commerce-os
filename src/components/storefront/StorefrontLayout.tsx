import { Outlet, useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { Loader2 } from 'lucide-react';
import { CartProvider } from '@/contexts/CartContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';

export function StorefrontLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, storeSettings, isLoading, isPublished } = usePublicStorefront(tenantSlug || '');

  // Check for preview mode
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';

  // CartProvider wraps EVERYTHING to persist state across navigation and loading states
  return (
    <CartProvider tenantSlug={tenantSlug || ''}>
      <StorefrontLayoutContent
        tenant={tenant}
        isLoading={isLoading}
        isPublished={isPublished}
        isPreview={isPreview}
      />
    </CartProvider>
  );
}

// Inner component to handle loading/error states while keeping CartProvider always mounted
function StorefrontLayoutContent({
  tenant,
  isLoading,
  isPublished,
  isPreview,
}: {
  tenant: any;
  isLoading: boolean;
  isPublished: boolean;
  isPreview: boolean;
}) {
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loja não encontrada</h1>
          <p className="text-gray-600">Verifique se o endereço está correto.</p>
        </div>
      </div>
    );
  }

  if (!isPublished && !isPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loja em construção</h1>
          <p className="text-gray-600">Esta loja ainda não está disponível para o público.</p>
        </div>
      </div>
    );
  }

  return (
    <StorefrontConfigProvider tenantId={tenant.id}>
      <div className="min-h-screen flex flex-col bg-white">
        {isPreview && (
          <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
            Modo de pré-visualização - Esta página não está publicada
          </div>
        )}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </StorefrontConfigProvider>
  );
}
