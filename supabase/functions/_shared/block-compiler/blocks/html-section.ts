// =============================================
// HTML SECTION BLOCK COMPILER
// Mirrors: src/components/builder/blocks/HTMLSectionBlock.tsx
// Renders sanitized custom HTML inline (no iframe needed in edge)
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';

function sanitizeHtml(html: string): string {
  if (!html) return '';
  let s = html;
  // Remove script tags
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove event handlers
  s = s.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  s = s.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
  // Remove javascript: URLs
  s = s.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  s = s.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  return s;
}

export const htmlSectionToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const htmlContent = (props.htmlContent as string) || (props.htmlDesktop as string) || '';
  const cssContent = (props.cssContent as string) || '';

  const sanitized = sanitizeHtml(htmlContent);
  if (!sanitized) return '';

  // Render inline with scoped CSS
  const cssBlock = cssContent ? `<style>${cssContent}</style>` : '';

  return `<div class="sf-html-section">${cssBlock}${sanitized}</div>`;
};
