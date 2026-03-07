// =============================================
// INFO HIGHLIGHTS BLOCK COMPILER
// Mirrors: src/components/builder/blocks/InfoHighlightsBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

interface HighlightItem {
  id?: string;
  icon: string;
  title: string;
  description?: string;
}

// SVG icons matching lucide-react icon set used in the React component
const ICON_SVG: Record<string, string> = {
  truck: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="11" x="1" y="3" rx="2"/><path d="M17 3h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/></svg>',
  Truck: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="11" x="1" y="3" rx="2"/><path d="M17 3h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/></svg>',
  shield: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  Shield: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  CreditCard: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="22" height="16" x="1" y="4" rx="2"/><line x1="1" x2="23" y1="10" y2="10"/></svg>',
  credit_card: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="22" height="16" x="1" y="4" rx="2"/><line x1="1" x2="23" y1="10" y2="10"/></svg>',
  Clock: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  clock: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  Gift: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/></svg>',
  gift: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/></svg>',
};

function getIconSvg(icon: string): string {
  return ICON_SVG[icon] || ICON_SVG['shield'] || '';
}

export function infoHighlightsToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
): string {
  const items = (Array.isArray(props.items) ? props.items : []) as HighlightItem[];
  const iconColor = (props.iconColor as string) || 'var(--theme-button-primary-bg, #1a1a1a)';
  const textColor = (props.textColor as string) || 'var(--theme-text-primary, #1a1a1a)';
  const layout = (props.layout as string) || 'horizontal';

  if (items.length === 0) return '';

  const isHorizontal = layout === 'horizontal';
  const itemsHtml = items.map(item => {
    const svg = getIconSvg(item.icon);
    return `<div style="display:flex;${isHorizontal ? 'flex-direction:row;' : 'flex-direction:column;'}align-items:center;gap:12px;text-align:${isHorizontal ? 'left' : 'center'};">
      <div style="color:${escapeHtml(iconColor)};flex-shrink:0;">${svg}</div>
      <div>
        <p style="font-size:14px;font-weight:600;color:${escapeHtml(textColor)};">${escapeHtml(item.title)}</p>
        ${item.description ? `<p style="font-size:12px;color:#666;margin-top:2px;">${escapeHtml(item.description)}</p>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<section style="max-width:1280px;margin:0 auto;padding:24px 16px;">
    <div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">
      ${itemsHtml}
    </div>
  </section>`;
}
