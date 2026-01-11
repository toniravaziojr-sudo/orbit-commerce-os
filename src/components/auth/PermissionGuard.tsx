import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionGuardProps {
  children: ReactNode;
}

export function PermissionGuard({ children }: PermissionGuardProps) {
  const location = useLocation();
  const { canAccessRoute, isOwner, isPlatformOperator } = usePermissions();
  const { isLoading, user, currentTenant } = useAuth();

  // Wait for auth to load
  if (isLoading) {
    return null;
  }

  // If not logged in, redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If no tenant, allow (tenant selection page, etc.)
  if (!currentTenant) {
    return <>{children}</>;
  }

  // Check if route is allowed
  const hasAccess = canAccessRoute(location.pathname);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Acesso Restrito
            </h1>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página.
              Entre em contato com o proprietário da conta para solicitar acesso.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
          >
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
