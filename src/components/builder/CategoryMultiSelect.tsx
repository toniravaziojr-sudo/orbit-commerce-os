// =============================================
// CATEGORY MULTI-SELECT - Visual category picker with checkboxes and mini images
// =============================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X, Search, FolderOpen, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageUploaderWithLibrary } from './ImageUploaderWithLibrary';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface CategoryItemConfig {
  categoryId: string;
  miniImageDesktop?: string;
  miniImageMobile?: string;
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

export function CategoryMultiSelect({ value = [], onChange, maxItems = 12 }: CategoryMultiSelectProps) {
  const { currentTenant } = useAuth();
  const [search, setSearch] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

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
      if (expandedItem === id) setExpandedItem(null);
    } else if (value.length < maxItems) {
      onChange([...value, { categoryId: id }]);
    }
  };

  const removeCategory = (id: string) => {
    onChange(value.filter(v => v.categoryId !== id));
    if (expandedItem === id) setExpandedItem(null);
  };

  const updateItemImage = (categoryId: string, field: 'miniImageDesktop' | 'miniImageMobile', url: string) => {
    onChange(value.map(item => 
      item.categoryId === categoryId 
        ? { ...item, [field]: url }
        : item
    ));
  };

  const getCategoryImage = (category: CategoryData, config?: CategoryItemConfig) => {
    // Priority: mini image > category.image_url > placeholder
    return config?.miniImageDesktop || category.image_url || null;
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
    <div className="space-y-3">
      {/* Selected categories with image config */}
      {selectedCategories.length > 0 && (
        <div className="space-y-2 border rounded-lg p-2 bg-muted/30">
          <Label className="text-xs text-muted-foreground">Categorias selecionadas</Label>
          {selectedCategories.map((item) => (
            <Collapsible 
              key={item.id}
              open={expandedItem === item.id}
              onOpenChange={(open) => setExpandedItem(open ? item.id : null)}
            >
              <div className="flex items-center justify-between gap-2 bg-background rounded-md px-2 py-1.5 border">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded bg-muted overflow-hidden flex-shrink-0">
                    {getCategoryImage(item, item.config) ? (
                      <img
                        src={getCategoryImage(item, item.config)!}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {expandedItem === item.id ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCategory(item.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CollapsibleContent className="pt-2 pb-1 px-2 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Mini Imagem (Desktop)</Label>
                  <ImageUploaderWithLibrary
                    value={item.config.miniImageDesktop || ''}
                    onChange={(url) => updateItemImage(item.id, 'miniImageDesktop', url)}
                    variant="desktop"
                    aspectRatio="square"
                    placeholder="Imagem Desktop"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Mini Imagem (Mobile)</Label>
                  <ImageUploaderWithLibrary
                    value={item.config.miniImageMobile || ''}
                    onChange={(url) => updateItemImage(item.id, 'miniImageMobile', url)}
                    variant="mobile"
                    aspectRatio="square"
                    placeholder="Imagem Mobile"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Se não definir, usará a imagem padrão da categoria.
                </p>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

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

      {/* Category list */}
      <ScrollArea className="h-40 border rounded-md">
        <div className="p-2 space-y-1">
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
                    "flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors",
                    isSelected && "bg-primary/10",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => !isDisabled && toggleCategory(category.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    className="pointer-events-none"
                  />
                  <div className="w-7 h-7 rounded bg-muted overflow-hidden flex-shrink-0">
                    {category.image_url ? (
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{category.name}</p>
                    <p className="text-xs text-muted-foreground">{category.slug}</p>
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
    </div>
  );
}
