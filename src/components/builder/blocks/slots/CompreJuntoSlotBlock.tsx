// =============================================
// COMPRE JUNTO SLOT BLOCK - Buy Together offers on Product page
// Source of truth: Aumentar Ticket (/offers) module
// Shows real offers when configured, or empty state with CTA
// NO DEMO DATA - preview via props only
// =============================================

import { Gift, Plus, ShoppingCart, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/cartTotals';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { useState } from 'react';
import type { BlockRenderContext } from '@/lib/builder/types';

interface CompreJuntoSlotBlockProps {
  productId?: string;
  title?: string;
  subtitle?: string;
  maxItems?: number;
  showWhenEmpty?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  isEditing?: boolean;
  currentProduct?: {
    id: string;
    name: string;
    price: number;
    sku: string;
    images?: { url: string }[];
  };
  context?: BlockRenderContext;
}

export function CompreJuntoSlotBlock({
  productId,
  title = 'Compre Junto e Economize',
  subtitle,
  maxItems = 1,
  showWhenEmpty = true,
  ctaLabel = 'Configurar em Aumentar Ticket',
  ctaHref = '/offers',
  isEditing = false,
  currentProduct,
  context,
}: CompreJuntoSlotBlockProps) {
  // Get tenantSlug from context (Builder provides this)
  const tenantSlug = context?.tenantSlug || '';
  
  // useCart must be called unconditionally to follow Rules of Hooks
  // But we only use it when not editing
  const cart = useCart();
  const addItem = cart?.addItem;
  
  const [isAdding, setIsAdding] = useState(false);

  // NOTA: A filtragem de blocos duplicados em páginas de produto é feita
  // automaticamente pela função applyGlobalLayout em useGlobalLayoutIntegration.ts
  // Não é mais necessário verificar pageType aqui

  // Fetch buy together rules for this product
  const { data: rule, isLoading } = useQuery({
    queryKey: ['buy-together-rule', productId],
    queryFn: async () => {
      if (!productId) return null;

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

      // Fetch suggested product details
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
    enabled: !!productId && !isEditing,
  });

  // In editing mode, show EXAMPLE CARD demonstration (visual preview)
  if (isEditing) {
    return (
      <section className="py-6 border-t">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          {title}
        </h2>
        <div className="bg-muted/30 rounded-lg p-4">
          {/* Demo visual - product cards layout - using container query class */}
          <div className="sf-compre-junto">
            {/* Product 1 placeholder */}
            <div className="sf-compre-junto-card flex items-center gap-3 p-3 bg-background rounded-lg border">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-muted-foreground">Produto Atual</p>
                <p className="text-primary font-bold">R$ 129,90</p>
              </div>
            </div>

            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>

            {/* Product 2 placeholder */}
            <div className="sf-compre-junto-card flex items-center gap-3 p-3 bg-background rounded-lg border">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Gift className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-muted-foreground">Produto Sugerido</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground line-through">R$ 89,90</span>
                  <span className="text-primary font-bold">R$ 69,90</span>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="sf-compre-junto-total text-center">
              <p className="text-xs text-muted-foreground line-through">R$ 219,80</p>
              <p className="text-xs text-muted-foreground font-medium">COMPRANDO JUNTO:</p>
              <p className="text-xl font-bold text-primary">R$ 199,80</p>
              <p className="text-sm text-green-600 font-medium">Economize R$ 20,00</p>
              <Button disabled className="w-full mt-2" size="lg">
                Adquirir oferta
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-3">
          [Exemplo demonstrativo] Configure ofertas reais em{' '}
          <a href={ctaHref} className="text-primary underline hover:no-underline">
            Aumentar Ticket
          </a>
        </p>
      </section>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No rule configured - show empty state ONLY in editor, never in public
  if (!rule || !rule.suggestedProduct || !currentProduct) {
    // IMPORTANT: In public storefront, never show the empty state CTA
    // Only show in editor mode when showWhenEmpty is true
    if (!isEditing || !showWhenEmpty) return null;

    return (
      <section className="py-6 border-t">
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="p-6 text-center">
            <Gift className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Compre Junto</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure ofertas de "Compre Junto" para aumentar o ticket médio.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={ctaHref}>
                <Settings className="h-4 w-4 mr-2" />
                {ctaLabel}
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  // Real offer
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

  return (
    <section className="py-6 border-t">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" />
        {rule.title || title}
      </h2>

      <div className="bg-muted/30 rounded-lg p-4">
        {/* Unified layout using container queries */}
        <div className="sf-compre-junto">
          {/* Product 1 */}
          <div className="sf-compre-junto-card flex items-center gap-3 p-3 bg-background rounded-lg border">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {currentProductImage ? (
                <img src={currentProductImage} alt={currentProduct.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-2">{currentProduct.name}</p>
              <p className="font-bold sf-price-color" style={{ color: 'var(--theme-price-color, var(--theme-text-primary, currentColor))' }}>{formatCurrency(currentPrice)}</p>
            </div>
          </div>

          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 self-center">
            <Plus className="h-5 w-5 text-primary" />
          </div>

          {/* Product 2 */}
          <div className="sf-compre-junto-card flex items-center gap-3 p-3 bg-background rounded-lg border">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {suggestedProductImage ? (
                <img src={suggestedProductImage} alt={suggestedProduct.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm line-clamp-2">{suggestedProduct.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {hasDiscount && (
                  <span className="text-xs text-muted-foreground line-through">{formatCurrency(suggestedOriginalPrice)}</span>
                )}
                <span className="font-bold sf-price-color" style={{ color: 'var(--theme-price-color, var(--theme-text-primary, currentColor))' }}>{formatCurrency(suggestedDiscountedPrice)}</span>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="sf-compre-junto-total text-center">
            {hasDiscount && (
              <div>
                <p className="text-xs text-muted-foreground">Preço Total:</p>
                <p className="text-sm text-muted-foreground line-through">{formatCurrency(totalOriginal)}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground font-medium">COMPRANDO JUNTO:</p>
            <p className="text-xl font-bold sf-price-color" style={{ color: 'var(--theme-price-color, var(--theme-text-primary, currentColor))' }}>{formatCurrency(totalDiscounted)}</p>
            {hasDiscount && (
              <p className="text-sm text-green-600 font-medium">Economize {formatCurrency(savings)}</p>
            )}
            <Button onClick={handleAddTogether} disabled={isAdding} className="w-full mt-2" size="lg">
              {isAdding ? 'Adicionando...' : 'Adquirir oferta'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
