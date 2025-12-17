// =============================================
// PRODUCT PAGE SECTIONS - Single source of truth
// Editor = Preview = Public (same order always)
// =============================================
// ORDER (fixed):
// 1. Full Description
// 2. Buy Together  
// 3. Reviews
// 4. Related Products (LAST, before footer)
// =============================================

import React from 'react';
import { BuyTogetherSection } from './sections/BuyTogetherSection';
import { RelatedProductsSection } from './sections/RelatedProductsSection';
import { ProductReviewsSection } from './sections/ProductReviewsSection';

interface ProductData {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  sku?: string;
  description?: string;
  images?: { url: string; alt?: string }[];
}

interface ProductPageSectionsProps {
  product: ProductData;
  tenantSlug: string;
  showDescription?: boolean;
  showBuyTogether?: boolean;
  showReviews?: boolean;
  showRelatedProducts?: boolean;
  viewportOverride?: 'desktop' | 'tablet' | 'mobile';
}

/**
 * Unified component for product page sections.
 * This component MUST be used by both Editor (BlockRenderer) and Public (StorefrontProduct)
 * to ensure consistent rendering order across all contexts.
 * 
 * ORDER (always the same):
 * 1. Full Description (Descrição completa)
 * 2. Buy Together (Compre Junto)
 * 3. Reviews (Avaliações)
 * 4. Related Products (Produtos Relacionados) - LAST before footer
 */
export function ProductPageSections({
  product,
  tenantSlug,
  showDescription = true,
  showBuyTogether = true,
  showReviews = true,
  showRelatedProducts = true,
  viewportOverride,
}: ProductPageSectionsProps) {
  const hasFullDescription = product.description && product.description.trim().length > 0;

  // Build current product data for BuyTogether section
  const currentProductData = {
    id: product.id,
    name: product.name,
    price: product.price,
    compare_at_price: product.compare_at_price,
    sku: product.sku || 'SKU',
    images: product.images || [],
  };

  return (
    <div className="container mx-auto px-4">
      {/* 1. Full Description Section */}
      {showDescription && hasFullDescription && (
        <div className="py-8 border-t">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Descrição</h2>
          <div 
            className="prose prose-sm md:prose max-w-none text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: product.description! }}
          />
        </div>
      )}

      {/* 2. Buy Together Section */}
      {showBuyTogether && (
        <BuyTogetherSection 
          productId={product.id} 
          tenantSlug={tenantSlug}
          currentProduct={currentProductData}
          viewportOverride={viewportOverride}
        />
      )}

      {/* 3. Reviews Section */}
      {showReviews && (
        <ProductReviewsSection productId={product.id} />
      )}

      {/* 4. Related Products Section - LAST (before footer) */}
      {showRelatedProducts && (
        <RelatedProductsSection productId={product.id} tenantSlug={tenantSlug} />
      )}
    </div>
  );
}
