// =============================================
// CIRCLES VARIANT — Single category card
// SRP: Render one circular category card.
// Memoized para identidade estável dentro de listas.
// =============================================

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';
import { getLogoImageUrl } from '@/lib/imageTransform';
import { getPublicCategoryUrl } from '@/lib/publicUrls';
import type { CategoryWithConfig } from './types';

interface CategoryCardProps {
  category: CategoryWithConfig;
  showName: boolean;
  tenantSlug: string;
  isEditing: boolean;
}

function CategoryCardImpl({
  category,
  showName,
  tenantSlug,
  isEditing,
}: CategoryCardProps) {
  const imageUrl = category.image_url;
  const isDemo = category.id.startsWith('demo-');

  const cardContent = (
    <>
      <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-muted/30 overflow-hidden mb-2 ring-2 ring-transparent group-hover:ring-primary transition-all flex-shrink-0">
        {imageUrl ? (
          <img
            src={getLogoImageUrl(imageUrl, 200)}
            alt={category.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>
      {showName && (
        <span className="text-xs sm:text-sm font-medium text-center mt-1 group-hover:text-primary transition-colors line-clamp-2">
          {category.name}
        </span>
      )}
    </>
  );

  if (isEditing || isDemo) {
    return (
      <div className="group flex flex-col items-center cursor-pointer">
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      to={getPublicCategoryUrl(tenantSlug, category.slug)}
      className="group flex flex-col items-center"
    >
      {cardContent}
    </Link>
  );
}

export const CategoryCard = memo(CategoryCardImpl);
