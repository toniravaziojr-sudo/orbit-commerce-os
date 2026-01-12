// =============================================
// CATEGORY FILTERS - Filtros para páginas de categoria
// Responsivo: sidebar no desktop, accordion no mobile
// =============================================

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Filter, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export interface CategoryFiltersProps {
  priceRange?: [number, number];
  maxPrice?: number;
  onPriceChange?: (range: [number, number]) => void;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
  inStockOnly?: boolean;
  onStockChange?: (inStock: boolean) => void;
  tags?: string[];
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  isMobile?: boolean;
  isEditing?: boolean;
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'newest', label: 'Mais recentes' },
  { value: 'bestsellers', label: 'Mais vendidos' },
];

// Demo tags para exibição quando não há tags reais
const DEMO_TAGS = ['Promoção', 'Lançamento', 'Vegano', 'Orgânico', 'Sem parabenos'];

export function CategoryFilters({
  priceRange = [0, 500],
  maxPrice = 500,
  onPriceChange,
  sortBy = 'relevance',
  onSortChange,
  inStockOnly = false,
  onStockChange,
  tags = DEMO_TAGS,
  selectedTags = [],
  onTagsChange,
  isMobile = false,
  isEditing = false,
}: CategoryFiltersProps) {
  const [localPriceRange, setLocalPriceRange] = useState(priceRange);
  const [openSections, setOpenSections] = useState({
    price: true,
    stock: true,
    tags: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePriceChange = (value: number[]) => {
    const range: [number, number] = [value[0], value[1]];
    setLocalPriceRange(range);
    if (!isEditing) {
      onPriceChange?.(range);
    }
  };

  const handleTagToggle = (tag: string) => {
    if (isEditing) return;
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onTagsChange?.(newTags);
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const FiltersContent = () => (
    <div className="space-y-4">
      {/* Ordenação */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Ordenar por</label>
        <select
          value={sortBy}
          onChange={(e) => !isEditing && onSortChange?.(e.target.value)}
          disabled={isEditing}
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SORT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Preço */}
      <Collapsible open={openSections.price} onOpenChange={() => toggleSection('price')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
          Faixa de preço
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            openSections.price && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pb-4">
          <div className="space-y-4">
            <Slider
              value={localPriceRange}
              onValueChange={handlePriceChange}
              min={0}
              max={maxPrice}
              step={10}
              className="w-full"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{formatPrice(localPriceRange[0])}</span>
              <span>{formatPrice(localPriceRange[1])}</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Disponibilidade */}
      <Collapsible open={openSections.stock} onOpenChange={() => toggleSection('stock')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
          Disponibilidade
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform",
            openSections.stock && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={inStockOnly}
              onCheckedChange={(checked) => !isEditing && onStockChange?.(!!checked)}
              disabled={isEditing}
            />
            <span className="text-sm text-foreground">Apenas em estoque</span>
          </label>
        </CollapsibleContent>
      </Collapsible>

      {/* Tags */}
      {tags.length > 0 && (
        <Collapsible open={openSections.tags} onOpenChange={() => toggleSection('tags')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
            Características
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              openSections.tags && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 pb-4">
            <div className="space-y-2">
              {tags.map(tag => (
                <label
                  key={tag}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={() => handleTagToggle(tag)}
                    disabled={isEditing}
                  />
                  <span className="text-sm text-foreground">{tag}</span>
                </label>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Clear filters */}
      {(selectedTags.length > 0 || inStockOnly || localPriceRange[0] > 0 || localPriceRange[1] < maxPrice) && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (isEditing) return;
            setLocalPriceRange([0, maxPrice]);
            onPriceChange?.([0, maxPrice]);
            onStockChange?.(false);
            onTagsChange?.([]);
          }}
          disabled={isEditing}
        >
          <X className="h-4 w-4 mr-1" />
          Limpar filtros
        </Button>
      )}
    </div>
  );

  // Mobile: Sheet/Drawer
  if (isMobile) {
    return (
      <div className="w-full mb-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Filter className="h-4 w-4" />
              Filtrar
              {(selectedTags.length > 0 || inStockOnly) && (
                <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {selectedTags.length + (inStockOnly ? 1 : 0)}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              <FiltersContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop: Sidebar
  return (
    <aside className="w-64 shrink-0 hidden lg:block">
      <div className="sticky top-24 bg-card rounded-lg border p-4">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </h3>
        <FiltersContent />
      </div>
    </aside>
  );
}
