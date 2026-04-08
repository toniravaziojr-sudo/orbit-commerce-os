// =============================================
// CUSTOM CODE BLOCK - Unified block (CustomBlock + HTMLSection)
// source: 'inline' = HTML/CSS direto (ex-HTMLSection)
// source: 'database' = busca do custom_blocks (ex-CustomBlock)
// =============================================

import React from 'react';
import { CustomBlockRenderer } from '../CustomBlockRenderer';
import type { CustomCodeBlockProps } from './types';

export function CustomCodeBlock({
  source = 'inline',
  customBlockId,
  htmlContent,
  htmlDesktop,
  htmlMobile,
  cssContent = '',
  blockName,
  baseUrl,
  className,
  context,
  isEditing = false,
}: CustomCodeBlockProps) {
  if (source === 'database') {
    return (
      <CustomBlockRenderer
        customBlockId={customBlockId}
        htmlContent={htmlContent}
        cssContent={cssContent}
        blockName={blockName || 'Conteúdo Importado'}
        baseUrl={baseUrl}
        context={context}
        isEditing={isEditing}
      />
    );
  }

  // Inline mode: resolve desktop/mobile HTML
  const resolvedHtml = htmlContent || htmlDesktop || htmlMobile || '';

  return (
    <CustomBlockRenderer
      htmlContent={resolvedHtml}
      cssContent={cssContent}
      blockName={blockName || 'Código Customizado'}
      baseUrl={baseUrl}
      context={context}
      isEditing={isEditing}
    />
  );
}
