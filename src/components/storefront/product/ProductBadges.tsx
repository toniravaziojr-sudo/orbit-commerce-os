// =============================================
// PRODUCT BADGES - Selos do produto (ex: Novo, Mais Vendido, Frete Grátis)
// NOTA: Não exibe selo de desconto - descontos são geridos pelo menu "Descontos"
// =============================================

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Truck, Tag, Star, Flame } from 'lucide-react';

interface ProductBadgesProps {
  // NOTA: hasDiscount/discountPercent REMOVIDOS conforme REGRAS.md
  // Descontos são regidos estritamente pelo menu "Descontos", não por selos automáticos
  isNew?: boolean;
  isBestSeller?: boolean;
  hasFreeShipping?: boolean;
  customBadges?: string[];
  className?: string;
}

/**
 * Renders product badges/seals above the product
 * Conforme REGRAS.md: "slots para selos"
 * 
 * IMPORTANTE: NÃO exibe selo de desconto aqui.
 * Descontos são gerenciados exclusivamente pelo menu "Descontos".
 */
export function ProductBadges({
  isNew = false,
  isBestSeller = false,
  hasFreeShipping = false,
  customBadges = [],
  className = '',
}: ProductBadgesProps) {
  const badges: React.ReactNode[] = [];

  // New badge - uses theme highlight color
  if (isNew) {
    badges.push(
      <Badge key="new" className="gap-1 text-xs font-bold sf-tag-highlight">
        <Star className="w-3 h-3" />
        Novo
      </Badge>
    );
  }

  // Best seller badge - uses theme warning color
  if (isBestSeller) {
    badges.push(
      <Badge key="bestseller" className="gap-1 text-xs font-bold sf-tag-warning">
        <Flame className="w-3 h-3" />
        Mais Vendido
      </Badge>
    );
  }

  // Free shipping badge - uses theme success color
  if (hasFreeShipping) {
    badges.push(
      <Badge key="freeshipping" className="gap-1 text-xs font-bold sf-tag-success">
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
