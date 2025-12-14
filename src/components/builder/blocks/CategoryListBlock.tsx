// =============================================
// CATEGORY LIST BLOCK - Renders real categories
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getPublicCategoryUrl } from '@/lib/publicUrls';

interface CategoryListBlockProps {
  source?: 'all' | 'parent' | 'featured';
  layout?: 'grid' | 'list' | 'carousel';
  limit?: number;
  columns?: number;
  showImage?: boolean;
  showDescription?: boolean;
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

export function CategoryListBlock({
  source = 'all',
  layout = 'grid',
  limit = 6,
  columns = 3,
  showImage = true,
  showDescription = false,
  context,
  isEditing = false,
}: CategoryListBlockProps) {
  const { tenantSlug } = context;

  // Fetch tenant first to get tenantId
  const { data: tenant } = useQuery({
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
    enabled: !!tenantSlug,
  });

  const tenantId = tenant?.id;

  // Fetch categories
  const { data: categories, isLoading } = useQuery({
    queryKey: ['builder-categories', tenantId, source, limit],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('categories')
        .select('id, name, slug, description, image_url, parent_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(limit)
        .order('sort_order', { ascending: true });

      if (source === 'parent') {
        query = query.is('parent_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!tenantId,
  });

  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }[columns] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  if (isLoading) {
    return (
      <div className={cn('grid gap-4 p-4', gridCols)}>
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="space-y-2">
            {showImage && <Skeleton className="aspect-video w-full" />}
            <Skeleton className="h-5 w-3/4" />
            {showDescription && <Skeleton className="h-4 w-full" />}
          </div>
        ))}
      </div>
    );
  }

  if (!categories?.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Nenhuma categoria encontrada</p>
        {isEditing && (
          <p className="text-xs mt-1">Adicione categorias na seção de Categorias do admin</p>
        )}
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="space-y-2 p-4">
        {categories.map((category) => (
          <a
            key={category.id}
            href={isEditing ? undefined : getPublicCategoryUrl(tenantSlug, category.slug) || undefined}
            className={cn(
              'flex items-center gap-3 p-3 bg-card rounded-lg border hover:bg-muted/50 transition-colors',
              isEditing && 'pointer-events-none'
            )}
          >
            {showImage && category.image_url && (
              <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={category.image_url}
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

  return (
    <div className={cn('grid gap-4 p-4', gridCols)}>
      {categories.map((category) => (
        <a
          key={category.id}
          href={isEditing ? undefined : getPublicCategoryUrl(tenantSlug, category.slug) || undefined}
          className={cn(
            'group block bg-card rounded-lg overflow-hidden border hover:shadow-md transition-shadow',
            isEditing && 'pointer-events-none'
          )}
        >
          {showImage && (
            <div className="aspect-video overflow-hidden bg-muted">
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <span className="text-3xl">{category.name.charAt(0)}</span>
                </div>
              )}
            </div>
          )}
          <div className="p-3">
            <h3 className="font-medium text-sm text-foreground">{category.name}</h3>
            {showDescription && category.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {category.description}
              </p>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
