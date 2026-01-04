// =============================================
// PAGE BLOCK - Root container for page content
// =============================================

import React from 'react';

interface PageBlockProps {
  children?: React.ReactNode;
  backgroundColor?: string;
}

/**
 * PageBlock - Root container for page content
 * 
 * IMPORTANT: This block renders children directly without manipulation.
 * DO NOT insert content by children index here.
 * 
 * For injecting content at specific positions (e.g., after header, before footer),
 * use slots (afterHeaderSlot, afterContentSlot) passed via BlockRenderContext
 * and rendered in PublicTemplateRenderer.tsx.
 */
export function PageBlock({ children, backgroundColor }: PageBlockProps) {
  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ backgroundColor }}
    >
      {children}
    </div>
  );
}
