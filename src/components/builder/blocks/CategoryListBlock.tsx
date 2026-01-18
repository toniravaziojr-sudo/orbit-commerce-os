// =============================================
// CATEGORY LIST BLOCK - Renders real categories
// Supports: auto (all), parent (main only), custom (manual selection)
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getPublicCategoryUrl } from '@/lib/publicUrls';
import type { CategoryItemConfig } from '@/components/builder/CategoryMultiSelect';

interface CategoryListBlockProps {
  source?: 'auto' | 'parent' | 'custom' | 'all' | 'featured';
  layout?: 'grid' | 'list' | 'carousel';
  limit?: number;
  columns?: number;
  showImage?: boolean;
  showDescription?: boolean;
  items?: CategoryItemConfig[];
  context: BlockRenderContext;
  isEditing?: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
}

interface CategoryWithOverride extends Category {
  displayImage: string | null;
}

export function CategoryListBlock({
  source = 'auto',
  layout = 'grid',
  limit = 12,
  columns = 4,
  showImage = true,
  showDescription = false,
  items = [],
  context,
  isEditing = false,
}: CategoryListBlockProps) {
  const { tenantSlug } = context;
  
  // Try to get tenant_id directly from context.settings (more reliable)
  const tenantIdFromContext = (context as any)?.settings?.tenant_id;

  // Fetch tenant first to get tenantId (fallback if not in context)
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant-by-slug', tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantSlug && !tenantIdFromContext,
  });

  // Use tenantId from context if available, otherwise from query
  const tenantId = tenantIdFromContext || tenant?.id;

  // Normalize source for backwards compatibility
  const normalizedSource = source === 'all' ? 'auto' : source;
  const isCustomMode = normalizedSource === 'custom' && items && items.length > 0;

  // Fetch categories - different logic for custom vs auto
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['builder-categories', tenantId, normalizedSource, limit, isCustomMode ? items.map(i => i.categoryId) : null],
    queryFn: async () => {
      if (!tenantId) return [];

      if (isCustomMode) {
        // Custom mode: fetch only selected categories
        const categoryIds = items.map(i => i.categoryId);
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, slug, description, image_url, parent_id')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .in('id', categoryIds);
        
        if (error) throw error;
        
        // Sort by the order in items array
        const categoryMap = new Map((data || []).map(c => [c.id, c]));
        return items
          .map(item => categoryMap.get(item.categoryId))
          .filter(Boolean) as Category[];
      }

      // Auto/parent mode: fetch all with filters
      let query = supabase
        .from('categories')
        .select('id, name, slug, description, image_url, parent_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(limit)
        .order('sort_order', { ascending: true });

      if (normalizedSource === 'parent') {
        query = query.is('parent_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!tenantId,
  });

  // Map custom image overrides to categories
  const categoriesWithOverrides: CategoryWithOverride[] = (categories || []).map(category => {
    const itemConfig = items?.find(i => i.categoryId === category.id);
    // Priority: miniImageDesktop > category.image_url
    const displayImage = itemConfig?.miniImageDesktop || category.image_url;
    return { ...category, displayImage };
  });
  
  const isLoading = (!tenantIdFromContext && tenantLoading) || categoriesLoading;

  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }[columns] || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  if (isLoading) {
    return (
      <div className={cn('grid gap-4 p-4', gridCols)}>
        {Array.from({ length: isCustomMode ? items.length : limit }).map((_, i) => (
          <div key={i} className="space-y-2">
            {showImage && <Skeleton className="aspect-square w-full rounded-lg" />}
            <Skeleton className="h-5 w-3/4" />
            {showDescription && <Skeleton className="h-4 w-full" />}
          </div>
        ))}
      </div>
    );
  }

  if (!categoriesWithOverrides?.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">
          {isCustomMode 
            ? 'Selecione categorias nas propriedades do bloco'
            : 'Nenhuma categoria encontrada'
          }
        </p>
        {isEditing && !isCustomMode && (
          <p className="text-xs mt-1">Adicione categorias na seção de Categorias do admin</p>
        )}
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="space-y-2 p-4">
        {categoriesWithOverrides.map((category) => (
          <a
            key={category.id}
            href={isEditing ? undefined : getPublicCategoryUrl(tenantSlug, category.slug) || undefined}
            className={cn(
              'flex items-center gap-3 p-3 bg-card rounded-lg border hover:bg-muted/50 transition-colors',
              isEditing && 'pointer-events-none'
            )}
          >
            {showImage && category.displayImage && (
              <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={category.displayImage}
                  alt={category.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-foreground">{category.name}</h3>
              {showDescription && category.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {category.description}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    );
  }

  // Grid layout (default)
  return (
    <div className={cn('grid gap-4 p-4', gridCols)}>
      {categoriesWithOverrides.map((category) => (
        <a
          key={category.id}
          href={isEditing ? undefined : getPublicCategoryUrl(tenantSlug, category.slug) || undefined}
          className={cn(
            'group block bg-card rounded-lg overflow-hidden border hover:shadow-md transition-shadow',
            isEditing && 'pointer-events-none'
          )}
        >
          {showImage && (
            <div className="aspect-square overflow-hidden bg-muted">
              {category.displayImage ? (
                <img
                  src={category.displayImage}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted/50">
                  <span className="text-4xl font-semibold">{category.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          )}
          <div className="p-3">
            <h3 className="font-medium text-sm text-foreground text-center">{category.name}</h3>
            {showDescription && category.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2 text-center">
                {category.description}
              </p>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
