// =============================================
// VIDEO CAROUSEL — Types (Single Responsibility)
// =============================================

import { BlockRenderContext } from '@/lib/builder/types';

export interface VideoItem {
  id: string;
  type?: 'youtube' | 'upload';
  url?: string;
  videoDesktop?: string;
  videoMobile?: string;
  title?: string;
  thumbnail?: string;
}

export type MaxWidthOption = 'small' | 'medium' | 'large' | 'full';
export type LayoutMode = 'carousel' | 'grid';

export interface VideoCarouselBlockProps {
  title?: string;
  videos?: VideoItem[];
  videosJson?: string;
  autoplay?: boolean;
  showControls?: boolean;
  aspectRatio?: '16:9' | '4:3' | '1:1' | '9:16';
  maxWidth?: MaxWidthOption;
  layout?: LayoutMode;
  itemsPerSlide?: number;
  itemsPerRow?: number;
  itemsPerPage?: number;
  context?: BlockRenderContext;
}
