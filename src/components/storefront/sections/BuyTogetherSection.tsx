// =============================================
// BUY TOGETHER SECTION - Renders "Compre Junto" on product page
// Shows: Current product + Suggested product with combined price
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicProductUrl } from '@/lib/publicUrls';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { useState } from 'react';

interface BuyTogetherSectionProps {
  productId: string;
  tenantSlug: string;
  currentProduct?: {
    id: string;
    name: string;
    price: number;
    compare_at_price?: number;
    sku: string;
    images?: { url: string; alt?: string }[];
  };
  viewportOverride?: 'desktop' | 'tablet' | 'mobile';
  isEditing?: boolean;
}

export function BuyTogetherSection({ productId, tenantSlug, currentProduct, viewportOverride, isEditing = false }: BuyTogetherSectionProps) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  const { data: rule, isLoading } = useQuery({
    queryKey: ['buy-together-rule', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('buy_together_rules')
        .select(`
          id,
          title,
          discount_type,
          discount_value,
          suggested_product_id
        `)
        .eq('trigger_product_id', productId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !data) return null;
      
      const { data: suggestedProduct, error: productError } = await supabase
        .from('products')
        .select(`
          id, name, slug, sku, price, compare_at_price,
          product_images (url, is_primary, sort_order)
        `)
        .eq('id', data.suggested_product_id)
        .eq('status', 'active')
        .single();
      
      if (productError || !suggestedProduct) return null;
      
      return {
        ...data,
        suggestedProduct,
      };
    },
    enabled: !!productId,
  });

  // In editor mode with no rule, show demo placeholder
  if (isLoading || !rule || !rule.suggestedProduct || !currentProduct) {
    if (isEditing) {
      return (
        <section className="py-6 md:py-8 border-t">
          <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Compre Junto
          </h2>
          <div className="bg-muted/30 rounded-lg p-4 md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border flex-1">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Produto Atual</p>
                  <p className="text-primary font-bold">R$ 129,90</p>
                </div>
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border flex-1">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Produto Sugerido</p>
                  <p className="text-muted-foreground line-through text-xs">R$ 89,90</p>
                  <p className="text-primary font-bold">R$ 69,90</p>
                </div>
              </div>
              <div className="pl-4 border-l border-border min-w-[160px] text-center">
                <p className="text-xs text-muted-foreground line-through">R$ 219,80</p>
                <p className="text-xs text-muted-foreground font-medium">COMPRANDO JUNTO:</p>
                <p className="text-xl font-bold text-primary">R$ 199,80</p>
                <p className="text-sm text-green-600 font-medium">Economize R$ 20,00</p>
                <Button className="w-full mt-2" size="lg">Adquirir oferta</Button>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">
              [Exemplo demonstrativo] <a href="/offers" className="text-primary hover:underline">Configure ofertas reais em Aumentar Ticket</a>
            </p>
          </div>
        </section>
      );
    }
    return null;
  }

  const suggestedProduct = rule.suggestedProduct;
  
  const currentProductImage = currentProduct.images?.[0]?.url;
  const suggestedProductImage = suggestedProduct.product_images?.find((img: any) => img.is_primary)?.url 
    || suggestedProduct.product_images?.[0]?.url;

  const currentPrice = currentProduct.price;
  const suggestedOriginalPrice = suggestedProduct.price;
  
  let suggestedDiscountedPrice = suggestedOriginalPrice;
  if (rule.discount_type === 'percentage' && rule.discount_value) {
    suggestedDiscountedPrice = suggestedOriginalPrice * (1 - rule.discount_value / 100);
  } else if (rule.discount_type === 'fixed' && rule.discount_value) {
    suggestedDiscountedPrice = suggestedOriginalPrice - rule.discount_value;
  }
  
  const totalOriginal = currentPrice + suggestedOriginalPrice;
  const totalDiscounted = currentPrice + suggestedDiscountedPrice;
  const savings = totalOriginal - totalDiscounted;
  const hasDiscount = savings > 0;

  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleAddTogether = async () => {
    setIsAdding(true);
    try {
      addItem({
        product_id: currentProduct.id,
        name: currentProduct.name,
        sku: currentProduct.sku,
        price: currentProduct.price,
        quantity: 1,
        image_url: currentProductImage,
      });

      addItem({
        product_id: suggestedProduct.id,
        name: suggestedProduct.name,
        sku: suggestedProduct.sku,
        price: suggestedDiscountedPrice,
        quantity: 1,
        image_url: suggestedProductImage,
      });

      toast.success('Produtos adicionados ao carrinho!');
    } catch (error) {
      toast.error('Erro ao adicionar produtos');
    } finally {
      setIsAdding(false);
    }
  };

  // Determine layout mode
  const isMobileLayout = viewportOverride 
    ? (viewportOverride === 'mobile' || viewportOverride === 'tablet')
    : false; // Default to desktop for CSS-based responsive
  const isDesktopLayout = viewportOverride 
    ? viewportOverride === 'desktop'
    : false;

  // Product Card Component
  const ProductCard = ({ 
    image, 
    name, 
    price, 
    originalPrice, 
    showDiscount = false,
    linkUrl
  }: { 
    image?: string; 
    name: string; 
    price: number; 
    originalPrice?: number;
    showDiscount?: boolean;
    linkUrl?: string;
  }) => (
    <div className="flex items-center gap-3 p-3 bg-background rounded-lg border flex-1 min-w-0">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {image ? (
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Sem imagem
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {linkUrl ? (
          <a href={linkUrl} className="font-medium hover:underline line-clamp-2 text-sm">
            {name}
          </a>
        ) : (
          <p className="font-medium line-clamp-2 text-sm">{name}</p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {showDiscount && originalPrice && originalPrice > price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(originalPrice)}
            </span>
          )}
          <span className="font-bold sf-price-color" style={{ color: 'var(--theme-price-color, var(--theme-text-primary, currentColor))' }}>{formatPrice(price)}</span>
        </div>
      </div>
    </div>
  );

  // Price Summary Component  
  const PriceSummary = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={`flex flex-col items-center gap-2 ${isMobile ? 'pt-4 border-t border-border w-full' : 'pl-4 border-l border-border min-w-[160px]'}`}>
      {hasDiscount && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Preço Total:</p>
          <p className="text-sm text-muted-foreground line-through">
            {formatPrice(totalOriginal)}
          </p>
        </div>
      )}
      <div className="text-center">
        <p className="text-xs text-muted-foreground font-medium">COMPRANDO JUNTO:</p>
        <p className="text-xl md:text-2xl font-bold sf-price-color" style={{ color: 'var(--theme-price-color, var(--theme-text-primary, currentColor))' }}>
          {formatPrice(totalDiscounted)}
        </p>
      </div>
      {hasDiscount && (
        <p className="text-sm text-green-600 font-medium">
          Economize {formatPrice(savings)}
        </p>
      )}
      <Button 
        onClick={handleAddTogether} 
        disabled={isAdding}
        className={isMobile ? 'w-full mt-2' : 'w-full mt-2'}
        size="lg"
      >
        {isAdding ? 'Adicionando...' : 'Adquirir oferta'}
      </Button>
    </div>
  );

  return (
    <section className="py-6 md:py-8 border-t">
      <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" />
        {rule.title || 'Compre junto e economize'}
      </h2>
      
      <div className="bg-muted/30 rounded-lg p-4 md:p-6">
        {/* 
          Layout Strategy:
          - When viewportOverride exists (Builder mode): render only the matching layout
          - When no viewportOverride (public/preview): render both with CSS responsive classes
        */}
        
        {/* Desktop Layout */}
        {(isDesktopLayout || !viewportOverride) && (
          <div className={viewportOverride ? 'flex items-center gap-4' : 'hidden md:flex items-center gap-4'}>
            <ProductCard 
              image={currentProductImage}
              name={currentProduct.name}
              price={currentPrice}
            />
            
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            
            <ProductCard 
              image={suggestedProductImage}
              name={suggestedProduct.name}
              price={suggestedDiscountedPrice}
              originalPrice={suggestedOriginalPrice}
              showDiscount={hasDiscount}
              linkUrl={getPublicProductUrl(tenantSlug, suggestedProduct.slug) || undefined}
            />
            
            <PriceSummary />
          </div>
        )}

        {/* Mobile Layout */}
        {(isMobileLayout || !viewportOverride) && (
          <div className={viewportOverride ? 'flex flex-col gap-3' : 'flex flex-col gap-3 md:hidden'}>
            <ProductCard 
              image={currentProductImage}
              name={currentProduct.name}
              price={currentPrice}
            />
            
            <div className="flex items-center justify-center py-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-4 w-4 text-primary" />
              </div>
            </div>
            
            <ProductCard 
              image={suggestedProductImage}
              name={suggestedProduct.name}
              price={suggestedDiscountedPrice}
              originalPrice={suggestedOriginalPrice}
              showDiscount={hasDiscount}
              linkUrl={getPublicProductUrl(tenantSlug, suggestedProduct.slug) || undefined}
            />
            
            <PriceSummary isMobile />
          </div>
        )}
      </div>
    </section>
  );
}
