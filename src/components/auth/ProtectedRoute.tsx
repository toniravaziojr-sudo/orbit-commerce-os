import { ReactNode, useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';
import { useWasInvitedUser } from '@/hooks/useWasInvitedUser';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireTenant?: boolean;
}

export function ProtectedRoute({ children, requireTenant = true }: ProtectedRouteProps) {
  const { user, currentTenant, tenants, userRoles, isLoading } = useAuth();
  const { isPlatformOperator, isLoading: platformLoading } = usePlatformOperator();
  const { wasInvited, isLoading: inviteLoading } = useWasInvitedUser(user?.email);
  const location = useLocation();
  
  // Track if we've waited enough for data to load
  const [hasWaitedForData, setHasWaitedForData] = useState(false);
  
  // REGRA CRÍTICA: Após a primeira carga, NUNCA mais bloquear a UI com loader de tela cheia
  // Isso evita que refetches de queries (ex: ao abrir popup OAuth) causem tela cinza
  const initialLoadCompleteRef = useRef(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Check for pending invite token - if exists, don't redirect to create-store
  const hasPendingInvite = !!sessionStorage.getItem('pending_invite_token');

  // Marcar carga inicial como completa quando todos os loadings terminarem pela primeira vez
  useEffect(() => {
    if (!isLoading && !platformLoading && !inviteLoading && !initialLoadCompleteRef.current) {
      initialLoadCompleteRef.current = true;
      setInitialLoadComplete(true);
    }
  }, [isLoading, platformLoading, inviteLoading]);

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

  // Só mostra loader na PRIMEIRA carga - após isso, NUNCA bloqueia a tela
  // Isso é crítico para evitar tela cinza durante operações como OAuth popups
  if ((isLoading || platformLoading || inviteLoading) && !initialLoadComplete) {
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

  // CRITICAL: Se o usuário foi convidado anteriormente (accepted_at) mas não tem mais tenant,
  // ele foi REMOVIDO e NÃO pode criar loja própria. Redirecionar para /no-access.
  if (requireTenant && tenants.length === 0 && wasInvited && hasWaitedForData && !hasPendingInvite) {
    console.log('[ProtectedRoute] User was previously invited but has no tenants - redirecting to /no-access');
    return <Navigate to="/no-access" replace />;
  }

  // Se precisa de tenant e não tem nenhum, redireciona para seleção de plano (/start)
  // Isso garante que TODOS os novos usuários passem pelo fluxo de billing
  // MAS só se não houver convite pendente E já esperamos o suficiente E não foi convidado antes
  if (requireTenant && tenants.length === 0 && !hasPendingInvite && hasWaitedForData && !wasInvited) {
    console.log('[ProtectedRoute] User has no tenants - redirecting to /start for plan selection');
    return <Navigate to="/start" replace />;
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
