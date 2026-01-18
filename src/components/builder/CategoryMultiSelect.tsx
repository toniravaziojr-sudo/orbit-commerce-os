// =============================================
// CATEGORY MULTI-SELECT - Visual category picker with prominent image upload
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
import { Label } from '@/components/ui/label';
import { X, Search, FolderOpen, Upload, Image as ImageIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageUploaderWithLibrary } from './ImageUploaderWithLibrary';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface CategoryItemConfig {
  categoryId: string;
  miniImageDesktop?: string;
  miniImageMobile?: string;
}

interface CategoryMultiSelectProps {
  value: CategoryItemConfig[];
  onChange: (items: CategoryItemConfig[]) => void;
  maxItems?: number;
  /** Dimensão recomendada para exibir nas instruções */
  imageDimensions?: {
    desktop: string;
    mobile: string;
    aspectRatio?: string;
  };
}

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
}

const DEFAULT_DIMENSIONS = {
  desktop: '800×800px',
  mobile: '400×400px',
  aspectRatio: '1:1 (quadrada)'
};

export function CategoryMultiSelect({ 
  value = [], 
  onChange, 
  maxItems = 12,
  imageDimensions = DEFAULT_DIMENSIONS
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

  const updateItemImage = (categoryId: string, field: 'miniImageDesktop' | 'miniImageMobile', url: string) => {
    onChange(value.map(item => 
      item.categoryId === categoryId 
        ? { ...item, [field]: url }
        : item
    ));
  };

  const getCategoryImage = (category: CategoryData, config?: CategoryItemConfig) => {
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
    <div className="space-y-4">
      {/* Instructions banner */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">📸 Imagem de Capa Personalizada</p>
            <p>Selecione as categorias abaixo e adicione uma imagem de capa para cada uma.</p>
            <p className="mt-1 text-blue-600 dark:text-blue-400">
              <strong>Desktop:</strong> {imageDimensions.desktop} • <strong>Mobile:</strong> {imageDimensions.mobile}
              {imageDimensions.aspectRatio && <> • <strong>Proporção:</strong> {imageDimensions.aspectRatio}</>}
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
      <ScrollArea className="h-36 border rounded-md">
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
                    isSelected && "bg-primary/10 border border-primary/30",
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

      {/* Selected categories with PROMINENT image upload */}
      {selectedCategories.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Imagens de Capa das Categorias Selecionadas
          </Label>
          
          <div className="space-y-3">
            {selectedCategories.map((item) => (
              <div 
                key={item.id}
                className="border rounded-lg p-3 bg-card space-y-3"
              >
                {/* Category header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                      {getCategoryImage(item, item.config) ? (
                        <img
                          src={getCategoryImage(item, item.config)!}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.slug}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCategory(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Image upload section - PROMINENT */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Upload className="h-3 w-3" />
                        Imagem de Capa (Desktop)
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        {imageDimensions.desktop}
                      </span>
                    </div>
                    <ImageUploaderWithLibrary
                      value={item.config.miniImageDesktop || ''}
                      onChange={(url) => updateItemImage(item.id, 'miniImageDesktop', url)}
                      variant="desktop"
                      aspectRatio="square"
                      placeholder="Clique para adicionar imagem desktop"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Upload className="h-3 w-3" />
                        Imagem de Capa (Mobile)
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        {imageDimensions.mobile}
                      </span>
                    </div>
                    <ImageUploaderWithLibrary
                      value={item.config.miniImageMobile || ''}
                      onChange={(url) => updateItemImage(item.id, 'miniImageMobile', url)}
                      variant="mobile"
                      aspectRatio="square"
                      placeholder="Clique para adicionar imagem mobile"
                    />
                  </div>
                </div>

                {/* Helper text */}
                {!item.config.miniImageDesktop && !item.config.miniImageMobile && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded flex items-center gap-1.5">
                    <Info className="h-3 w-3" />
                    Sem imagem personalizada. Será usada a imagem padrão da categoria.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
