// =============================================
// TEXT BLOCK COMPILER
// Mirrors: src/components/builder/blocks/content/TextBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';

function sanitizeContent(html: string): string {
  if (!html) return '<p>Texto de exemplo</p>';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s*style=["'][^"']*["']/gi, '')
    .replace(/\s*on\w+=["'][^"']*["']/gi, '');
}

export function textToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext
): string {
  const content = (props.content as string) || '';
  const align = (props.align as string) || 'left';
  const fontSize = (props.fontSize as string) || '16px';
  const fontWeight = (props.fontWeight as string) || 'normal';
  const color = (props.color as string) || 'inherit';

  return `<div class="sf-text-block" style="text-align:${align};font-size:${fontSize};font-weight:${fontWeight};color:${color};">${sanitizeContent(content)}</div>`;
}
