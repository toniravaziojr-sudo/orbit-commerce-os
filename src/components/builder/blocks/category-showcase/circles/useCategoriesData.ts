// =============================================
// CIRCLES VARIANT — Data fetching hook
// SRP: Fetch + cache categories by ID list.
// Uses React Query → identidade estável, sem remount loop.
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CategoryItemConfig, CategoryWithConfig } from './types';
import { extractCategoryIds } from './normalizeItems';

interface UseCategoriesDataResult {
  categories: CategoryWithConfig[];
  isLoading: boolean;
}

/**
 * Hook dedicado: busca categorias ativas pelos IDs selecionados.
 * - Cache estável via React Query (chave determinística pelos IDs).
 * - Sem fetch quando lista vazia.
 * - Mantém ordem definida no array de items.
 */
export function useCategoriesData(
  items: CategoryItemConfig[],
): UseCategoriesDataResult {
  const ids = extractCategoryIds(items);
  const cacheKey = ids.join(',');

  const { data = [], isLoading } = useQuery({
    queryKey: ['featured-categories', cacheKey],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min — categorias são quase estáticas
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<CategoryWithConfig[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, image_url')
        .eq('is_active', true)
        .in('id', ids)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('[useCategoriesData] fetch error:', error);
        return [];
      }

      const merged: CategoryWithConfig[] = (data || []).map((cat) => ({
        ...cat,
        config: items.find((item) => item.categoryId === cat.id),
      }));

      // Preservar ordem definida pelo usuário no painel
      merged.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      return merged;
    },
  });

  return {
    categories: data,
    isLoading: ids.length > 0 && isLoading,
  };
}
