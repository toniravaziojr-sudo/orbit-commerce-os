// =============================================
// HIGHLIGHTS BLOCK - Unified types
// Merges: FeatureList (list) + InfoHighlights (bar)
// =============================================

import type { BlockRenderContext } from '@/lib/builder/types';

export interface HighlightItem {
  id?: string;
  icon: string;
  title?: string;
  text?: string;
  description?: string;
}

export interface HighlightsBlockProps {
  style?: 'list' | 'bar';
  title?: string;
  subtitle?: string;
  items?: HighlightItem[];
  iconColor?: string;
  textColor?: string;
  backgroundColor?: string;
  // List-specific
  showButton?: boolean;
  buttonText?: string;
  buttonUrl?: string;
  // Bar-specific
  layout?: 'horizontal' | 'vertical';
  context?: BlockRenderContext;
  isEditing?: boolean;
}
