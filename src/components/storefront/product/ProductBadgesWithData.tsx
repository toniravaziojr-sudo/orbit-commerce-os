// =============================================
// PRODUCT BADGES WITH DATA - Busca selos do Aumentar Ticket
// Wrapper que busca badges do produto e renderiza ProductBadges
// =============================================

import React from 'react';
import { useProductBadgesForProduct } from '@/hooks/useProductBadges';
import { Badge } from '@/components/ui/badge';
import { Tag } from 'lucide-react';

interface ProductBadgesWithDataProps {
  productId?: string;
  className?: string;
}

/**
 * Fetches and renders badges assigned to a product from the "Aumentar Ticket" system
 * Returns null if no badges are assigned
 */
export function ProductBadgesWithData({ productId, className = '' }: ProductBadgesWithDataProps) {
  const { data: badges, isLoading } = useProductBadgesForProduct(productId);

  if (isLoading || !badges || badges.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges.map((badge) => (
        <Badge
          key={badge.id}
          className="gap-1 text-xs font-bold"
          style={{
            backgroundColor: badge.background_color || '#3b82f6',
            color: badge.text_color || '#ffffff',
          }}
        >
          <Tag className="w-3 h-3" />
          {badge.name}
        </Badge>
      ))}
    </div>
  );
}
