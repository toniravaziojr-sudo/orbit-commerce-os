// =============================================
// VIDEO BLOCK - Unified types
// Merges: YouTubeVideo + VideoUpload
// =============================================

import type { BlockRenderContext } from '@/lib/builder/types';

export interface VideoBlockProps {
  source?: 'youtube' | 'upload';
  title?: string;
  // YouTube-specific
  youtubeUrl?: string;
  widthPreset?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  // Upload-specific
  videoDesktop?: string;
  videoMobile?: string;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
  // Shared
  aspectRatio?: string;
  aspectRatioCustom?: string;
  context?: BlockRenderContext;
  isEditing?: boolean;
}
