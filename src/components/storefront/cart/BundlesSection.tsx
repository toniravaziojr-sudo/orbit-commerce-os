// =============================================
// BUNDLES SECTION - Bundle offers in cart
// =============================================

import { useQuery } from '@tanstack/react-query';
import { useOffers } from '@/contexts/StorefrontConfigContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface BundleProduct {
  id: string;
  name: string;
  price: number;
  sku: string;
  image_url?: string;
}

export function BundlesSection({ tenantId }: { tenantId: string }) {
  const { config, isLoading: configLoading } = useOffers();
  const { addItem } = useCart();

  const bundlesConfig = config.bundles;

  // Get bundle products
  const { data: products, isLoading } = useQuery({
    queryKey: ['bundle-products', tenantId, bundlesConfig.bundleProductIds],
    queryFn: async () => {
      if (!bundlesConfig.enabled || bundlesConfig.bundleProductIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          sku,
          product_images(url, is_primary, sort_order)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .in('id', bundlesConfig.bundleProductIds)
        .limit(2);

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        sku: p.sku,
        image_url: p.product_images?.sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return (a.sort_order || 0) - (b.sort_order || 0);
        })[0]?.url,
      }));
    },
    enabled: !!tenantId && bundlesConfig.enabled && bundlesConfig.bundleProductIds.length > 0,
  });

  if (configLoading || isLoading) return null;
  if (!bundlesConfig.enabled) return null;
  if (!products || products.length === 0) return null;

  const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
  const savings = totalPrice * 0.1; // 10% bundle discount
  const bundlePrice = totalPrice - savings;

  const handleAddBundle = () => {
    products.forEach(product => {
      addItem({
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: 1,
        image_url: product.image_url,
      });
    });
    toast.success('Kit adicionado ao carrinho');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-lg">{bundlesConfig.title}</h3>
      </div>
      
      <div className="border rounded-lg p-4">
        <div className="flex gap-4 mb-4">
          {products.map((product, index) => (
            <div key={product.id} className="flex items-center gap-2">
              <div className="w-16 h-16 bg-muted rounded-md overflow-hidden">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    Sem img
                  </div>
                )}
              </div>
              {index < products.length - 1 && (
                <span className="text-2xl text-muted-foreground">+</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
                R$ {bundlePrice.toFixed(2).replace('.', ',')}
              </span>
              {bundlesConfig.showSavings && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Economia de R$ {savings.toFixed(2).replace('.', ',')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-through">
              R$ {totalPrice.toFixed(2).replace('.', ',')}
            </p>
          </div>
          <Button onClick={handleAddBundle}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar kit
          </Button>
        </div>
      </div>
    </div>
  );
}
