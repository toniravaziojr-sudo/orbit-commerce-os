// =============================================
// SPACER BLOCK - Vertical spacing
// =============================================

import React from 'react';

interface SpacerBlockProps {
  height?: string | number;
}

const heightMap: Record<string, number> = {
  xs: 8,
  sm: 16,
  md: 32,
  lg: 48,
  xl: 64,
};

export function SpacerBlock({ height }: SpacerBlockProps) {
  const heightValue = typeof height === 'string' && heightMap[height] 
    ? heightMap[height] 
    : (height || 32);
  
  return <div style={{ height: `${heightValue}px` }} />;
}
