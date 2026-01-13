// =============================================
// RESPONSIVE VIEWPORT HOOK
// Unified hook for responsive behavior in Builder and Storefront
// 
// IMPORTANT: With the new iframe-based Builder preview, Tailwind 
// breakpoints work naturally inside the iframe. This hook is now
// mainly used for:
// 1. Conditional rendering in JS (when CSS-only isn't sufficient)
// 2. Legacy support during transition
// =============================================

import { useContext, createContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

// Breakpoints (same as Tailwind defaults)
export const BREAKPOINTS = {
  mobile: 640,  // sm breakpoint
  tablet: 768,  // md breakpoint
  desktop: 1024, // lg breakpoint
} as const;

/**
 * Determines the viewport mode based on width
 */
export function getViewportFromWidth(width: number): ViewportMode {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'mobile'; // Treat tablet-ish as mobile for most purposes
  return 'desktop';
}

/**
 * Hook that uses actual window size to determine viewport
 * This works correctly inside iframes since they have their own window
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

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

/**
 * Hook to check if current viewport matches a mode
 * 
 * RECOMMENDED APPROACH:
 * - In the new iframe-based Builder, let Tailwind handle breakpoints via CSS
 * - Use this hook only when you need conditional JS logic
 * 
 * @param viewportOverride - Optional override from Builder context (legacy)
 */
export function useResponsiveCheck(viewportOverride?: ViewportMode) {
  const actualViewport = useActualViewport();
  
  // Use override if provided (legacy Builder support), otherwise use actual
  const viewport = viewportOverride || actualViewport;
  
  return {
    isMobile: viewport === 'mobile',
    isDesktop: viewport === 'desktop',
    isTablet: viewport === 'tablet',
    viewport,
  };
}

/**
 * Gets responsive grid columns based on viewport
 * 
 * NOTE: With iframe-based Builder, prefer using Tailwind responsive classes
 * directly (e.g., `grid-cols-2 md:grid-cols-4`) instead of this function
 */
export function getResponsiveColumns(
  viewport: ViewportMode | undefined,
  options: {
    mobile?: number;
    tablet?: number;
    desktop: number;
  }
): number {
  const { mobile = 2, tablet, desktop } = options;
  
  if (!viewport) return desktop;
  
  switch (viewport) {
    case 'mobile':
      return mobile;
    case 'tablet':
      return tablet ?? mobile;
    case 'desktop':
    default:
      return desktop;
  }
}

/**
 * Gets responsive CSS class for grid columns
 * 
 * IMPORTANT: With the iframe-based Builder, this should now return
 * pure Tailwind responsive classes that work via CSS, not JS overrides.
 * The iframe has its own viewport, so CSS media queries work correctly.
 */
export function getResponsiveGridClass(
  viewport: ViewportMode | undefined,
  options: {
    mobile?: number;
    tablet?: number;
    desktop: number;
  }
): string {
  const { mobile = 2, tablet, desktop } = options;
  
  // ALWAYS return responsive Tailwind classes now
  // The iframe-based Builder makes CSS breakpoints work correctly
  const tabletCols = tablet ?? Math.min(mobile + 1, desktop);
  
  return `grid-cols-${mobile} sm:grid-cols-${tabletCols} lg:grid-cols-${desktop}`;
}

/**
 * Type guard to check if we're in Builder mode
 * 
 * NOTE: With iframe-based preview, this is less important since
 * CSS breakpoints work. Use only for features that need to know
 * they're in the editor (e.g., showing edit controls)
 */
export function isBuilderMode(viewport: ViewportMode | undefined): viewport is ViewportMode {
  return !!viewport;
}

/**
 * Context for providing viewport override in legacy scenarios
 */
export const ViewportContext = createContext<ViewportMode | undefined>(undefined);

/**
 * Provider for viewport context
 */
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

/**
 * Hook to get viewport from context
 */
export function useViewportContext(): ViewportMode | undefined {
  return useContext(ViewportContext);
}
