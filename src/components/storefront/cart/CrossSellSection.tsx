// =============================================
// CROSS-SELL SECTION - Product recommendations in cart
// =============================================

import { useQuery } from '@tanstack/react-query';
import { useOffers } from '@/contexts/StorefrontConfigContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  sku: string;
  image_url?: string;
}

export function CrossSellSection({ tenantId }: { tenantId: string }) {
  const { config, isLoading: configLoading } = useOffers();
  const { items, addItem } = useCart();

  const crossSellConfig = config.crossSell;

  // Get products for cross-sell
  const { data: products, isLoading } = useQuery({
    queryKey: ['cross-sell-products', tenantId, crossSellConfig.productIds],
    queryFn: async () => {
      if (!crossSellConfig.enabled || crossSellConfig.productIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          price,
          sku,
          product_images(url, is_primary, sort_order)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .in('id', crossSellConfig.productIds)
        .limit(crossSellConfig.maxItems);

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        sku: p.sku,
        image_url: p.product_images?.sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return (a.sort_order || 0) - (b.sort_order || 0);
        })[0]?.url,
      }));
    },
    enabled: !!tenantId && crossSellConfig.enabled && crossSellConfig.productIds.length > 0,
  });

  if (configLoading || isLoading) return null;
  if (!crossSellConfig.enabled) return null;
  if (!products || products.length === 0) return null;

  // Filter out products already in cart
  const cartProductIds = new Set(items.map(i => i.product_id));
  const availableProducts = products.filter(p => !cartProductIds.has(p.id));

  if (availableProducts.length === 0) return null;

  const handleAddToCart = (product: Product) => {
    addItem({
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity: 1,
      image_url: product.image_url,
    });
    toast.success(`${product.name} adicionado ao carrinho`);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{crossSellConfig.title}</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {availableProducts.slice(0, crossSellConfig.maxItems).map(product => (
          <div 
            key={product.id}
            className="border rounded-lg p-3 hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-muted rounded-md mb-2 overflow-hidden">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  Sem imagem
                </div>
              )}
            </div>
            <p className="text-sm font-medium line-clamp-2 mb-1">{product.name}</p>
            <p className="text-sm font-semibold mb-2">
              R$ {product.price.toFixed(2).replace('.', ',')}
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full"
              onClick={() => handleAddToCart(product)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
