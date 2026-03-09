// =============================================
// COLUMN BLOCK COMPILER — Block compiler for Column
// Mirrors: src/components/builder/blocks/layout/ColumnBlock.tsx
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';

export const columnToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
  childrenHtml?: string,
): string => {
  const span = (props.span as number) || 1;
  return `<div style="grid-column:span ${span};">${childrenHtml || ''}</div>`;
};
