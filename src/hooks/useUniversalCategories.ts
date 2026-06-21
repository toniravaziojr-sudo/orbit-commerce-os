import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UniversalCategory {
  id: string;
  slug: string;
  parent_slug: string | null;
  name: string;
  level: number;
  regulatory_regime: string | null;
  sort_order: number | null;
}

export function useUniversalCategories() {
  return useQuery({
    queryKey: ['system-universal-categories'],
    staleTime: 1000 * 60 * 60, // 1h — sistema-wide, raramente muda
    queryFn: async (): Promise<UniversalCategory[]> => {
      const { data, error } = await supabase
        .from('system_universal_categories' as any)
        .select('id, slug, parent_slug, name, level, regulatory_regime, sort_order')
        .eq('is_active', true)
        .order('level')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}
