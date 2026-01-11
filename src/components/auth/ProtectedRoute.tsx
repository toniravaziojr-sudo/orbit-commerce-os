import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireTenant?: boolean;
}

export function ProtectedRoute({ children, requireTenant = true }: ProtectedRouteProps) {
  const { user, currentTenant, tenants, userRoles, isLoading } = useAuth();
  const { isPlatformOperator, isLoading: platformLoading } = usePlatformOperator();
  const location = useLocation();
  
  // Track if we've waited enough for data to load
  const [hasWaitedForData, setHasWaitedForData] = useState(false);

  // Check for pending invite token - if exists, don't redirect to create-store
  const hasPendingInvite = !!sessionStorage.getItem('pending_invite_token');

  // Give some time for user roles to load after auth is ready
  useEffect(() => {
    if (!isLoading && user && userRoles.length === 0 && !hasPendingInvite) {
      // Wait a bit for roles to load before deciding to redirect
      const timer = setTimeout(() => {
        setHasWaitedForData(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setHasWaitedForData(true);
    }
  }, [isLoading, user, userRoles.length, hasPendingInvite]);

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

  // Se há convite pendente, redireciona para accept-invite (não para create-store)
  if (hasPendingInvite && location.pathname !== '/accept-invite') {
    return <Navigate to="/accept-invite" replace />;
  }

  // Still loading user roles - show spinner
  if (!hasWaitedForData && userRoles.length === 0 && !hasPendingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se precisa de tenant e não tem nenhum, redireciona para criar loja
  // MAS só se não houver convite pendente E já esperamos o suficiente
  if (requireTenant && tenants.length === 0 && !hasPendingInvite && hasWaitedForData) {
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
