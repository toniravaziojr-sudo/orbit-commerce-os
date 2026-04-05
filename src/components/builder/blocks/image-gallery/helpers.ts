// =============================================
// IMAGE GALLERY — Pure Helper Functions
// =============================================

import type { GalleryImage } from './types';
import { toSafeNumber } from '../video-carousel/helpers';

// Re-export for convenience
export { toSafeNumber };

// ── Parse images from various input formats ──

export function parseImages(images?: GalleryImage[], imagesJson?: string): GalleryImage[] {
  if (images && Array.isArray(images) && images.length > 0) {
    return images.map((img, index) => normalizeImage(img as unknown as Record<string, unknown>, index)).filter(img => img.src);
  }

  if (imagesJson) {
    try {
      const parsed = JSON.parse(imagesJson);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => {
          if (typeof item === 'string') {
            return { id: `img-${index}`, src: item };
          }
          return normalizeImage(item, index);
        }).filter(img => img.src);
      }
    } catch {
      const urls = imagesJson.split(',').map(s => s.trim()).filter(Boolean);
      return urls.map((url, index) => ({ id: `img-${index}`, src: url }));
    }
  }

  return [];
}

// ── Normalize legacy image formats ──

function normalizeImage(item: Record<string, unknown>, index: number): GalleryImage {
  return {
    id: (item.id as string) || `img-${index}`,
    src: (item.src as string) || (item.srcDesktop as string) || (item.url as string) || '',
    srcMobile: (item.srcMobile as string) || undefined,
    alt: (item.alt as string) || undefined,
    caption: (item.caption as string) || undefined,
    linkUrl: (item.linkUrl as string) || undefined,
  };
}

// ── Aspect ratio classes ──

export function getAspectRatioClass(ratio: string): string {
  switch (ratio) {
    case 'square':
    case '1:1': return 'aspect-square';
    case '4:3': return 'aspect-[4/3]';
    case '16:9': return 'aspect-video';
    case '21:9': return 'aspect-[21/9]';
    case 'auto': return '';
    default: return 'aspect-square';
  }
}

// ── Gap classes ──

export function getGapClass(gap: string): string {
  switch (gap) {
    case 'sm': return 'gap-2';
    case 'lg': return 'gap-6';
    default: return 'gap-4';
  }
}

// ── Grid columns classes ──

export function getGridColsClass(columns: number): string {
  switch (columns) {
    case 2: return 'grid-cols-2';
    case 4: return 'grid-cols-2 md:grid-cols-4';
    default: return 'grid-cols-2 md:grid-cols-3';
  }
}

// ── Slide width class for carousel ──

export function getSlideWidthClass(slidesPerView: number): string {
  switch (slidesPerView) {
    case 2: return 'flex-[0_0_50%]';
    case 3: return 'flex-[0_0_33.333%]';
    case 4: return 'flex-[0_0_25%]';
    default: return 'flex-[0_0_100%]';
  }
}
