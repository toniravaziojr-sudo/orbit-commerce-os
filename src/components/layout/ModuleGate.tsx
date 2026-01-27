import { ReactNode } from 'react';
import { useModuleAccess, AccessLevel } from '@/hooks/useModuleAccess';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { Loader2 } from 'lucide-react';

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
   */
  blockedMode?: 'hide' | 'blur' | 'prompt';
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
 * 
 * Usage:
 * ```tsx
 * <ModuleGate moduleKey="marketing_advanced" blockedMode="blur" moduleName="Marketing Avançado">
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
          <div className="blur-sm pointer-events-none select-none opacity-50">
            {children}
          </div>
          
          {/* Overlay com prompt */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
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
