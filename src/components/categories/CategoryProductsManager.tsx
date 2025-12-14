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
  Square,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryProductsManagerProps {
  categoryId: string;
  categoryName: string;
}

// Sortable product row for linked products
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group',
        isDragging && 'opacity-50 shadow-lg',
        isSelected && 'ring-2 ring-primary'
      )}
      {...attributes}
    >
      <button
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />

      <div className="h-10 w-10 rounded border overflow-hidden bg-muted flex-shrink-0">
        {primaryImage ? (
          <img src={primaryImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.product.name}</p>
        <p className="text-xs text-muted-foreground">{item.product.sku}</p>
      </div>

      <div className="text-sm font-medium">
        R$ {item.product.price.toFixed(2)}
      </div>

      <Badge variant={item.product.status === 'active' ? 'default' : 'secondary'} className="flex-shrink-0">
        {item.product.status === 'active' ? 'Ativo' : 'Inativo'}
      </Badge>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

// Product row for available products (to add)
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

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer',
        isSelected && 'ring-2 ring-primary bg-primary/5',
        product.isLinked && 'opacity-50'
      )}
      onClick={onToggleSelect}
    >
      <Checkbox checked={isSelected} disabled={product.isLinked} />

      <div className="h-10 w-10 rounded border overflow-hidden bg-muted flex-shrink-0">
        {primaryImage ? (
          <img src={primaryImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.sku}</p>
      </div>

      <div className="text-sm font-medium">
        R$ {product.price.toFixed(2)}
      </div>

      {product.isLinked && (
        <Badge variant="outline" className="flex-shrink-0">
          Já adicionado
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Linked Products */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos na categoria
              <Badge variant="secondary">{linkedProducts.length}</Badge>
            </CardTitle>
          </div>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos vinculados..."
                value={linkedSearch}
                onChange={e => setLinkedSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {selectedLinked.size > 0 && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedLinked.size} selecionado(s)</span>
              <Button size="sm" variant="ghost" onClick={selectAllLinked}>
                <CheckSquare className="h-4 w-4 mr-1" />
                Todos
              </Button>
              <Button size="sm" variant="ghost" onClick={clearLinkedSelection}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRemoveSelected}
                disabled={removeProducts.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remover
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoadingLinked ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLinked.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum produto vinculado</p>
              <p className="text-sm">Adicione produtos usando a seção ao lado</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredLinked.map(p => p.product_id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar produtos
            </CardTitle>
          </div>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos para adicionar..."
                value={availableSearch}
                onChange={e => {
                  setAvailableSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>
          {selectedAvailable.size > 0 && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedAvailable.size} selecionado(s)</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedAvailable(new Set())}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={handleAddSelected}
                disabled={addProducts.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoadingAvailable ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : availableProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-2">
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
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages} ({availableTotal} produtos)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
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
