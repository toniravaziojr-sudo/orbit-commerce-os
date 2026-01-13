// =============================================
// RESPONSIVE VIEWPORT HOOK
// For conditional JS logic when CSS-only isn't sufficient
// 
// PREFERRED: Use CSS container queries (@container) for responsive layouts
// This hook is for JS-only scenarios (dynamic data, etc.)
// =============================================

import { useContext, createContext, useState, useEffect, ReactNode } from 'react';

export type ViewportMode = 'desktop' | 'mobile';

// Breakpoints
export const BREAKPOINTS = {
  mobile: 640,
  desktop: 1024,
} as const;

/**
 * Determines viewport mode based on width
 */
export function getViewportFromWidth(width: number): ViewportMode {
  return width < BREAKPOINTS.mobile ? 'mobile' : 'desktop';
}

/**
 * Hook that uses actual window size
 */
export function useActualViewport(): ViewportMode {
  const [viewport, setViewport] = useState<ViewportMode>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getViewportFromWidth(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setViewport(getViewportFromWidth(window.innerWidth));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

/**
 * Hook to check viewport mode
 */
export function useResponsiveCheck(viewportOverride?: ViewportMode) {
  const actualViewport = useActualViewport();
  const viewport = viewportOverride || actualViewport;
  
  return {
    isMobile: viewport === 'mobile',
    isDesktop: viewport === 'desktop',
    viewport,
  };
}

/**
 * Context for viewport override (Builder)
 */
export const ViewportContext = createContext<ViewportMode | undefined>(undefined);

export function ViewportProvider({ 
  viewport, 
  children 
}: { 
  viewport: ViewportMode | undefined; 
  children: ReactNode 
}) {
  return (
    <ViewportContext.Provider value={viewport}>
      {children}
    </ViewportContext.Provider>
  );
}

export function useViewportContext(): ViewportMode | undefined {
  return useContext(ViewportContext);
}
