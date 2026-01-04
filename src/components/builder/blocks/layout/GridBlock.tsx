// =============================================
// GRID BLOCK - CSS Grid container
// =============================================

import React from 'react';

interface GridBlockProps {
  children?: React.ReactNode;
  columns?: number;
  gap?: number;
}

export function GridBlock({ children, columns, gap }: GridBlockProps) {
  return (
    <div 
      className="grid"
      style={{ 
        gridTemplateColumns: `repeat(${columns || 2}, minmax(0, 1fr))`,
        gap: `${gap || 16}px`
      }}
    >
      {children}
    </div>
  );
}
