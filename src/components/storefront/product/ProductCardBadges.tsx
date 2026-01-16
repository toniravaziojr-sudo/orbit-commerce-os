// =============================================
// PRODUCT CARD BADGES - Renders dynamic badges on product cards in grids
// Uses badges configured in "Aumentar Ticket" > Selos
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';

export interface DynamicBadge {
  id: string;
  name: string;
  background_color: string;
  text_color: string;
  shape: 'square' | 'rectangular' | 'circular' | 'pill';
  position: 'left' | 'center' | 'right';
}

interface ProductCardBadgesProps {
  badges: DynamicBadge[];
  className?: string;
}

/**
 * Renders dynamic badges on product cards
 * Positioned as overlay on product images
 */
export function ProductCardBadges({ badges, className }: ProductCardBadgesProps) {
  if (!badges || badges.length === 0) return null;

  // Group badges by position
  const leftBadges = badges.filter(b => b.position === 'left');
  const centerBadges = badges.filter(b => b.position === 'center');
  const rightBadges = badges.filter(b => b.position === 'right');

  const getShapeClasses = (shape: DynamicBadge['shape']) => {
    switch (shape) {
      case 'circular':
        return 'rounded-full px-2 py-1 min-w-[24px] text-center';
      case 'pill':
        return 'rounded-full px-3 py-1';
      case 'square':
        return 'rounded-sm px-2 py-1';
      case 'rectangular':
      default:
        return 'rounded-md px-2 py-0.5';
    }
  };

  const renderBadge = (badge: DynamicBadge) => (
    <span
      key={badge.id}
      className={cn(
        'text-xs font-semibold whitespace-nowrap shadow-sm',
        getShapeClasses(badge.shape)
      )}
      style={{
        backgroundColor: badge.background_color,
        color: badge.text_color,
      }}
    >
      {badge.name}
    </span>
  );

  return (
    <div className={cn('absolute inset-x-0 top-2 flex justify-between items-start px-2 pointer-events-none z-10', className)}>
      {/* Left badges */}
      <div className="flex flex-col gap-1">
        {leftBadges.map(renderBadge)}
      </div>

      {/* Center badges */}
      {centerBadges.length > 0 && (
        <div className="flex flex-col gap-1 items-center absolute left-1/2 -translate-x-1/2">
          {centerBadges.map(renderBadge)}
        </div>
      )}

      {/* Right badges */}
      <div className="flex flex-col gap-1 items-end">
        {rightBadges.map(renderBadge)}
      </div>
    </div>
  );
}
