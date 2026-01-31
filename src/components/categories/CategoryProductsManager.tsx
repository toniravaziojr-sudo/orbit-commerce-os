import { useState, useMemo } from 'react';
import { useCategoryProducts, CategoryProduct, AvailableProduct } from '@/hooks/useCategoryProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Search, 
  Plus, 
  Trash2, 
  GripVertical, 
  Package, 
  CheckSquare,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryProductsManagerProps {
  categoryId: string;
  categoryName: string;
}

// Sortable product row for linked products - Compact design
function SortableProductRow({
  item,
  isSelected,
  onToggleSelect,
  onRemove,
}: {
  item: CategoryProduct;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.product_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const primaryImage = item.product.product_images?.find(img => img.is_primary)?.url 
    || item.product.product_images?.[0]?.url;

  const isActive = item.product.status === 'active';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors group',
        isDragging && 'opacity-50 shadow-lg z-50',
        isSelected && 'ring-2 ring-primary bg-primary/5'
      )}
      {...attributes}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none flex-shrink-0"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Checkbox */}
      <Checkbox 
        checked={isSelected} 
        onCheckedChange={onToggleSelect}
        className="flex-shrink-0"
      />

      {/* Image */}
      <div className="h-10 w-10 rounded border overflow-hidden bg-muted flex-shrink-0">
        {primaryImage ? (
          <img src={primaryImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Name and SKU - main content area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="font-medium text-sm truncate" title={item.product.name}>
          {item.product.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{item.product.sku || 'Sem SKU'}</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline font-medium text-foreground">
            R$ {item.product.price.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      {/* Status badge - compact */}
      <Badge 
        variant={isActive ? 'default' : 'secondary'} 
        className="flex-shrink-0 h-6 text-xs px-2"
      >
        {isActive ? 'Ativo' : 'Inativo'}
      </Badge>

      {/* Remove button - always visible on mobile, hover on desktop */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={onRemove}
        aria-label="Remover produto"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Product row for available products (to add) - Compact design
function AvailableProductRow({
  product,
  isSelected,
  onToggleSelect,
}: {
  product: AvailableProduct;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const primaryImage = product.product_images?.find(img => img.is_primary)?.url 
    || product.product_images?.[0]?.url;

  const isLinked = product.isLinked;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border bg-card transition-colors',
        isLinked 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:bg-accent/50 cursor-pointer',
        isSelected && !isLinked && 'ring-2 ring-primary bg-primary/5'
      )}
      onClick={() => !isLinked && onToggleSelect()}
    >
      {/* Checkbox */}
      <Checkbox 
        checked={isSelected || isLinked} 
        disabled={isLinked}
        className="flex-shrink-0"
      />

      {/* Image */}
      <div className="h-10 w-10 rounded border overflow-hidden bg-muted flex-shrink-0">
        {primaryImage ? (
          <img src={primaryImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Name and SKU */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="font-medium text-sm truncate" title={product.name}>
          {product.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{product.sku || 'Sem SKU'}</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline font-medium text-foreground">
            R$ {product.price.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      {/* Status indicator */}
      {isLinked && (
        <Badge variant="outline" className="flex-shrink-0 h-6 text-xs px-2 gap-1">
          <Check className="h-3 w-3" />
          <span className="hidden sm:inline">Vinculado</span>
        </Badge>
      )}
    </div>
  );
}

export function CategoryProductsManager({ categoryId, categoryName }: CategoryProductsManagerProps) {
  const [linkedSearch, setLinkedSearch] = useState('');
  const [availableSearch, setAvailableSearch] = useState('');
  const [selectedLinked, setSelectedLinked] = useState<Set<string>>(new Set());
  const [selectedAvailable, setSelectedAvailable] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const {
    linkedProducts,
    isLoadingLinked,
    availableProducts,
    availableTotal,
    isLoadingAvailable,
    addProducts,
    removeProducts,
    reorderProducts,
  } = useCategoryProducts(categoryId, { search: availableSearch, page, pageSize });

  // Filter linked products by search
  const filteredLinked = useMemo(() => {
    if (!linkedSearch) return linkedProducts;
    const searchLower = linkedSearch.toLowerCase();
    return linkedProducts.filter(item =>
      item.product.name.toLowerCase().includes(searchLower) ||
      item.product.sku?.toLowerCase().includes(searchLower)
    );
  }, [linkedProducts, linkedSearch]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = linkedProducts.findIndex(p => p.product_id === active.id);
    const newIndex = linkedProducts.findIndex(p => p.product_id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(linkedProducts, oldIndex, newIndex);
      reorderProducts.mutate(newOrder.map(p => p.product_id));
    }
  };

  const handleAddSelected = () => {
    const productIds = Array.from(selectedAvailable);
    addProducts.mutate(productIds, {
      onSuccess: () => setSelectedAvailable(new Set()),
    });
  };

  const handleRemoveSelected = () => {
    const productIds = Array.from(selectedLinked);
    removeProducts.mutate(productIds, {
      onSuccess: () => setSelectedLinked(new Set()),
    });
  };

  const handleRemoveSingle = (productId: string) => {
    removeProducts.mutate([productId]);
  };

  const toggleLinkedSelect = (productId: string) => {
    setSelectedLinked(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleAvailableSelect = (productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    if (product?.isLinked) return;
    
    setSelectedAvailable(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAllLinked = () => {
    setSelectedLinked(new Set(filteredLinked.map(p => p.product_id)));
  };

  const clearLinkedSelection = () => {
    setSelectedLinked(new Set());
  };

  const totalPages = Math.ceil(availableTotal / pageSize);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Linked Products */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="truncate">Produtos na categoria</span>
              <Badge variant="secondary" className="ml-1">{linkedProducts.length}</Badge>
            </CardTitle>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos vinculados..."
              value={linkedSearch}
              onChange={e => setLinkedSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          {/* Bulk actions bar */}
          {selectedLinked.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-2 bg-muted rounded-lg">
              <span className="text-sm font-medium whitespace-nowrap">
                {selectedLinked.size} selecionado(s)
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <Button size="sm" variant="ghost" onClick={selectAllLinked} className="h-7 px-2">
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Todos</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={clearLinkedSelection} className="h-7 px-2">
                  <X className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Limpar</span>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRemoveSelected}
                  disabled={removeProducts.isPending}
                  className="h-7 px-2"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remover
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 min-h-0">
          {isLoadingLinked ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredLinked.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Nenhum produto vinculado</p>
              <p className="text-sm">Adicione produtos usando a lista ao lado</p>
            </div>
          ) : (
            <ScrollArea className="h-[350px]">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredLinked.map(p => p.product_id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5 pr-3">
                    {filteredLinked.map(item => (
                      <SortableProductRow
                        key={item.product_id}
                        item={item}
                        isSelected={selectedLinked.has(item.product_id)}
                        onToggleSelect={() => toggleLinkedSelect(item.product_id)}
                        onRemove={() => handleRemoveSingle(item.product_id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Available Products */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span className="truncate">Adicionar produtos</span>
            </CardTitle>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos para adicionar..."
              value={availableSearch}
              onChange={e => {
                setAvailableSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9"
            />
          </div>
          
          {/* Bulk actions bar */}
          {selectedAvailable.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium whitespace-nowrap">
                {selectedAvailable.size} selecionado(s)
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedAvailable(new Set())}
                  className="h-7 px-2"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Limpar</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddSelected}
                  disabled={addProducts.isPending}
                  className="h-7 px-2"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 min-h-0 flex flex-col">
          {isLoadingAvailable ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Nenhum produto encontrado</p>
              {availableSearch && (
                <p className="text-sm">Tente buscar por outro termo</p>
              )}
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 min-h-[280px] max-h-[350px]">
                <div className="space-y-1.5 pr-3">
                  {availableProducts.map(product => (
                    <AvailableProductRow
                      key={product.id}
                      product={product}
                      isSelected={selectedAvailable.has(product.id)}
                      onToggleSelect={() => toggleAvailableSelect(product.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
              
              {/* Pagination - improved visibility */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Pág. {page}/{totalPages} • {availableTotal} produtos
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
