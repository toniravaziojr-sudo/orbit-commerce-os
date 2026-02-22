// =============================================
// RELATED PRODUCTS SELECT - Multi-select for related products
// =============================================

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Search, Link2, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RelatedProductsSelectProps {
  productId: string;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  product_images: { url: string; is_primary: boolean }[];
}

export function RelatedProductsSelect({ productId }: RelatedProductsSelectProps) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // AI Generate related products for this single product
  const handleAIGenerate = async () => {
    if (!currentTenant?.id) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-related-products', {
        body: { tenant_id: currentTenant.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar');
      queryClient.invalidateQueries({ queryKey: ['related-products', productId] });
      toast.success(`${data.relations_created} relações criadas para ${data.processed} produtos`);
    } catch (err: any) {
      console.error('AI generate related error:', err);
      toast.error(err.message || 'Erro ao gerar produtos relacionados');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch all products (excluding current) - includes active AND draft products
  // Draft products are shown so users can pre-configure relations before publishing
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['related-products-list', currentTenant?.id, productId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, price, status, product_images(url, is_primary)')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['active', 'draft']) // Include draft products for configuration
        .neq('id', productId)
        .order('name')
        .limit(200);
      if (error) throw error;
      return (data || []) as (ProductItem & { status?: string })[];
    },
    enabled: !!currentTenant?.id && !!productId,
  });

  // Fetch current related products
  const { data: relatedIds, isLoading: relatedLoading } = useQuery({
    queryKey: ['related-products', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('related_products')
        .select('related_product_id, position')
        .eq('product_id', productId)
        .order('position');
      if (error) throw error;
      return (data || []).map(r => r.related_product_id);
    },
    enabled: !!productId,
  });

  // Add related product with optimistic update
  const addMutation = useMutation({
    mutationFn: async (relatedProductId: string) => {
      const position = (relatedIds?.length || 0) + 1;
      const { error } = await supabase
        .from('related_products')
        .insert({
          product_id: productId,
          related_product_id: relatedProductId,
          position,
        });
      if (error) throw error;
      return relatedProductId;
    },
    onMutate: async (relatedProductId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['related-products', productId] });
      // Snapshot the previous value
      const previousIds = queryClient.getQueryData<string[]>(['related-products', productId]);
      // Optimistically update
      queryClient.setQueryData(['related-products', productId], (old: string[] = []) => [...old, relatedProductId]);
      return { previousIds };
    },
    onError: (_err, _relatedProductId, context) => {
      // Rollback on error
      queryClient.setQueryData(['related-products', productId], context?.previousIds);
      toast.error('Erro ao adicionar produto relacionado');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['related-products', productId] });
    },
  });

  // Remove related product with optimistic update
  const removeMutation = useMutation({
    mutationFn: async (relatedProductId: string) => {
      const { error } = await supabase
        .from('related_products')
        .delete()
        .eq('product_id', productId)
        .eq('related_product_id', relatedProductId);
      if (error) throw error;
      return relatedProductId;
    },
    onMutate: async (relatedProductId) => {
      await queryClient.cancelQueries({ queryKey: ['related-products', productId] });
      const previousIds = queryClient.getQueryData<string[]>(['related-products', productId]);
      queryClient.setQueryData(['related-products', productId], (old: string[] = []) => 
        old.filter(id => id !== relatedProductId)
      );
      return { previousIds };
    },
    onError: (_err, _relatedProductId, context) => {
      queryClient.setQueryData(['related-products', productId], context?.previousIds);
      toast.error('Erro ao remover produto relacionado');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['related-products', productId] });
    },
  });

  // Prevent multiple clicks
  const isMutating = addMutation.isPending || removeMutation.isPending;

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
    if (!products || !relatedIds) return [];
    return relatedIds.map(id => products.find(p => p.id === id)).filter(Boolean) as ProductItem[];
  }, [products, relatedIds]);

  const toggleProduct = (id: string) => {
    // Prevent double-clicks while mutating
    if (isMutating) return;
    
    if (relatedIds?.includes(id)) {
      removeMutation.mutate(id);
    } else if ((relatedIds?.length || 0) < 12) {
      addMutation.mutate(id);
    }
  };

  const getProductImage = (product: ProductItem) => {
    const primary = product.product_images?.find(img => img.is_primary);
    return primary?.url || product.product_images?.[0]?.url || '/placeholder.svg';
  };

  const isLoading = productsLoading || relatedLoading;

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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5" />
          Produtos Relacionados
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAIGenerate}
          disabled={isGenerating}
          className="gap-1.5"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? 'Gerando...' : 'Gerar com IA'}
        </Button>
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
                  onClick={() => removeMutation.mutate(product.id)}
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
                const isSelected = relatedIds?.includes(product.id) || false;
                const isDisabled = !isSelected && (relatedIds?.length || 0) >= 12;

                return (
                  <div
                    key={product.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors',
                      isSelected && 'bg-primary/10',
                      (isDisabled || isMutating) && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => !isDisabled && !isMutating && toggleProduct(product.id)}
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
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        {(product as any).status === 'draft' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded flex-shrink-0">
                            Rascunho
                          </span>
                        )}
                      </div>
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
          {relatedIds?.length || 0}/12 selecionados
        </p>
      </CardContent>
    </Card>
  );
}
