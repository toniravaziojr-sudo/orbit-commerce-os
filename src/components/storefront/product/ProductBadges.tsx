// =============================================
// PRODUCT BADGES - Selos do produto (ex: Novo, Promoção, Frete Grátis)
// =============================================

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Truck, Tag, Star, Percent, Flame } from 'lucide-react';

interface ProductBadgesProps {
  hasDiscount?: boolean;
  discountPercent?: number;
  isNew?: boolean;
  isBestSeller?: boolean;
  hasFreeShipping?: boolean;
  customBadges?: string[];
  className?: string;
}

/**
 * Renders product badges/seals above the product
 * Conforme REGRAS.md: "slots para selos"
 */
export function ProductBadges({
  hasDiscount = false,
  discountPercent = 0,
  isNew = false,
  isBestSeller = false,
  hasFreeShipping = false,
  customBadges = [],
  className = '',
}: ProductBadgesProps) {
  const badges: React.ReactNode[] = [];

  // Discount badge
  if (hasDiscount && discountPercent > 0) {
    badges.push(
      <Badge key="discount" variant="destructive" className="gap-1 text-xs font-bold">
        <Percent className="w-3 h-3" />
        -{discountPercent}%
      </Badge>
    );
  }

  // New badge
  if (isNew) {
    badges.push(
      <Badge key="new" className="gap-1 text-xs font-bold bg-blue-500 hover:bg-blue-600">
        <Star className="w-3 h-3" />
        Novo
      </Badge>
    );
  }

  // Best seller badge
  if (isBestSeller) {
    badges.push(
      <Badge key="bestseller" className="gap-1 text-xs font-bold bg-orange-500 hover:bg-orange-600">
        <Flame className="w-3 h-3" />
        Mais Vendido
      </Badge>
    );
  }

  // Free shipping badge
  if (hasFreeShipping) {
    badges.push(
      <Badge key="freeshipping" className="gap-1 text-xs font-bold bg-green-500 hover:bg-green-600">
        <Truck className="w-3 h-3" />
        Frete Grátis
      </Badge>
    );
  }

  // Custom badges
  customBadges.forEach((badgeText, index) => {
    badges.push(
      <Badge key={`custom-${index}`} variant="secondary" className="gap-1 text-xs font-medium">
        <Tag className="w-3 h-3" />
        {badgeText}
      </Badge>
    );
  });

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges}
    </div>
  );
}
