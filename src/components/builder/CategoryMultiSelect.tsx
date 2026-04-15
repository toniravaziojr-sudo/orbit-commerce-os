// =============================================
// CATEGORY MULTI-SELECT - Simple category picker
// Imagens das categorias são gerenciadas em Categorias > Miniatura
// =============================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X, Search, FolderOpen, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CategoryItemConfig {
  categoryId: string;
}

interface CategoryMultiSelectProps {
  value: CategoryItemConfig[];
  onChange: (items: CategoryItemConfig[]) => void;
  maxItems?: number;
}

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
}

export function CategoryMultiSelect({ 
  value = [], 
  onChange, 
  maxItems = 12
}: CategoryMultiSelectProps) {
  const { currentTenant } = useAuth();
  const [search, setSearch] = useState('');

  const { data: categories, isLoading } = useQuery({
    queryKey: ['category-multi-select', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, image_url')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('name')
        .limit(100);
      if (error) throw error;
      return (data || []) as CategoryData[];
    },
    enabled: !!currentTenant?.id,
  });

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    if (!search.trim()) return categories;
    const term = search.toLowerCase();
    return categories.filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.slug.toLowerCase().includes(term)
    );
  }, [categories, search]);

  const selectedCategories = useMemo(() => {
    if (!categories) return [];
    return value.map(item => {
      const cat = categories.find(c => c.id === item.categoryId);
      return cat ? { ...cat, config: item } : null;
    }).filter(Boolean) as (CategoryData & { config: CategoryItemConfig })[];
  }, [categories, value]);

  const toggleCategory = (id: string) => {
    const existingIndex = value.findIndex(v => v.categoryId === id);
    if (existingIndex >= 0) {
      onChange(value.filter(v => v.categoryId !== id));
    } else if (value.length < maxItems) {
      onChange([...value, { categoryId: id }]);
    }
  };

  const removeCategory = (id: string) => {
    onChange(value.filter(v => v.categoryId !== id));
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
      {/* Instructions banner */}
      <div className="max-w-full rounded-lg border border-border bg-muted/50 p-3 overflow-hidden">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="min-w-0 text-xs text-muted-foreground break-words">
            <p>Selecione as categorias que deseja exibir neste bloco.</p>
            <p className="mt-1">
              As imagens são gerenciadas em <strong>Categorias &gt; Miniatura</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar categorias..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {/* Category list to select */}
      <ScrollArea className="h-36 min-w-0 rounded-md border">
        <div className="space-y-1 p-2 pr-3">
          {filteredCategories.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground text-sm">
              Nenhuma categoria encontrada
            </div>
          ) : (
            filteredCategories.map((category) => {
              const isSelected = value.some(v => v.categoryId === category.id);
              const isDisabled = !isSelected && value.length >= maxItems;
              
              return (
                <div
                  key={category.id}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 overflow-hidden rounded-md p-1.5 transition-colors hover:bg-muted cursor-pointer",
                    isSelected && "bg-primary/10 border border-primary/30",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => !isDisabled && toggleCategory(category.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    className="pointer-events-none flex-shrink-0"
                  />
                  <div className="h-6 w-6 overflow-hidden rounded bg-muted flex-shrink-0">
                    {category.image_url ? (
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden pr-1">
                    <p className="truncate text-xs font-medium leading-tight">{category.name}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Count indicator */}
      <p className="text-xs text-muted-foreground text-right">
        {value.length}/{maxItems} selecionadas
      </p>

      {/* Selected categories - simple list for reordering */}
      {selectedCategories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Selecionadas ({selectedCategories.length}):</p>
          <div className="flex max-w-full flex-wrap gap-1.5 overflow-hidden">
            {selectedCategories.map((item) => (
              <div 
                key={item.id}
                className="flex max-w-full items-center gap-1 rounded-full bg-muted py-0.5 pl-1.5 pr-0.5"
              >
                <div className="w-4 h-4 rounded-full bg-background overflow-hidden flex-shrink-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FolderOpen className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="max-w-[88px] truncate text-[10px] font-medium">{item.name}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-4 w-4 rounded-full hover:bg-destructive/20 flex-shrink-0"
                  onClick={() => removeCategory(item.id)}
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}