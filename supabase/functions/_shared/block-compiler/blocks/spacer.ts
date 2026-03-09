// =============================================
// SPACER BLOCK COMPILER
// Mirrors: src/components/builder/blocks/content/SpacerBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';

const heightMap: Record<string, number> = {
  xs: 8,
  sm: 16,
  md: 32,
  lg: 48,
  xl: 64,
};

export function spacerToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext
): string {
  const height = props.height;
  
  let heightValue: number;
  if (typeof height === 'string' && heightMap[height]) {
    heightValue = heightMap[height];
  } else if (typeof height === 'number') {
    heightValue = height;
  } else {
    heightValue = 32;
  }

  return `<div class="sf-spacer" style="height:${heightValue}px;"></div>`;
}
