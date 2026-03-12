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
  const sanitized = sanitizeContent(content);
  
  return `<div class="sf-rich-text">${sanitized}</div>
<style>
  .sf-rich-text{max-width:100%;line-height:1.75;color:var(--theme-text,#111827)}
  .sf-rich-text h1{margin:0 0 1.5rem;text-align:center;font-size:2rem;font-weight:700;line-height:1.2}
  .sf-rich-text h2{margin:2.5rem 0 1rem;font-size:1.5rem;font-weight:600;line-height:1.3}
  .sf-rich-text h3{margin:2rem 0 .75rem;font-size:1.25rem;font-weight:600;line-height:1.35}
  .sf-rich-text p{margin:0 0 1rem;line-height:1.75}
  .sf-rich-text p+p{margin-top:.75rem}
  .sf-rich-text ul,.sf-rich-text ol{margin:1rem 0;padding-left:1.25rem}
  .sf-rich-text li{margin:.35rem 0;line-height:1.65}
  .sf-rich-text strong{font-weight:700}
  .sf-rich-text blockquote{margin:1.25rem 0;padding:.9rem 1rem;border-left:4px solid var(--theme-primary,#0ea5e9);background:var(--theme-bg-soft,#f8fafc);border-radius:.5rem}
</style>`;
}
