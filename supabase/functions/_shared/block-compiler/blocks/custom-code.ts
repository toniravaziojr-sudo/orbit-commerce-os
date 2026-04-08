// =============================================
// CUSTOM CODE BLOCK COMPILER — Unified (CustomBlock + HTMLSection)
// Alias compiler: normalizes props and delegates to html-section compiler
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { htmlSectionToStaticHTML } from './html-section.ts';

export const customCodeToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
  childrenHtml?: string,
): string => {
  const source = (props.source as string) || 'inline';

  if (source === 'database') {
    // Database blocks are resolved at runtime (pre-fetched HTML/CSS)
    // The htmlContent/cssContent should have been pre-populated
    const htmlContent = (props.htmlContent as string) || '';
    const cssContent = (props.cssContent as string) || '';
    if (!htmlContent) return '';
    return htmlSectionToStaticHTML({ htmlContent, cssContent }, context);
  }

  // Inline mode: delegate directly
  return htmlSectionToStaticHTML(props, context, childrenHtml);
};
