// =============================================
// BUTTON BLOCK COMPILER
// Mirrors: src/components/builder/blocks/content/ButtonBlock.tsx
// Uses global sf-btn-* classes for theme parity
// =============================================

import type { CompilerContext } from '../types.ts';

const sizeClasses: Record<string, string> = {
  sm: 'sf-btn-sm',
  md: 'sf-btn-md',
  lg: 'sf-btn-lg',
};

const radiusMap: Record<string, string> = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '1rem',
  full: '9999px',
};

const fontWeightMap: Record<string, string> = {
  normal: '400',
  '500': '500',
  semibold: '600',
  bold: '700',
};

const alignmentClass: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

export function buttonToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext
): string {
  const text = (props.text as string) || 'Botão';
  const url = (props.url as string) || '#';
  const variant = (props.variant as string) || 'primary';
  const size = (props.size as string) || 'md';
  const alignment = (props.alignment as string) || 'left';
  const fontFamily = (props.fontFamily as string) || 'inherit';
  const fontWeight = (props.fontWeight as string) || 'semibold';
  const borderRadius = (props.borderRadius as string) || 'md';
  
  // Custom colors (optional overrides)
  const backgroundColor = props.backgroundColor as string;
  const textColor = props.textColor as string;
  const borderColor = props.borderColor as string;

  const variantClass = `sf-btn-${variant}`;
  const sizeClass = sizeClasses[size] || 'sf-btn-md';
  const alignClass = alignmentClass[alignment] || 'justify-start';

  // Build inline style for custom overrides only
  let inlineStyle = `border-radius:${radiusMap[borderRadius] || '0.5rem'};font-family:${fontFamily};font-weight:${fontWeightMap[fontWeight] || '600'};`;
  
  if (backgroundColor) inlineStyle += `background-color:${backgroundColor};`;
  if (textColor) inlineStyle += `color:${textColor};`;
  if (borderColor) inlineStyle += `border-color:${borderColor};`;

  return `<div class="flex ${alignClass}"><a href="${url}" class="sf-btn ${variantClass} ${sizeClass}" style="${inlineStyle}">${text}</a></div>`;
}
