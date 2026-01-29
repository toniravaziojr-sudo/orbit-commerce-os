import { ReactNode, useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';
import { useWasInvitedUser } from '@/hooks/useWasInvitedUser';
import { Loader2 } from 'lucide-react';

// MÓDULO GLOBAL: Variável fora do componente React - NUNCA é resetada por remontagens
// Isso é mais robusto que sessionStorage porque:
// 1. Não precisa de IO (leitura de storage pode ser lenta)
// 2. Não pode ser corrompida por extensões de navegador
// 3. É imediatamente acessível na primeira renderização
let __globalInitialLoadComplete = typeof window !== 'undefined' 
  ? sessionStorage.getItem('auth_initial_load_complete') === 'true' 
  : false;

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
  // Usamos variável de módulo global + sessionStorage para máxima robustez
  // A variável global é lida ANTES de qualquer remontagem, garantindo que nunca perdemos o estado
  const [initialLoadComplete, setInitialLoadComplete] = useState(__globalInitialLoadComplete);

  // Check for pending invite token - if exists, don't redirect to create-store
  const hasPendingInvite = !!sessionStorage.getItem('pending_invite_token');

  // Marcar carga inicial como completa quando todos os loadings terminarem pela primeira vez
  // Persistir tanto na variável global quanto no sessionStorage
  useEffect(() => {
    if (!isLoading && !platformLoading && !inviteLoading && !__globalInitialLoadComplete) {
      __globalInitialLoadComplete = true;
      sessionStorage.setItem('auth_initial_load_complete', 'true');
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

  // REGRA CRÍTICA: Durante carregamento (mesmo após latch), NÃO redirecionar para /auth
  // Isso previne flash de auth screen durante remontagens causadas por Google Tradutor
  const isStillLoading = isLoading || platformLoading || inviteLoading;
  
  // Só mostra loader na PRIMEIRA carga - após isso, NUNCA bloqueia a tela
  // Isso é crítico para evitar tela cinza durante operações como OAuth popups
  if (isStillLoading && !initialLoadComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // CORREÇÃO: Se ainda está carregando (mesmo após latch), NÃO redirecionar para /auth
  // Apenas renderizar children e deixar o estado resolver - isso previne flash
  if (isStillLoading && initialLoadComplete) {
    // Após a primeira carga, assumir que o usuário está logado até prova em contrário
    // Se temos sessão no sessionStorage, não redirecionar durante reload
    return <>{children}</>;
  }

  // Se não está logado E não está carregando, redireciona para login
  if (!user && !isStillLoading) {
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

  // Still loading user roles - show spinner (ONLY on initial load)
  if (!hasWaitedForData && userRoles.length === 0 && !hasPendingInvite && !initialLoadComplete) {
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
  // ONLY show loader on initial load - never block UI after that
  if (requireTenant && !currentTenant && tenants.length > 0 && !initialLoadComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
