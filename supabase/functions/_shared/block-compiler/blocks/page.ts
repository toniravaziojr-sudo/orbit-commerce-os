// =============================================
// PAGE BLOCK COMPILER — Root container
// Mirrors: src/components/builder/blocks/layout/PageBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';

export function pageToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
  children?: string
): string {
  const backgroundColor = props.backgroundColor as string || '';
  const bgStyle = backgroundColor ? `background-color:${backgroundColor};` : '';
  
  return `<div style="min-height:100vh;display:flex;flex-direction:column;${bgStyle}">${children || ''}</div>`;
}
