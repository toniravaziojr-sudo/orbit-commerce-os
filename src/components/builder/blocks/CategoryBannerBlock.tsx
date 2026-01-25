// =============================================
// CATEGORY BANNER BLOCK - Banner da categoria
// Conforme docs/REGRAS.md - estrutura obrigatória da página de Categoria
// REGRAS.md linha 77: imagem do banner é configurada no menu Categorias
// =============================================

import type { BlockRenderContext } from '@/lib/builder/types';

interface CategoryBannerBlockProps {
  titlePosition?: 'left' | 'center' | 'right';
  overlayOpacity?: number;
  height?: 'sm' | 'md' | 'lg';
  context?: BlockRenderContext;
  isEditing?: boolean;
}

// Interface para categorySettings do context
interface CategorySettingsFromContext {
  showCategoryName?: boolean;
  showBanner?: boolean;
  bannerOverlayOpacity?: number; // 0-100, configurável em Tema > Páginas > Categoria
}

export function CategoryBannerBlock({
  titlePosition = 'center',
  overlayOpacity: _overlayOpacity, // Ignorado - usamos bannerOverlayOpacity do theme settings
  height = 'md',
  context,
  isEditing = false,
}: CategoryBannerBlockProps) {

  // Get category data from context
  const category = context?.category;
  
  // Get category settings from context (passed from VisualBuilder/StorefrontCategory)
  const categorySettings: CategorySettingsFromContext = (context as any)?.categorySettings || {};
  
  // Use bannerOverlayOpacity from theme settings (default 0 = no darkening)
  const overlayOpacity = categorySettings.bannerOverlayOpacity ?? 0;
  
  // Use settings from context
  const showBanner = categorySettings.showBanner ?? true;
  const showTitle = categorySettings.showCategoryName ?? true;
  
  // REGRAS.md linha 77: banner vem do menu Categorias (category.banner_desktop_url)
  const bannerDesktop = category?.banner_desktop_url || null;
  const bannerMobile = category?.banner_mobile_url || bannerDesktop;
  
  // Check if we have any banner image
  const hasBannerImage = !!bannerDesktop || !!bannerMobile;
  
  // Category name
  const categoryName = category?.name || 'Categoria';
  const categoryDescription = category?.description;

  // Title position classes
  const titlePositionClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  };

  // Se tanto o banner quanto o título estão desabilitados, não renderizar nada
  if (!showBanner && !showTitle) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Banner image container - só renderiza se showBanner=true */}
      {showBanner && (
        <div className="relative w-full">
          {/* Banner image OR placeholder gradient */}
          {hasBannerImage ? (
            <picture className="block w-full">
              {/* Desktop: usa banner_desktop_url se disponível */}
              {bannerDesktop && (
                <source media="(min-width: 768px)" srcSet={bannerDesktop} />
              )}
              {/* Mobile: usa banner_mobile_url se disponível, senão usa desktop */}
              <img
                src={bannerMobile || bannerDesktop || ''}
                alt={categoryName}
                className="w-full h-auto"
                style={{ 
                  maxHeight: '500px',
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
              />
            </picture>
          ) : (
            // Placeholder gradient - neutral, no demo images
            <div className="w-full aspect-[4/1] bg-gradient-to-br from-muted via-muted/80 to-muted-foreground/20" />
          )}
          
          {/* Overlay - só aplica se overlayOpacity > 0 */}
          {overlayOpacity > 0 && (
            <div 
              className="absolute inset-0 bg-black pointer-events-none"
              style={{ opacity: overlayOpacity / 100 }}
            />
          )}
        </div>
      )}
      
      {/* Title - independente do banner, aparece se showTitle=true */}
      {showTitle && (
        <div className={`py-6 px-4 md:px-8 flex flex-col ${titlePositionClasses[titlePosition]}`}>
          <div className={`max-w-4xl w-full ${titlePosition === 'center' ? 'text-center mx-auto' : titlePosition === 'right' ? 'text-right ml-auto' : ''}`}>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {categoryName}
            </h1>
            {categoryDescription && (
              <p className={`mt-2 text-sm md:text-base text-muted-foreground ${titlePosition === 'center' ? 'mx-auto' : titlePosition === 'right' ? 'ml-auto' : ''}`} style={{ maxWidth: '42rem' }}>
                {categoryDescription}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryBannerBlock;
