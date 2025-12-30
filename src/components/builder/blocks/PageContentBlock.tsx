// =============================================
// PAGE CONTENT BLOCK - Renders the individual page content (text/HTML)
// This is a placeholder block used in templates to indicate where page content goes
// =============================================

import React from 'react';
import { BlockRenderContext } from '@/lib/builder/types';

interface PageContentBlockProps {
  context?: BlockRenderContext;
  // The actual content is passed via context.pageContent
}

export function PageContentBlock({ context }: PageContentBlockProps) {
  const content = context?.pageContent || '';
  
  // If no content, show placeholder in preview/editor mode
  if (!content) {
    if (context?.isPreview !== false) {
      return (
        <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
          <div className="text-center text-muted-foreground">
            <p className="font-medium">Conteúdo da Página</p>
            <p className="text-sm">O texto individual da página aparecerá aqui</p>
          </div>
        </div>
      );
    }
    return null;
  }

  // Render the actual content
  return (
    <div 
      className="prose prose-lg max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

export default PageContentBlock;
