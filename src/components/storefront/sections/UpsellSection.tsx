// =============================================
// UPSELL SECTION - Post-purchase upsell offers
// Appears ONLY on Thank You page
// Source of truth: Aumentar Ticket (/offers) module via useActiveOfferRules
// =============================================

import { Gift, ShoppingCart, ArrowRight, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { demoProducts } from '@/lib/builder/demoData';
import { useActiveOfferRules, OfferRule } from '@/hooks/useOfferRules';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/cartTotals';
import { Link } from 'react-router-dom';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';

interface UpsellSectionProps {
  tenantId?: string;
  orderId?: string;
  isEditing?: boolean;
}

interface UpsellProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  slug: string;
}

/**
 * UpsellSection - Oferta pós-compra na página de Obrigado
 * 
 * REGRA: Upsell aparece SOMENTE na página de Obrigado
 * A configuração real vem do módulo Aumentar Ticket (/offers) - tabela offer_rules
 * 
 * Se não houver oferta configurada, não renderiza nada em produção
 * ou mostra placeholder no modo de edição.
 */
export function UpsellSection({ isEditing }: UpsellSectionProps) {
  const tenantSlug = useTenantSlug();
  const urls = useStorefrontUrls(tenantSlug);
  
  // Fetch active upsell rules
  const { data: upsellRules = [], isLoading: rulesLoading } = useActiveOfferRules('upsell', tenantSlug || '');
  
  // Get the first active rule
  const activeRule: OfferRule | undefined = upsellRules[0];
  
  // Fetch products from the suggested_product_ids
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['upsell-products', activeRule?.suggested_product_ids],
    queryFn: async () => {
      if (!activeRule?.suggested_product_ids?.length) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, compare_at_price, slug')
        .in('id', activeRule.suggested_product_ids)
        .eq('status', 'active')
        .limit(activeRule.max_items || 4);
      
      if (error) throw error;
      
      // Fetch images separately
      const productIds = data.map(p => p.id);
      const { data: images } = await supabase
        .from('product_images')
        .select('product_id, url')
        .in('product_id', productIds)
        .eq('is_primary', true);
      
      const imageMap = new Map(images?.map(img => [img.product_id, img.url]) || []);
      
      return data.map(p => ({
        ...p,
        image_url: imageMap.get(p.id) || null,
      })) as UpsellProduct[];
    },
    enabled: !!activeRule?.suggested_product_ids?.length,
  });

  const isLoading = rulesLoading || productsLoading;
  
  // Calculate discounts
  const getDiscountedPrice = (product: UpsellProduct) => {
    if (!activeRule || activeRule.discount_type === 'none') {
      return product.price;
    }
    
    if (activeRule.discount_type === 'percent') {
      return product.price * (1 - activeRule.discount_value / 100);
    }
    
    if (activeRule.discount_type === 'fixed') {
      return Math.max(0, product.price - activeRule.discount_value);
    }
    
    return product.price;
  };

  // Demo product for editing preview
  const demoProduct = demoProducts[5]; // Hidratante Facial
  const discountPercent = 20;
  const discountedPrice = demoProduct.price * (1 - discountPercent / 100);
  const savings = demoProduct.price - discountedPrice;

  // In editing mode, always show demo placeholder
  if (isEditing) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent my-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Oferta Especial para Você!</h3>
            <Badge variant="destructive" className="ml-auto">-{discountPercent}%</Badge>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Product Image */}
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              <img 
                src={demoProduct.image} 
                alt={demoProduct.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Product Info */}
            <div className="flex-1 text-center sm:text-left">
              <h4 className="font-medium text-base mb-1">{demoProduct.name}</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Aproveite esta oferta exclusiva pós-compra!
              </p>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-sm text-muted-foreground line-through">
                  R$ {demoProduct.price.toFixed(2)}
                </span>
                <span className="text-xl font-bold text-primary">
                  R$ {discountedPrice.toFixed(2)}
                </span>
                <Badge variant="secondary" className="text-xs">
                  Economize R$ {savings.toFixed(2)}
                </Badge>
              </div>
            </div>

            {/* CTA Button */}
            <Button className="gap-2 flex-shrink-0" size="lg">
              Aproveitar Oferta
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
            [Demonstrativo] Configure ofertas de upsell em <strong>Aumentar Ticket</strong>
          </p>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No active upsell rule or no products - don't render anything in production
  if (!activeRule || products.length === 0) {
    return null;
  }

  // Render real upsell offers
  const discountLabel = activeRule.discount_type === 'percent' 
    ? `-${activeRule.discount_value}%`
    : activeRule.discount_type === 'fixed' && activeRule.discount_value > 0
    ? `-R$ ${activeRule.discount_value.toFixed(2)}`
    : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent my-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">
            {activeRule.title || 'Oferta Especial para Você!'}
          </h3>
          {discountLabel && (
            <Badge variant="destructive" className="ml-auto">{discountLabel}</Badge>
          )}
        </div>

        {activeRule.description && (
          <p className="text-sm text-muted-foreground mb-4">
            {activeRule.description}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {products.map((product) => {
            const finalPrice = getDiscountedPrice(product);
            const hasSavings = finalPrice < product.price;
            
            return (
              <Link 
                key={product.id} 
                to={urls.product(product.slug)}
                className="group block"
              >
                <Card className="overflow-hidden h-full transition-shadow hover:shadow-md">
                  <div className="aspect-square relative bg-muted">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingCart className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-sm line-clamp-2 mb-2">
                      {product.name}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      {hasSavings && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(product.price)}
                        </span>
                      )}
                      <span className="text-base font-bold text-primary">
                        {formatCurrency(finalPrice)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
