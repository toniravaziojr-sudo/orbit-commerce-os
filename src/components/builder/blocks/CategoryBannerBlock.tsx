// =============================================
// CATEGORY BANNER BLOCK - Banner da categoria (editável no Builder)
// SEM imagens demo hardcoded - template "do zero" fica limpo
// =============================================

import type { BlockRenderContext } from '@/lib/builder/types';

interface CategoryBannerBlockProps {
  fallbackImageDesktop?: string;
  fallbackImageMobile?: string;
  showTitle?: boolean;
  titlePosition?: 'left' | 'center' | 'right';
  overlayOpacity?: number;
  height?: 'sm' | 'md' | 'lg';
  context?: BlockRenderContext;
  isEditing?: boolean;
}

export function CategoryBannerBlock({
  fallbackImageDesktop,
  fallbackImageMobile,
  showTitle = true,
  titlePosition = 'center',
  overlayOpacity = 40,
  height = 'md',
  context,
  isEditing = false,
}: CategoryBannerBlockProps) {

  // Get category data from context
  const category = context?.category;
  
  // Determine which banner images to use (no demo fallback if not provided)
  const bannerDesktop = category?.banner_desktop_url || fallbackImageDesktop || null;
  const bannerMobile = category?.banner_mobile_url || fallbackImageMobile || bannerDesktop;
  
  // Check if we have any banner image
  const hasBannerImage = !!bannerDesktop || !!bannerMobile;
  
  // Category name
  const categoryName = category?.name || 'Categoria';
  const categoryDescription = category?.description;

  // Height classes
  const heightClasses = {
    sm: 'h-32 md:h-48',
    md: 'h-48 md:h-64',
    lg: 'h-64 md:h-80',
  };

  // Title position classes
  const titlePositionClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  };

  return (
    <div className={`relative w-full overflow-hidden ${heightClasses[height]}`}>
      {/* Banner image OR placeholder gradient */}
      {hasBannerImage ? (
        <picture>
          <source media="(min-width: 768px)" srcSet={bannerDesktop || bannerMobile || ''} />
          <img
            src={bannerMobile || bannerDesktop || ''}
            alt={categoryName}
            className="w-full h-full object-cover"
          />
        </picture>
      ) : (
        // Placeholder gradient - neutral, no demo images
        <div className="w-full h-full bg-gradient-to-br from-muted via-muted/80 to-muted-foreground/20" />
      )}
      
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black"
        style={{ opacity: hasBannerImage ? overlayOpacity / 100 : 0.3 }}
      />
      
      {/* Content */}
      {showTitle && (
        <div className={`absolute inset-0 flex flex-col justify-center px-4 md:px-8 ${titlePositionClasses[titlePosition]}`}>
          <div className="max-w-4xl">
            <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
              {categoryName}
            </h1>
            {categoryDescription && (
              <p className="mt-2 text-sm md:text-base text-white/90 max-w-2xl drop-shadow">
                {categoryDescription}
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Placeholder hint - only in editor when no banner configured */}
      {isEditing && !hasBannerImage && (
        <div className="absolute top-2 right-2 bg-muted-foreground/80 text-white text-xs px-2 py-1 rounded font-medium">
          Configure o banner da categoria
        </div>
      )}
    </div>
  );
}

export default CategoryBannerBlock;
