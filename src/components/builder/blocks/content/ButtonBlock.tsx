// =============================================
// BUTTON BLOCK - Styled button with customizable colors
// =============================================

import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonBlockProps {
  text?: string;
  url?: string;
  variant?: string;
  size?: string;
  alignment?: string;
  fontFamily?: string;
  fontWeight?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  hoverBgColor?: string;
  hoverTextColor?: string;
  borderColor?: string;
  hoverBorderColor?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
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

// Default variant colors - Use theme CSS variables instead of raw --primary
const variantColors: Record<string, { bg: string; text: string; border?: string }> = {
  primary: { bg: 'var(--theme-button-primary-bg, #1a1a1a)', text: 'var(--theme-button-primary-text, #ffffff)' },
  secondary: { bg: 'var(--theme-button-secondary-bg, #f5f5f5)', text: 'var(--theme-button-secondary-text, #1a1a1a)' },
  outline: { bg: 'transparent', text: 'var(--theme-button-primary-bg, #1a1a1a)', border: 'var(--theme-button-primary-bg, #1a1a1a)' },
  ghost: { bg: 'transparent', text: 'var(--theme-button-primary-bg, #1a1a1a)' },
};

export function ButtonBlock({ 
  text, 
  url, 
  variant, 
  size, 
  alignment = 'left',
  fontFamily,
  fontWeight = 'semibold',
  backgroundColor, 
  textColor, 
  borderRadius = 'md',
  hoverBgColor,
  hoverTextColor,
  borderColor,
  hoverBorderColor,
}: ButtonBlockProps) {
  const alignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[alignment] || 'justify-start';

  // Generate unique ID for CSS custom properties
  const btnId = `btn-${Math.random().toString(36).substr(2, 9)}`;

  // Determine colors based on variant or custom
  const hasCustomStyles = backgroundColor || textColor;
  
  const variantStyle = variantColors[variant || 'primary'] || variantColors.primary;
  const baseBg = backgroundColor || variantStyle.bg;
  const baseText = textColor || variantStyle.text;
  const baseBorder = borderColor || variantStyle.border || 'transparent';
  const hoverBg = hoverBgColor || (hasCustomStyles ? baseBg : undefined);
  const hoverText = hoverTextColor || (hasCustomStyles ? baseText : undefined);
  const hoverBorder = hoverBorderColor || baseBorder;

  return (
    <div className={cn('flex', alignmentClass)}>
      <style>{`
        .${btnId} {
          background-color: ${baseBg};
          color: ${baseText};
          border: 1px solid ${baseBorder};
        }
        .${btnId}:hover {
          ${hoverBg ? `background-color: ${hoverBg};` : 'opacity: 0.9;'}
          ${hoverText ? `color: ${hoverText};` : ''}
          ${hoverBorder ? `border-color: ${hoverBorder};` : ''}
        }
      `}</style>
      <a 
        href={url || '#'}
        className={cn(
          btnId,
          'inline-block transition-colors',
          sizeClasses[size || 'md'] || sizeClasses.md
        )}
        style={{
          borderRadius: radiusMap[borderRadius] || '0.5rem',
          fontFamily: fontFamily || 'inherit',
          fontWeight: fontWeightMap[fontWeight] || '600',
        }}
      >
        {text || 'Botão'}
      </a>
    </div>
  );
}
