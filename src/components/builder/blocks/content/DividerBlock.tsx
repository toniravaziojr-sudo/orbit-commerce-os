// =============================================
// DIVIDER BLOCK - Horizontal line separator
// =============================================

import React from 'react';

interface DividerBlockProps {
  style?: string;
  color?: string;
  thickness?: number;
}

export function DividerBlock({ style, color, thickness }: DividerBlockProps) {
  return (
    <hr 
      className="my-4"
      style={{ 
        borderColor: color || 'hsl(var(--border))',
        borderWidth: `${thickness || 1}px`,
        borderStyle: (style as any) || 'solid',
      }}
    />
  );
}
