// =============================================
// HERO BLOCK - Hero section with background image
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';
import { BlockRenderContext } from '@/lib/builder/types';

interface HeroBlockProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  imageDesktop?: string;
  imageMobile?: string;
  backgroundImage?: string; // Legacy prop support
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonHoverBgColor?: string;
  buttonHoverTextColor?: string;
  height?: string;
  alignment?: string;
  overlayOpacity?: number;
  context?: BlockRenderContext;
}

const heightMap: Record<string, string> = {
  sm: '300px',
  md: '400px',
  lg: '500px',
  full: '100vh',
};

export function HeroBlock({ 
  title, 
  subtitle, 
  buttonText, 
  buttonUrl, 
  imageDesktop,
  imageMobile,
  backgroundImage, // Legacy prop support
  backgroundColor, 
  textColor, 
  buttonColor, 
  buttonTextColor,
  buttonHoverBgColor,
  buttonHoverTextColor,
  height = 'md', 
  alignment = 'center', 
  overlayOpacity = 50,
  context,
}: HeroBlockProps) {
  const alignClass = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  }[alignment] || 'items-center text-center';

  // Generate unique ID for CSS custom properties
  const btnId = `hero-btn-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate hover colors if not provided (darken base color)
  const baseBgColor = buttonColor || '#ffffff';
  const baseTextColor = buttonTextColor || (buttonColor ? '#ffffff' : (backgroundColor || '#6366f1'));
  const hoverBg = buttonHoverBgColor || baseBgColor;
  const hoverText = buttonHoverTextColor || baseTextColor;

  // Use actual images for responsive display
  const desktopImage = imageDesktop || backgroundImage;
  const mobileImage = imageMobile || desktopImage;
  
  // Builder mode: use context.viewport state; Storefront: use <picture>
  const isBuilderMode = context?.viewport !== undefined;
  const isMobile = context?.viewport === 'mobile';

  return (
    <div 
      className="relative flex items-center justify-center overflow-hidden"
      style={{ 
        backgroundColor: desktopImage ? undefined : (backgroundColor || 'hsl(var(--primary))'),
        minHeight: heightMap[height] || '400px',
      }}
    >
      {/* Background Image */}
      {desktopImage && (
        isBuilderMode ? (
          // Builder mode: select image based on viewport state
          <img 
            src={isMobile && mobileImage ? mobileImage : desktopImage}
            alt="" 
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          // Storefront mode: use <picture> for real responsive
          <picture className="absolute inset-0 w-full h-full">
            {mobileImage && mobileImage !== desktopImage && (
              <source media="(max-width: 767px)" srcSet={mobileImage} />
            )}
            <img 
              src={desktopImage} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </picture>
        )
      )}
      {desktopImage && (
        <div 
          className="absolute inset-0 bg-black" 
          style={{ opacity: (overlayOpacity || 50) / 100 }} 
        />
      )}
      <div className={cn("relative z-10 px-4 py-12 flex flex-col max-w-4xl mx-auto", alignClass)}>
        <h1 
          className="text-4xl md:text-5xl font-bold mb-4"
          style={{ color: textColor || '#ffffff' }}
        >
          {title || 'Título Principal'}
        </h1>
        {subtitle && (
          <p 
            className="text-xl mb-8 opacity-90"
            style={{ color: textColor || '#ffffff' }}
          >
            {subtitle}
          </p>
        )}
        {buttonText && (
          <>
            <style>{`
              .${btnId} {
                background-color: ${baseBgColor};
                color: ${baseTextColor};
              }
              .${btnId}:hover {
                background-color: ${hoverBg};
                color: ${hoverText};
              }
            `}</style>
            <a 
              href={buttonUrl || '#'} 
              className={`${btnId} inline-block px-8 py-3 rounded-lg font-semibold transition-colors`}
            >
              {buttonText}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
