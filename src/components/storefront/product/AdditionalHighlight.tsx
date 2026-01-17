// =============================================
// ADDITIONAL HIGHLIGHT - Mini banners configuráveis
// Suporta imagens separadas para mobile e desktop
// =============================================

import React from 'react';

interface AdditionalHighlightProps {
  /** Legacy: single array for both viewports (backwards compat) */
  images?: string[];
  /** Images for mobile viewport */
  mobileImages?: string[];
  /** Images for desktop viewport */
  desktopImages?: string[];
  /** Override viewport detection (from builder) */
  isMobileView?: boolean;
  className?: string;
}

/**
 * Renders additional highlight images below the shipping calculator
 * Supports 1-3 images with responsive layout
 * Shows mobile or desktop images based on viewport/override
 */
export function AdditionalHighlight({
  images = [],
  mobileImages = [],
  desktopImages = [],
  isMobileView,
  className = '',
}: AdditionalHighlightProps) {
  // Fallback: if no separate arrays provided, use legacy `images`
  const effectiveMobileImages = mobileImages.length > 0 ? mobileImages : images;
  const effectiveDesktopImages = desktopImages.length > 0 ? desktopImages : images;
  
  // Filter valid images (non-empty strings)
  const validMobileImages = effectiveMobileImages.filter(Boolean).slice(0, 3);
  const validDesktopImages = effectiveDesktopImages.filter(Boolean).slice(0, 3);
  
  // If no images at all, return null
  if (validMobileImages.length === 0 && validDesktopImages.length === 0) return null;

  // Grid columns based on image count
  const getGridCols = (count: number) => 
    count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : 'grid-cols-3';

  // Builder override mode - show specific viewport images
  if (isMobileView !== undefined) {
    const displayImages = isMobileView ? validMobileImages : validDesktopImages;
    if (displayImages.length === 0) return null;
    
    return (
      <div className={`grid ${getGridCols(displayImages.length)} gap-2 ${className}`}>
        {displayImages.map((imageUrl, index) => (
          <div key={index} className="overflow-hidden rounded-lg">
            <img 
              src={imageUrl}
              alt={`Destaque ${index + 1}`}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }

  // Public storefront mode - responsive with CSS
  // Show mobile images on small screens, desktop on larger screens
  return (
    <div className={className}>
      {/* Mobile images - visible only on mobile */}
      {validMobileImages.length > 0 && (
        <div className={`grid ${getGridCols(validMobileImages.length)} gap-2 sf-mobile-only`}>
          {validMobileImages.map((imageUrl, index) => (
            <div key={`mobile-${index}`} className="overflow-hidden rounded-lg">
              <img 
                src={imageUrl}
                alt={`Destaque ${index + 1}`}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Desktop images - visible only on desktop */}
      {validDesktopImages.length > 0 && (
        <div className={`grid ${getGridCols(validDesktopImages.length)} gap-2 sf-desktop-only`}>
          {validDesktopImages.map((imageUrl, index) => (
            <div key={`desktop-${index}`} className="overflow-hidden rounded-lg">
              <img 
                src={imageUrl}
                alt={`Destaque ${index + 1}`}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
