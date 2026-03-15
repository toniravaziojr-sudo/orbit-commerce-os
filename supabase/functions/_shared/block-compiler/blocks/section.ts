// =============================================
// SECTION BLOCK COMPILER
// Mirrors: src/components/builder/blocks/layout/SectionBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';

export function sectionToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
  children?: string
): string {
  const backgroundColor = (props.backgroundColor as string) || 'transparent';
  const paddingX = (props.paddingX as number) ?? 0;
  const paddingY = (props.paddingY as number) ?? 0;
  const marginTop = (props.marginTop as number) ?? 0;
  const marginBottom = (props.marginBottom as number) ?? 0;
  const gap = (props.gap as number) ?? 16;
  const alignItems = (props.alignItems as string) || 'stretch';
  const fullWidth = props.fullWidth as boolean;
  
  const containerClass = fullWidth ? 'width:100%;' : 'max-width:1280px;margin-left:auto;margin-right:auto;';
  
  return `<section style="display:flex;flex-direction:column;${containerClass}background-color:${backgroundColor};padding:${paddingY}px ${paddingX}px;margin-top:${marginTop}px;margin-bottom:${marginBottom}px;gap:${gap}px;align-items:${alignItems};">${children || ''}</section>`;
}
