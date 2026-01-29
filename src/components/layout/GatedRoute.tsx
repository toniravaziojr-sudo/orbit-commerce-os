import { ReactNode } from 'react';
import { ModuleGate } from './ModuleGate';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Sparkles, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GatedRouteProps {
  children: ReactNode;
  moduleKey: string;
  moduleName: string;
  moduleDescription?: string;
}

/**
 * Wrapper component for routes that require module access.
 * Allows viewing in preview mode with upgrade banner.
 */
export function GatedRoute({ 
  children, 
  moduleKey, 
  moduleName,
  moduleDescription 
}: GatedRouteProps) {
  return (
    <ModuleGate
      moduleKey={moduleKey}
      blockedMode="preview"
      moduleName={moduleName}
      moduleDescription={moduleDescription}
    >
      {children}
    </ModuleGate>
  );
}

interface FeatureGatedRouteProps {
  children: ReactNode;
  moduleKey: string;
  featureKey: string;
  featureName: string;
  featureDescription?: string;
}

/**
 * Wrapper component for routes that require feature access within a module.
 * Use for partial access scenarios where the module is accessible but 
 * specific features are blocked.
 * 
 * Example: Blog module is accessible (partial) but ai_campaigns feature is blocked.
 */
export function FeatureGatedRoute({ 
  children, 
  moduleKey,
  featureKey,
  featureName,
  featureDescription 
}: FeatureGatedRouteProps) {
  const navigate = useNavigate();
  const { hasAccess, accessLevel, blockedFeatures, planKey, isLoading } = useModuleAccess(moduleKey);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if this specific feature is blocked
  const isFeatureBlocked = blockedFeatures?.includes(featureKey) || 
                           blockedFeatures?.includes('*') ||
                           accessLevel === 'none';

  // Feature is accessible - render normally
  if (!isFeatureBlocked) {
    return <>{children}</>;
  }

  // Feature is blocked - render preview mode with overlay
  return (
    <div className="relative">
      {/* Banner de upgrade no topo */}
      <Alert className="mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <Lock className="h-4 w-4 text-amber-600" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm text-amber-800 dark:text-amber-200">
            <strong>🔒 Funcionalidade Bloqueada</strong> — A funcionalidade{' '}
            <span className="font-semibold">{featureName}</span>{' '}
            {featureDescription && <>({featureDescription})</>} não está disponível no seu plano. Você pode visualizar, mas não editar.
          </span>
          <Button 
            size="sm" 
            onClick={() => navigate('/settings/billing')}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
          >
            <Sparkles className="h-4 w-4" />
            Fazer Upgrade
          </Button>
        </AlertDescription>
      </Alert>
      
      {/* Container relativo para o conteúdo e overlay */}
      <div className="relative">
        {/* Conteúdo visual (sem interatividade real) */}
        <div 
          className="opacity-60 grayscale-[30%]" 
          aria-hidden="true"
          style={{ filter: 'grayscale(30%) opacity(0.6)' }}
        >
          {children}
        </div>
        
        {/* Overlay invisível que bloqueia TODA interação */}
        <div 
          className="absolute inset-0 z-40 cursor-not-allowed"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onFocus={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).blur?.();
          }}
          tabIndex={-1}
          role="presentation"
          aria-label="Funcionalidade bloqueada - faça upgrade para acessar"
        />
      </div>
    </div>
  );
}
