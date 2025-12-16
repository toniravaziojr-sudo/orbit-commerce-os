// =============================================
// RESPONSIVE VIEWPORT HOOK
// Unified hook for responsive behavior in Builder and Storefront
// =============================================

import { useContext, createContext, useState, ReactNode, useCallback } from 'react';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

// Breakpoints (same as Tailwind defaults)
export const BREAKPOINTS = {
  mobile: 640,  // sm
  tablet: 1024, // lg
} as const;

/**
 * Determines the viewport mode based on width
 */
export function getViewportFromWidth(width: number): ViewportMode {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

/**
 * Hook to check if current viewport matches a mode
 * When viewportOverride is provided (from Builder), it takes priority
 * Otherwise, uses actual window width via media query
 */
export function useResponsiveCheck(viewportOverride?: ViewportMode) {
  // If we have an override (from Builder context), use it directly
  if (viewportOverride) {
    return {
      isMobile: viewportOverride === 'mobile',
      isTablet: viewportOverride === 'tablet',
      isDesktop: viewportOverride === 'desktop',
      viewport: viewportOverride,
    };
  }

  // For public storefront, we use CSS media queries
  // Return desktop by default (SSR-safe), CSS handles the rest
  return {
    isMobile: false, // CSS handles this in public
    isTablet: false,
    isDesktop: true,
    viewport: 'desktop' as ViewportMode,
  };
}

/**
 * Gets responsive grid columns based on viewport
 */
export function getResponsiveColumns(
  viewport: ViewportMode | undefined,
  options: {
    mobile?: number;
    tablet?: number;
    desktop: number;
  }
): number {
  const { mobile = 2, tablet = 3, desktop } = options;
  
  if (!viewport) return desktop;
  
  switch (viewport) {
    case 'mobile':
      return mobile;
    case 'tablet':
      return tablet;
    case 'desktop':
    default:
      return desktop;
  }
}

/**
 * Gets responsive CSS class for grid columns
 * Works in both Builder (with override) and public (with CSS media queries)
 */
export function getResponsiveGridClass(
  viewport: ViewportMode | undefined,
  options: {
    mobile?: number;
    tablet?: number;
    desktop: number;
  }
): string {
  const { mobile = 2, tablet = 3, desktop } = options;
  
  // If we have a viewport override (Builder), return fixed column class
  if (viewport) {
    const cols = getResponsiveColumns(viewport, options);
    return `grid-cols-${cols}`;
  }
  
  // For public storefront, return responsive Tailwind classes
  return `grid-cols-${mobile} sm:grid-cols-${tablet} lg:grid-cols-${desktop}`;
}

/**
 * Type guard to check if we're in Builder mode
 */
export function isBuilderMode(viewport: ViewportMode | undefined): viewport is ViewportMode {
  return !!viewport;
}
