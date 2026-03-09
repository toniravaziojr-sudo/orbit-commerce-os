// =============================================
// CONTAINER BLOCK COMPILER — Block compiler for Container
// Mirrors: src/components/builder/blocks/layout/ContainerBlock.tsx
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';

const maxWidthMap: Record<string, string> = {
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
  'full': '100%',
};

export const containerToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
  childrenHtml?: string,
): string => {
  const maxWidth = (props.maxWidth as string) || '1200';
  const padding = (props.padding as number) ?? 16;
  const marginTop = (props.marginTop as number) ?? 0;
  const marginBottom = (props.marginBottom as number) ?? 0;
  const gap = (props.gap as number) ?? 16;

  const resolvedMaxWidth = maxWidthMap[maxWidth] || `${maxWidth}px`;

  return `<div style="max-width:${resolvedMaxWidth};margin-left:auto;margin-right:auto;padding:${padding}px;margin-top:${marginTop}px;margin-bottom:${marginBottom}px;display:flex;flex-direction:column;gap:${gap}px;">${childrenHtml || ''}</div>`;
};
