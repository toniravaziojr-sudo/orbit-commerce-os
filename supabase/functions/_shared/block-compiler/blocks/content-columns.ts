// =============================================
// CONTENT COLUMNS BLOCK COMPILER
// Mirrors: src/components/builder/blocks/ContentColumnsBlock.tsx
// Image + Text side by side with features list
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

// SVG icons for feature list (matching lucide icons used in React)
const ICON_SVG: Record<string, string> = {
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  checkcircle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
  zap: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
  star: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  truck: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
  clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  gift: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>',
  award: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
  percent: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
};

function getIconSvg(iconName: string): string {
  const key = iconName.toLowerCase().replace(/_/g, '');
  return ICON_SVG[key] || ICON_SVG.check;
}

interface FeatureItem {
  id?: string;
  icon: string;
  text: string;
}

export const contentColumnsToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const subtitle = (props.subtitle as string) || '';
  const content = (props.content as string) || '';
  const imageDesktop = (props.imageDesktop as string) || '';
  const imagePosition = (props.imagePosition as string) || 'left';
  const features = (props.features as FeatureItem[]) || [];
  const iconColor = (props.iconColor as string) || '';
  const showButton = !!props.showButton;
  const buttonText = (props.buttonText as string) || 'Saiba mais';
  const buttonUrl = (props.buttonUrl as string) || '#';
  const backgroundColor = (props.backgroundColor as string) || 'transparent';
  const textColor = (props.textColor as string) || '';

  const effectiveIconColor = iconColor || 'var(--theme-accent-color, #22c55e)';
  const imgSrc = optimizeImageUrl(imageDesktop, 600, 85);
  const textStyle = textColor ? `color:${textColor};` : '';

  const imageCol = imgSrc ? `
    <div style="flex:1;min-width:0;">
      <img src="${imgSrc}" alt="${escapeHtml(title || 'Imagem')}" style="width:100%;height:auto;border-radius:0.5rem;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);object-fit:cover;" loading="lazy" />
    </div>` : '';

  const featuresHtml = features.length > 0 ? `
    <ul style="list-style:none;padding:0;margin:0 0 1rem 0;display:flex;flex-direction:column;gap:0.5rem;">
      ${features.map(f => `
        <li style="display:flex;align-items:flex-start;gap:0.5rem;">
          <span style="flex-shrink:0;margin-top:0.125rem;color:${effectiveIconColor};">${getIconSvg(f.icon)}</span>
          <span style="font-size:0.875rem;${textStyle}">${escapeHtml(f.text)}</span>
        </li>`).join('')}
    </ul>` : '';

  const ctaHtml = showButton && buttonText ? `
    <div><a href="${escapeHtml(buttonUrl)}" class="sf-btn-primary" style="display:inline-flex;align-items:center;justify-content:center;padding:0.75rem 1.5rem;border-radius:0.5rem;font-weight:600;text-decoration:none;">${escapeHtml(buttonText)}</a></div>` : '';

  const contentCol = `
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;">
      ${title ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.75rem;${textStyle}">${escapeHtml(title)}</h2>` : ''}
      ${subtitle ? `<p style="font-size:1.125rem;color:#666;margin-bottom:1rem;">${escapeHtml(subtitle)}</p>` : ''}
      ${content ? `<div style="margin-bottom:1rem;${textStyle}">${content}</div>` : ''}
      ${featuresHtml}
      ${ctaHtml}
    </div>`;

  const order = imagePosition === 'right' ? 'flex-direction:row-reverse;' : '';

  return `
    <section style="background-color:${backgroundColor};padding:3rem 1rem;">
      <div style="max-width:72rem;margin:0 auto;">
        <div style="display:flex;gap:2rem;align-items:center;${order}" class="sf-content-columns">
          ${imageCol}
          ${contentCol}
        </div>
      </div>
    </section>
    <style>@media(max-width:767px){.sf-content-columns{flex-direction:column!important;}}</style>`;
};
