// =============================================
// CATEGORY BANNER BLOCK - Banner da categoria (editável no Builder)
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

// Demo fallback images (external URLs - not stored in tenant's drive)
const DEMO_BANNER_DESKTOP = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1920&h=400&fit=crop';
const DEMO_BANNER_MOBILE = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=768&h=300&fit=crop';

export function CategoryBannerBlock({
  fallbackImageDesktop = DEMO_BANNER_DESKTOP,
  fallbackImageMobile = DEMO_BANNER_MOBILE,
  showTitle = true,
  titlePosition = 'center',
  overlayOpacity = 40,
  height = 'md',
  context,
  isEditing = false,
}: CategoryBannerBlockProps) {

  // Get category data from context
  const category = context?.category;
  
  // Determine which banner images to use
  const bannerDesktop = category?.banner_desktop_url || fallbackImageDesktop;
  const bannerMobile = category?.banner_mobile_url || fallbackImageMobile || bannerDesktop;
  
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

  const isUsingFallback = !category?.banner_desktop_url && !category?.banner_mobile_url;

  return (
    <div className={`relative w-full overflow-hidden ${heightClasses[height]}`}>
      {/* Desktop banner */}
      <picture>
        <source media="(min-width: 768px)" srcSet={bannerDesktop} />
        <img
          src={bannerMobile}
          alt={categoryName}
          className="w-full h-full object-cover"
        />
      </picture>
      
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black"
        style={{ opacity: overlayOpacity / 100 }}
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
      
      {/* Demo badge - only in editor when using fallback */}
      {isEditing && isUsingFallback && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded font-medium">
          Demonstrativo
        </div>
      )}
    </div>
  );
}

export default CategoryBannerBlock;
