// =============================================
// DIVIDER BLOCK COMPILER
// Mirrors: src/components/builder/blocks/content/DividerBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';

export function dividerToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext
): string {
  const style = (props.style as string) || 'solid';
  const color = (props.color as string) || 'var(--theme-border-color, #e5e7eb)';
  const thickness = (props.thickness as number) || 1;

  return `<hr class="sf-divider" style="margin:1rem 0;border-color:${color};border-width:${thickness}px;border-style:${style};">`;
}
