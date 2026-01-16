// =============================================
// PRODUCT CARD BADGES - Renders dynamic badges on product cards in grids
// Uses badges configured in "Aumentar Ticket" > Selos
// Layout responsivo: badges em linha, max 2 por posição, texto truncado
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

// Máximo de badges visíveis por posição para evitar poluição visual
const MAX_BADGES_PER_POSITION = 2;

/**
 * Renders dynamic badges on product cards
 * Positioned as overlay on product images
 */
export function ProductCardBadges({ badges, className }: ProductCardBadgesProps) {
  if (!badges || badges.length === 0) return null;

  // Group badges by position and limit to max per position
  const leftBadges = badges.filter(b => b.position === 'left').slice(0, MAX_BADGES_PER_POSITION);
  const centerBadges = badges.filter(b => b.position === 'center').slice(0, MAX_BADGES_PER_POSITION);
  const rightBadges = badges.filter(b => b.position === 'right').slice(0, MAX_BADGES_PER_POSITION);

  const getShapeClasses = (shape: DynamicBadge['shape']) => {
    switch (shape) {
      case 'circular':
        return 'rounded-full px-1.5 py-0.5 min-w-[20px] text-center';
      case 'pill':
        return 'rounded-full px-2 py-0.5';
      case 'square':
        return 'rounded-sm px-1.5 py-0.5';
      case 'rectangular':
      default:
        return 'rounded px-1.5 py-0.5';
    }
  };

  const renderBadge = (badge: DynamicBadge) => (
    <span
      key={badge.id}
      className={cn(
        'text-[10px] font-semibold shadow-sm truncate max-w-[80px]',
        getShapeClasses(badge.shape)
      )}
      style={{
        backgroundColor: badge.background_color,
        color: badge.text_color,
      }}
      title={badge.name}
    >
      {badge.name}
    </span>
  );

  return (
    <div className={cn('absolute inset-x-0 top-1.5 pointer-events-none z-10', className)}>
      {/* Top row: Left and Right badges side by side */}
      <div className="flex justify-between items-start px-1.5 gap-1">
        {/* Left badges - horizontal layout */}
        <div className="flex flex-wrap gap-0.5 max-w-[50%]">
          {leftBadges.map(renderBadge)}
        </div>

        {/* Right badges - horizontal layout, align right */}
        <div className="flex flex-wrap gap-0.5 justify-end max-w-[50%]">
          {rightBadges.map(renderBadge)}
        </div>
      </div>

      {/* Center badges - below if any */}
      {centerBadges.length > 0 && (
        <div className="flex justify-center gap-0.5 mt-0.5 px-1.5">
          {centerBadges.map(renderBadge)}
        </div>
      )}
    </div>
  );
}