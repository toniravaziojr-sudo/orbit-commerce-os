import { ReactNode } from 'react';
import { ModuleGate } from './ModuleGate';

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
