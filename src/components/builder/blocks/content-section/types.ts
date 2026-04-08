// =============================================
// CONTENT SECTION BLOCK - Unified types
// Merges: ContentColumns (content) + TextBanners (editorial)
// =============================================

import type { BlockRenderContext } from '@/lib/builder/types';

export interface ContentSectionBlockProps {
  style?: 'content' | 'editorial';
  title?: string;
  subtitle?: string;
  // Content mode (ex-ContentColumns)
  content?: string;
  imageDesktop?: string;
  imageMobile?: string;
  imagePosition?: 'left' | 'right';
  features?: Array<{ id?: string; icon: string; text: string }>;
  iconColor?: string;
  showButton?: boolean;
  buttonText?: string;
  buttonUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  // Editorial mode (ex-TextBanners)
  text?: string;
  imageDesktop1?: string;
  imageMobile1?: string;
  imageDesktop2?: string;
  imageMobile2?: string;
  ctaEnabled?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  ctaBgColor?: string;
  ctaTextColor?: string;
  layout?: 'text-left' | 'text-right' | 'left' | 'right';
  context?: BlockRenderContext;
  isEditing?: boolean;
}
