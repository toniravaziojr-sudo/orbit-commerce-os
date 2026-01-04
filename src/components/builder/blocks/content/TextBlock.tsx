// =============================================
// TEXT BLOCK - Basic text with sanitization
// =============================================

import React from 'react';

interface TextBlockProps {
  content?: string;
  align?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
}

// CRITICAL: Sanitize content to prevent CSS leakage
function sanitizeContent(html: string): string {
  if (!html) return '<p>Texto de exemplo</p>';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s*style=["'][^"']*["']/gi, '')
    .replace(/\s*on\w+=["'][^"']*["']/gi, '');
}

export function TextBlock({ content, align, fontSize, fontWeight, color }: TextBlockProps) {
  return (
    <div 
      className="prose max-w-none"
      style={{ 
        textAlign: (align as any) || 'left',
        fontSize: fontSize || '16px',
        fontWeight: fontWeight || 'normal',
        color: color || 'inherit',
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeContent(content || '') }}
    />
  );
}
