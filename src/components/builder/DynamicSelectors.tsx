// =============================================
// DYNAMIC SELECTORS - Product/Category/Menu selectors for Builder
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface DynamicSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Product Selector
export function ProductSelector({ value, onChange, placeholder = 'Selecione um produto' }: DynamicSelectorProps) {
  const { currentTenant } = useAuth();

  const { data: products, isLoading } = useQuery({
    queryKey: ['builder-products', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, status')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active')
        .order('name')
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  if (isLoading) return <Skeleton className="h-9 w-full" />;

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        <SelectItem value="_auto">Automático (primeiro ativo)</SelectItem>
        {products?.map((product) => (
          <SelectItem key={product.id} value={product.id}>
            {product.name} ({product.sku})
          </SelectItem>
        ))}
        {(!products || products.length === 0) && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Nenhum produto encontrado
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

// Category Selector
export function CategorySelector({ value, onChange, placeholder = 'Selecione uma categoria' }: DynamicSelectorProps) {
  const { currentTenant } = useAuth();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['builder-categories', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, is_active')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('name')
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  if (isLoading) return <Skeleton className="h-9 w-full" />;

  // Filter out items with empty IDs to prevent Select.Item error
  const validCategories = categories?.filter(cat => cat.id && cat.id.trim() !== '') || [];

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {validCategories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
        {validCategories.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Nenhuma categoria encontrada
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

// Menu Selector
export function MenuSelector({ value, onChange, placeholder = 'Selecione um menu' }: DynamicSelectorProps) {
  const { currentTenant } = useAuth();

  const { data: menus, isLoading } = useQuery({
    queryKey: ['builder-menus', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('menus')
        .select('id, name, location')
        .eq('tenant_id', currentTenant.id)
        .order('name')
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });

  if (isLoading) return <Skeleton className="h-9 w-full" />;

  // Filter out items with empty IDs to prevent Select.Item error
  const validMenus = menus?.filter(menu => menu.id && menu.id.trim() !== '') || [];

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {validMenus.map((menu) => (
          <SelectItem key={menu.id} value={menu.id}>
            {menu.name} ({menu.location})
          </SelectItem>
        ))}
        {validMenus.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Nenhum menu encontrado
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
