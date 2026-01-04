// =============================================
// PRODUCT RATING SUMMARY - Display product rating stars
// =============================================

import React from 'react';
import { useProductRating } from '@/hooks/useProductRating';
import { RatingSummary } from '@/components/storefront/RatingSummary';

interface ProductRatingSummaryProps {
  productId: string;
  variant?: 'productTitle' | 'card';
  className?: string;
}

export function ProductRatingSummary({ 
  productId, 
  variant = 'productTitle',
  className 
}: ProductRatingSummaryProps) {
  const { data: rating } = useProductRating(productId);
  
  if (!rating || rating.count === 0) return null;
  
  return (
    <RatingSummary
      average={rating.average}
      count={rating.count}
      variant={variant}
      className={className}
    />
  );
}
