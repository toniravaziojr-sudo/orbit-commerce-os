// =============================================
// RICH TEXT BLOCK COMPILER
// Mirrors: src/components/builder/blocks/content/RichTextBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';

function sanitizeContent(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s*on\w+=["'][^"']*["']/gi, '');
}

export function richTextToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext
): string {
  const content = (props.content as string) || '';
  
  return `<div class="sf-rich-text prose max-w-none">${sanitizeContent(content)}</div>`;
}
