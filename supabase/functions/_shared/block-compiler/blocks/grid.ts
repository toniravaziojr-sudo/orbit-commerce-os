// =============================================
// GRID BLOCK COMPILER — Block compiler for Grid
// Renders a responsive grid layout
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';

export const gridToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
  childrenHtml?: string,
): string => {
  const columns = (props.columns as number) || 3;
  const gap = (props.gap as number) ?? 16;
  const minChildWidth = (props.minChildWidth as string) || '250px';

  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${minChildWidth},1fr));gap:${gap}px;">${childrenHtml || ''}</div>`;
};
