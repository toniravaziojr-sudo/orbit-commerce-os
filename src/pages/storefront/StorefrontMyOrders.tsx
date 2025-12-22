// =============================================
// STOREFRONT MY ORDERS - DEPRECATED/AUTO-REDIRECT
// =============================================
// Esta página foi descontinuada. O fluxo principal é /conta (Minha Conta).
// Mantida APENAS para compatibilidade com links antigos.
// Redireciona automaticamente para /conta sem UI intermediária.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';

export default function StorefrontMyOrders() {
  const tenantSlug = useTenantSlug();
  const urls = useStorefrontUrls(tenantSlug);
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect imediato para /conta
    navigate(urls.account(), { replace: true });
  }, [navigate, urls]);

  // Spinner mínimo enquanto redireciona (evita flash branco)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
