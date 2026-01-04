// =============================================
// CONTAINER BLOCK - Container with max-width constraint
// =============================================

import React from 'react';

interface ContainerBlockProps {
  children?: React.ReactNode;
  maxWidth?: string;
  padding?: number;
  marginTop?: number;
  marginBottom?: number;
  gap?: number;
}

export function ContainerBlock({ 
  children, 
  maxWidth = '1200',
  padding = 16,
  marginTop = 0,
  marginBottom = 0,
  gap = 16,
}: ContainerBlockProps) {
  const maxWidthMap: Record<string, string> = {
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
    'full': '100%',
  };

  return (
    <div 
      className="mx-auto flex flex-col"
      style={{ 
        maxWidth: maxWidthMap[maxWidth] || `${maxWidth}px`,
        padding: `${padding}px`,
        marginTop: `${marginTop}px`,
        marginBottom: `${marginBottom}px`,
        gap: `${gap}px`,
      }}
    >
      {children}
    </div>
  );
}
