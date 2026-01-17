// =============================================
// ADDITIONAL HIGHLIGHT - Mini banners configuráveis
// =============================================

import React from 'react';

interface AdditionalHighlightProps {
  images: string[];
  className?: string;
}

/**
 * Renders additional highlight images below the shipping calculator
 * Supports 1-3 images with responsive layout
 */
export function AdditionalHighlight({
  images = [],
  className = '',
}: AdditionalHighlightProps) {
  const validImages = images.filter(Boolean).slice(0, 3);
  
  if (validImages.length === 0) return null;

  // Grid columns based on image count
  const gridCols = validImages.length === 1 
    ? 'grid-cols-1' 
    : validImages.length === 2 
      ? 'grid-cols-2' 
      : 'grid-cols-3';

  return (
    <div className={`grid ${gridCols} gap-2 ${className}`}>
      {validImages.map((imageUrl, index) => (
        <div 
          key={index}
          className="overflow-hidden rounded-lg"
        >
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
