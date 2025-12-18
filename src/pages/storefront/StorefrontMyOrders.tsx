// =============================================
// STOREFRONT MY ORDERS - DEPRECATED/AUTO-REDIRECT
// =============================================
// Esta página foi descontinuada. O fluxo principal é /conta (Minha Conta).
// Mantida APENAS para compatibilidade com links antigos.
// Redireciona automaticamente para /conta sem UI intermediária.

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function StorefrontMyOrders() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect imediato para /conta
    if (tenantSlug) {
      navigate(`/store/${tenantSlug}/conta`, { replace: true });
    }
  }, [tenantSlug, navigate]);

  // Spinner mínimo enquanto redireciona (evita flash branco)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
