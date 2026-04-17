// =============================================
// CIRCLES VARIANT — Internal types
// SRP: Type contracts only. No logic.
// =============================================

import type { BlockRenderContext } from '@/lib/builder/types';

export interface CategoryItemConfig {
  categoryId: string;
}

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
}

export type CategoryWithConfig = CategoryData & { config?: CategoryItemConfig };

export interface CirclesVariantProps {
  title?: string;
  items?: CategoryItemConfig[];
  /** Legacy: deprecated, use `items` */
  categoryIds?: string[];
  mobileStyle?: 'carousel' | 'grid';
  showName?: boolean;
  context?: BlockRenderContext;
  isEditing?: boolean;
}
