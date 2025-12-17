// =============================================
// RESPONSIVE DRAWER LAYOUT - Anti-regression base component
// =============================================
// Used by MiniCartDrawer and similar sheet/drawer components.
// Guarantees: fixed header, scrollable body, fixed footer with safe-area.

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveDrawerLayoutProps {
  header: ReactNode;
  body: ReactNode;
  footer: ReactNode;
  className?: string;
}

/**
 * Base layout for Sheet/Drawer components ensuring:
 * - Header: fixed height, never shrinks
 * - Body: flexible, scrollable, proper containment
 * - Footer: fixed at bottom with safe-area padding
 * 
 * CSS Guardrails applied:
 * - flex flex-col h-full max-h-[100dvh] on container
 * - shrink-0 on header/footer
 * - flex-1 min-h-0 overflow-y-auto on body
 * - safe-area-inset-bottom on footer
 */
export function ResponsiveDrawerLayout({
  header,
  body,
  footer,
  className,
}: ResponsiveDrawerLayoutProps) {
  return (
    <div className={cn('flex flex-col h-full max-h-[100dvh] overflow-hidden', className)}>
      {/* Header - fixed height, never shrink */}
      <div className="shrink-0">
        {header}
      </div>

      {/* Body - flexible scroll area with proper containment */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {body}
      </div>

      {/* Footer - fixed at bottom with safe-area padding */}
      <div className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {footer}
      </div>
    </div>
  );
}
