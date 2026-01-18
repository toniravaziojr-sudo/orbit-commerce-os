// =============================================
// PERSONALIZED PRODUCTS BLOCK - "Recommended for you" section
// =============================================

import React from 'react';
import { Sparkles, RefreshCw, ShoppingBag, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductItem {
  id?: string;
  name?: string;
  price?: number;
  originalPrice?: number;
  image?: string;
  badge?: string;
}

interface PersonalizedProductsBlockProps {
  title?: string;
  subtitle?: string;
  layout?: 'grid' | 'carousel' | 'list';
  columns?: number;
  showViewedRecently?: boolean;
  showRecommended?: boolean;
  showBuyAgain?: boolean;
  products?: ProductItem[];
  isEditing?: boolean;
}

const defaultProducts: ProductItem[] = [
  {
    id: '1',
    name: 'Camiseta Premium',
    price: 89.90,
    originalPrice: 129.90,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=300&fit=crop',
    badge: 'Recomendado',
  },
  {
    id: '2',
    name: 'Tênis Esportivo',
    price: 299.90,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop',
    badge: 'Baseado em sua navegação',
  },
  {
    id: '3',
    name: 'Mochila Casual',
    price: 149.90,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=300&fit=crop',
    badge: 'Você pode gostar',
  },
  {
    id: '4',
    name: 'Relógio Smart',
    price: 499.90,
    originalPrice: 699.90,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
    badge: 'Popular',
  },
];

export function PersonalizedProductsBlock({
  title = 'Recomendados para Você',
  subtitle = 'Produtos selecionados com base em suas preferências',
  layout = 'grid',
  columns = 4,
  showViewedRecently = true,
  showRecommended = true,
  showBuyAgain = false,
  products,
  isEditing = false,
}: PersonalizedProductsBlockProps) {
  // IMPORTANT: Demo products should ONLY appear in builder/editor mode
  // In public storefront, show nothing if no real products exist
  const hasRealProducts = products && products.length > 0;
  const displayProducts = hasRealProducts ? products : (isEditing ? defaultProducts : []);
  
  // Don't render anything in public mode if no real products
  if (displayProducts.length === 0) {
    return null;
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const gridColsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }[columns] || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <section className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header com ícone e título */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          
          {/* Filtros de tipo */}
          <div className="flex items-center gap-2 flex-wrap">
            {showViewedRecently && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                <Eye className="w-3.5 h-3.5" />
                Vistos recentemente
              </button>
            )}
            {showRecommended && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
                Para você
              </button>
            )}
            {showBuyAgain && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                Comprar novamente
              </button>
            )}
          </div>
        </div>

        {/* Grid de produtos */}
        <div className={cn('grid gap-4 sm:gap-6', gridColsClass)}>
          {displayProducts.map((product, index) => (
            <div
              key={product.id || index}
              className="group relative bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300"
            >
              {/* Badge */}
              {product.badge && (
                <div className="absolute top-3 left-3 z-10">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-primary/90 text-primary-foreground backdrop-blur-sm">
                    <Sparkles className="w-3 h-3" />
                    {product.badge}
                  </span>
                </div>
              )}

              {/* Imagem */}
              <div className="aspect-square bg-muted overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">
                    {formatPrice(product.price || 0)}
                  </span>
                  {product.originalPrice && product.originalPrice > (product.price || 0) && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  )}
                </div>
                {product.originalPrice && product.originalPrice > (product.price || 0) && (
                  <span className="inline-block mt-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                    {Math.round((1 - (product.price || 0) / product.originalPrice) * 100)}% OFF
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {isEditing && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed border-border">
            <p className="text-sm text-muted-foreground text-center">
              ⚡ Os produtos serão personalizados automaticamente com base no comportamento do usuário
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
