// =============================================
// COLUMNS BLOCK - Multi-column layout with mobile stacking
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
        stackOnMobile && 'grid-cols-1 md:grid-cols-[var(--cols)]'
      )}
      style={{ 
        '--cols': `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateColumns: stackOnMobile ? undefined : `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap}px`,
        alignItems: alignItems,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
