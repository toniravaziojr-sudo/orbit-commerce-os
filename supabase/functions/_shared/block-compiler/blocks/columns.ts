// =============================================
// COLUMNS BLOCK COMPILER — Block compiler for Columns
// Renders a responsive multi-column grid layout
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';

export const columnsToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
  childrenHtml?: string,
): string => {
  const columns = (props.columns as number) || 2;
  const gap = (props.gap as number) ?? 16;

  return `<div style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:${gap}px;">${childrenHtml || ''}</div>`;
};
