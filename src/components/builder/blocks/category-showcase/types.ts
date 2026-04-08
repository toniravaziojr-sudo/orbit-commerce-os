// =============================================
// CATEGORY SHOWCASE BLOCK - Unified types
// Merges: CategoryList (cards) + FeaturedCategories (circles)
// =============================================

export interface CategoryShowcaseBlockProps {
  style?: 'cards' | 'circles';
  // Common
  title?: string;
  items?: any[];
  context?: any;
  isEditing?: boolean;

  // Cards mode (CategoryList) props
  source?: string;
  layout?: string;
  limit?: number;
  columns?: number;
  columnsDesktop?: number;
  columnsMobile?: number;
  showImage?: boolean;
  showDescription?: boolean;

  // Circles mode (FeaturedCategories) props
  categoryIds?: string[];
  mobileStyle?: string;
  showName?: boolean;
}
