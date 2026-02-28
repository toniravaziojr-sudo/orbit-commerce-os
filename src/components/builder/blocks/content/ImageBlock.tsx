// =============================================
// IMAGE BLOCK - Responsive image with desktop/mobile variants
// =============================================

import React from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { getBlockImageUrl } from '@/lib/imageTransform';

interface ImageBlockProps {
  imageDesktop?: string;
  imageMobile?: string;
  src?: string; // Legacy support
  alt?: string;
  width?: string;
  height?: string;
  objectFit?: string;
  objectPosition?: string;
  aspectRatio?: string;
  rounded?: string;
  shadow?: string;
  linkUrl?: string;
  context?: BlockRenderContext;
}

const widthMap: Record<string, string> = {
  '25': '25%',
  '50': '50%',
  '75': '75%',
  'full': '100%',
};

const roundedMap: Record<string, string> = {
  'none': '0',
  'sm': '0.25rem',
  'md': '0.5rem',
  'lg': '1rem',
  'full': '9999px',
};

const shadowMap: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
};

const aspectRatioMap: Record<string, string> = {
  'auto': 'auto',
  '1:1': '1 / 1',
  '4:3': '4 / 3',
  '16:9': '16 / 9',
  '21:9': '21 / 9',
};

export function ImageBlock({ 
  imageDesktop,
  imageMobile,
  src, // Legacy support
  alt, 
  width, 
  height, 
  objectFit = 'cover',
  objectPosition = 'center',
  aspectRatio = 'auto',
  rounded = 'none',
  shadow = 'none',
  linkUrl,
  context,
}: ImageBlockProps) {
  // Use actual images (with legacy fallback) + optimize via transform
  const rawDesktopImage = imageDesktop || src;
  const rawMobileImage = imageMobile || rawDesktopImage;
  const desktopImage = getBlockImageUrl(rawDesktopImage, 1200);
  const mobileImage = getBlockImageUrl(rawMobileImage, 768);
  
  // Builder mode: use context.viewport state; Storefront: use <picture>
  const isBuilderMode = context?.viewport !== undefined;
  const isMobile = context?.viewport === 'mobile';

  const imageContent = (
    <div 
      className="overflow-hidden" 
      style={{ 
        width: widthMap[width || 'full'] || '100%',
        borderRadius: roundedMap[rounded] || '0',
        boxShadow: shadowMap[shadow] || 'none',
      }}
    >
      {desktopImage ? (
        isBuilderMode ? (
          // Builder mode: select image based on viewport state
          <img 
            src={isMobile && mobileImage ? mobileImage : desktopImage} 
            alt={alt || 'Imagem'} 
            style={{ 
              width: '100%',
              height: height === 'auto' ? 'auto' : (height || 'auto'),
              objectFit: (objectFit as any) || 'cover',
              objectPosition: objectPosition || 'center',
              aspectRatio: aspectRatioMap[aspectRatio] || 'auto',
              borderRadius: roundedMap[rounded] || '0',
            }}
          />
        ) : (
          // Storefront mode: use <picture> for real responsive
          <picture>
            {mobileImage && mobileImage !== desktopImage && (
              <source media="(max-width: 767px)" srcSet={mobileImage} />
            )}
            <img 
              src={desktopImage} 
              alt={alt || 'Imagem'} 
              loading="lazy"
              decoding="async"
              style={{ 
                width: '100%',
                height: height === 'auto' ? 'auto' : (height || 'auto'),
                objectFit: (objectFit as any) || 'cover',
                objectPosition: objectPosition || 'center',
                aspectRatio: aspectRatioMap[aspectRatio] || 'auto',
                borderRadius: roundedMap[rounded] || '0',
              }}
            />
          </picture>
        )
      ) : (
        <div 
          className="bg-muted h-48 flex items-center justify-center text-muted-foreground"
          style={{ borderRadius: roundedMap[rounded] || '0' }}
        >
          Imagem
        </div>
      )}
    </div>
  );

  if (linkUrl) {
    return <a href={linkUrl}>{imageContent}</a>;
  }

  return imageContent;
}
