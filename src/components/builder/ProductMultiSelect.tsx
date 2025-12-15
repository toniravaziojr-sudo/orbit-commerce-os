// =============================================
// PRODUCT MULTI-SELECT - Visual product picker with checkboxes
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
import { X, Search, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  maxItems?: number;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  product_images: { url: string; is_primary: boolean }[];
}

export function ProductMultiSelect({ value = [], onChange, maxItems = 12 }: ProductMultiSelectProps) {
  const { currentTenant } = useAuth();
  const [search, setSearch] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['product-multi-select', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, price, product_images(url, is_primary)')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active')
        .order('name')
        .limit(200);
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
    return value.map(id => products.find(p => p.id === id)).filter(Boolean) as ProductItem[];
  }, [products, value]);

  const toggleProduct = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else if (value.length < maxItems) {
      onChange([...value, id]);
    }
  };

  const removeProduct = (id: string) => {
    onChange(value.filter(v => v !== id));
  };

  const getProductImage = (product: ProductItem) => {
    const primary = product.product_images?.find(img => img.is_primary);
    return primary?.url || product.product_images?.[0]?.url || '/placeholder.svg';
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
              const isSelected = value.includes(product.id);
              const isDisabled = !isSelected && value.length >= maxItems;
              
              return (
                <div
                  key={product.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors",
                    isSelected && "bg-primary/10",
                    isDisabled && "opacity-50 cursor-not-allowed"
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
        {value.length}/{maxItems} selecionados
      </p>
    </div>
  );
}