// =============================================
// PRODUCT SHOWCASE BLOCK - Unified types
// Merges: ProductGrid + ProductCarousel + CollectionSection + FeaturedProducts
// =============================================

export interface ProductShowcaseBlockProps {
  source?: 'featured' | 'newest' | 'all' | 'category' | 'manual';
  layout?: 'grid' | 'carousel';
  // Common
  title?: string;
  limit?: number;
  columns?: number;
  columnsDesktop?: number;
  columnsMobile?: number;
  showPrice?: boolean;
  showButton?: boolean;
  buttonText?: string;
  context?: any;
  isEditing?: boolean;

  // Category source props
  categoryId?: string;
  categorySlug?: string;
  showViewAll?: boolean;
  viewAllText?: string;
  displayStyle?: string;
  mobileColumns?: number;

  // Manual source props
  productIds?: string[] | string;
}
