import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModuleAccess, AccessLevel } from '@/hooks/useModuleAccess';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Sparkles, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ModuleGateProps {
  /** Module key to check access for */
  moduleKey: string;
  /** Content to render if module is accessible */
  children: ReactNode;
  /** 
   * Mode de renderização quando bloqueado:
   * - 'hide': não mostra nada (default)
   * - 'blur': mostra conteúdo borrado com overlay de upgrade
   * - 'prompt': mostra apenas o prompt de upgrade
   * - 'preview': permite visualização com banner de upgrade no topo (BLOQUEADO)
   */
  blockedMode?: 'hide' | 'blur' | 'prompt' | 'preview';
  /** Nome amigável do módulo para exibir no prompt */
  moduleName?: string;
  /** Descrição do que o módulo faz */
  moduleDescription?: string;
}

/**
 * Gate component que controla acesso a módulos inteiros baseado no plano.
 * 
 * Diferente do FeatureGate (que controla features individuais),
 * o ModuleGate controla seções/páginas inteiras do sistema.
 * 
 * Modos de bloqueio:
 * - 'hide': esconde completamente (para submenus/itens de navegação)
 * - 'blur': mostra preview borrado com CTA de upgrade (para páginas)
 * - 'prompt': mostra apenas o prompt de upgrade (para seções)
 * - 'preview': mostra conteúdo com overlay bloqueador e banner de upgrade
 * 
 * Usage:
 * ```tsx
 * <ModuleGate moduleKey="marketing_advanced" blockedMode="preview" moduleName="Marketing Avançado">
 *   <MarketingAdvancedPage />
 * </ModuleGate>
 * ```
 */
export function ModuleGate({ 
  moduleKey, 
  children, 
  blockedMode = 'hide',
  moduleName,
  moduleDescription,
}: ModuleGateProps) {
  const navigate = useNavigate();
  const { hasAccess, accessLevel, requiresUpgrade, planKey, isLoading } = useModuleAccess(moduleKey);

  // Loading state
  if (isLoading) {
    if (blockedMode === 'hide') {
      return null;
    }
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Acesso total ou parcial - renderiza normalmente
  if (hasAccess) {
    return <>{children}</>;
  }

  // Sem acesso - renderiza baseado no modo
  switch (blockedMode) {
    case 'hide':
      return null;

    case 'blur':
      return (
        <div className="relative">
          {/* Conteúdo borrado */}
          <div className="blur-sm select-none opacity-50" aria-hidden="true">
            {children}
          </div>
          
          {/* Overlay com prompt - bloqueia toda interação */}
          <div 
            className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.preventDefault()}
          >
            <UpgradePrompt 
              moduleKey={moduleKey}
              moduleName={moduleName || moduleKey}
              moduleDescription={moduleDescription}
              currentPlan={planKey}
            />
          </div>
        </div>
      );

    case 'prompt':
      return (
        <UpgradePrompt 
          moduleKey={moduleKey}
          moduleName={moduleName || moduleKey}
          moduleDescription={moduleDescription}
          currentPlan={planKey}
        />
      );

    case 'preview':
      return (
        <div className="relative">
          {/* Banner de upgrade no topo */}
          <Alert className="mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <Lock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm text-amber-800 dark:text-amber-200">
                <strong>🔒 Módulo Bloqueado</strong> — O módulo{' '}
                <span className="font-semibold">{moduleName || moduleKey}</span>{' '}
                não está disponível no seu plano. Você pode visualizar, mas não editar.
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
              aria-label="Módulo bloqueado - faça upgrade para acessar"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

/**
 * Hook utility para verificar acesso em componentes de navegação.
 */
export function useCanAccessModule(moduleKey: string): boolean {
  const { hasAccess, isLoading } = useModuleAccess(moduleKey);
  return !isLoading && hasAccess;
}
