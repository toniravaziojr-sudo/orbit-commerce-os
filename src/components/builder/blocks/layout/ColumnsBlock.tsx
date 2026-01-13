// =============================================
// COLUMNS BLOCK - Multi-column layout with mobile stacking
// Uses container queries for responsive behavior in Builder
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';

interface ColumnsBlockProps {
  children?: React.ReactNode;
  columns?: number;
  gap?: number;
  stackOnMobile?: boolean;
  alignItems?: string;
}

export function ColumnsBlock({ 
  children, 
  columns = 2, 
  gap = 16,
  stackOnMobile = true,
  alignItems = 'stretch',
}: ColumnsBlockProps) {
  return (
    <div 
      className={cn(
        'grid',
        // Use sf-columns-stack for container query based stacking
        stackOnMobile && 'sf-columns-stack'
      )}
      style={{ 
        // Desktop: use grid columns
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap}px`,
        alignItems: alignItems,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
