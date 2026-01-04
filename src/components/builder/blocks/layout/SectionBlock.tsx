// =============================================
// SECTION BLOCK - Section container with padding and styling
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';

interface SectionBlockProps {
  children?: React.ReactNode;
  backgroundColor?: string;
  paddingX?: number;
  paddingY?: number;
  marginTop?: number;
  marginBottom?: number;
  gap?: number;
  alignItems?: string;
  fullWidth?: boolean;
}

export function SectionBlock({ 
  children, 
  backgroundColor, 
  paddingX = 16, 
  paddingY = 32, 
  marginTop = 0,
  marginBottom = 0,
  gap = 16,
  alignItems = 'stretch',
  fullWidth 
}: SectionBlockProps) {
  return (
    <section 
      className={cn(
        'flex flex-col',
        fullWidth ? 'w-full' : 'container mx-auto',
      )}
      style={{ 
        backgroundColor: backgroundColor || 'transparent',
        paddingTop: `${paddingY}px`,
        paddingBottom: `${paddingY}px`,
        paddingLeft: `${paddingX}px`,
        paddingRight: `${paddingX}px`,
        marginTop: `${marginTop}px`,
        marginBottom: `${marginBottom}px`,
        gap: `${gap}px`,
        alignItems: alignItems,
      }}
    >
      {children}
    </section>
  );
}
