// =============================================
// CIRCLES VARIANT — Grid layout (desktop/tablet)
// SRP: Render categories in a flex-wrap centered grid.
// =============================================

import { memo } from 'react';
import { CategoryCard } from './CategoryCard';
import type { CategoryWithConfig } from './types';

interface GridLayoutProps {
  categories: CategoryWithConfig[];
  showName: boolean;
  tenantSlug: string;
  isEditing: boolean;
}

function GridLayoutImpl({
  categories,
  showName,
  tenantSlug,
  isEditing,
}: GridLayoutProps) {
  return (
    <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          showName={showName}
          tenantSlug={tenantSlug}
          isEditing={isEditing}
        />
      ))}
    </div>
  );
}

export const GridLayout = memo(GridLayoutImpl);
