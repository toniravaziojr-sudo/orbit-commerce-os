// =============================================
// IMAGE GALLERY — Types (Single Responsibility)
// =============================================

import { BlockRenderContext } from '@/lib/builder/types';

export interface GalleryImage {
  id?: string;
  src: string;
  srcMobile?: string;
  alt?: string;
  caption?: string;
  linkUrl?: string;
}

export type LayoutMode = 'grid' | 'carousel';

export interface ImageGalleryBlockProps {
  title?: string;
  subtitle?: string;
  images?: GalleryImage[];
  imagesJson?: string;
  layout?: LayoutMode;
  // Grid-specific
  columns?: 2 | 3 | 4;
  borderRadius?: number;
  // Carousel-specific
  slidesPerView?: 1 | 2 | 3 | 4;
  autoplay?: boolean;
  autoplayInterval?: number;
  showArrows?: boolean;
  showDots?: boolean;
  // Shared
  gap?: 'sm' | 'md' | 'lg';
  aspectRatio?: 'square' | '4:3' | '16:9' | '1:1' | '21:9' | 'auto';
  enableLightbox?: boolean;
  backgroundColor?: string;
  context?: BlockRenderContext;
}
