// =============================================
// RELATED PRODUCTS PICKER - Works with local state for new products
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Search, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RelatedProductsPickerProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  excludeProductId?: string;
  maxItems?: number;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  product_images: { url: string; is_primary: boolean }[];
}

export function RelatedProductsPicker({ 
  selectedIds, 
  onSelectionChange, 
  excludeProductId,
  maxItems = 12 
}: RelatedProductsPickerProps) {
  const { currentTenant } = useAuth();
  const [search, setSearch] = useState('');

  // Fetch all products (excluding current if provided)
  const { data: products, isLoading } = useQuery({
    queryKey: ['products-for-related', currentTenant?.id, excludeProductId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      let query = supabase
        .from('products')
        .select('id, name, sku, price, product_images(url, is_primary)')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active')
        .order('name')
        .limit(200);
      
      if (excludeProductId) {
        query = query.neq('id', excludeProductId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProductItem[];
    },
    enabled: !!currentTenant?.id,
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!search.trim()) return products;
    const term = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term)
    );
  }, [products, search]);

  const selectedProducts = useMemo(() => {
    if (!products) return [];
    return selectedIds.map(id => products.find(p => p.id === id)).filter(Boolean) as ProductItem[];
  }, [products, selectedIds]);

  const toggleProduct = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(pid => pid !== id));
    } else if (selectedIds.length < maxItems) {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const removeProduct = (id: string) => {
    onSelectionChange(selectedIds.filter(pid => pid !== id));
  };

  const getProductImage = (product: ProductItem) => {
    const primary = product.product_images?.find(img => img.is_primary);
    return primary?.url || product.product_images?.[0]?.url || '/placeholder.svg';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Produtos Relacionados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-full mb-2" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5" />
          Produtos Relacionados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Selected products */}
        {selectedProducts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedProducts.map((product) => (
              <Badge
                key={product.id}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                <span className="max-w-[120px] truncate text-xs">{product.name}</span>
                <button
                  type="button"
                  onClick={() => removeProduct(product.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {/* Product list */}
        <ScrollArea className="h-48 border rounded-md">
          <div className="p-2 space-y-1">
            {filteredProducts.length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm">
                Nenhum produto encontrado
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isSelected = selectedIds.includes(product.id);
                const isDisabled = !isSelected && selectedIds.length >= maxItems;

                return (
                  <div
                    key={product.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors',
                      isSelected && 'bg-primary/10',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => !isDisabled && toggleProduct(product.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      className="pointer-events-none"
                    />
                    <div className="w-8 h-8 rounded bg-muted overflow-hidden flex-shrink-0">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Count indicator */}
        <p className="text-xs text-muted-foreground text-right">
          {selectedIds.length}/{maxItems} selecionados
        </p>
      </CardContent>
    </Card>
  );
}
