import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireTenant?: boolean;
}

export function ProtectedRoute({ children, requireTenant = true }: ProtectedRouteProps) {
  const { user, currentTenant, tenants, isLoading } = useAuth();
  const { isPlatformOperator, isLoading: platformLoading } = usePlatformOperator();
  const location = useLocation();

  if (isLoading || platformLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não está logado, redireciona para login
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Platform Admin NÃO precisa de tenant - permite acesso direto
  if (isPlatformOperator) {
    return <>{children}</>;
  }

  // Se precisa de tenant e não tem nenhum, redireciona para criar loja
  if (requireTenant && tenants.length === 0) {
    return <Navigate to="/create-store" replace />;
  }

  // Se precisa de tenant e não tem um selecionado (mas tem lojas), deixa a seleção acontecer
  if (requireTenant && !currentTenant && tenants.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
