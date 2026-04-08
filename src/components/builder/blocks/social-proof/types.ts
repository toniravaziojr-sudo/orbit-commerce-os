// =============================================
// SOCIAL PROOF BLOCK - Unified types
// Merges: Testimonials + Reviews
// =============================================

import type { BlockRenderContext } from '@/lib/builder/types';

export interface SocialProofBlockProps {
  mode?: 'testimonials' | 'reviews';
  title?: string;
  // Testimonials mode
  items?: Array<{
    name?: string;
    content?: string;
    text?: string;
    rating?: number;
    role?: string;
    image?: string;
  }>;
  // Reviews mode
  reviews?: Array<{
    id: string;
    name: string;
    rating: number;
    text: string;
    productName?: string;
    productUrl?: string;
    productImage?: string;
  }>;
  visibleCount?: number;
  context?: BlockRenderContext;
  isEditing?: boolean;
}
