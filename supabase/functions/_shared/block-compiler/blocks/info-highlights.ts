// =============================================
// INFO HIGHLIGHTS BLOCK COMPILER
// Mirrors: src/components/builder/blocks/InfoHighlightsBlock.tsx
// =============================================
// KEY PARITY POINTS from React component:
// - Section has border-y and bg-muted/20 background
// - Icons rendered in a rounded circle bg
// - flex gap-3 per item (icon + text side by side)
// - Horizontal: row wrap centered; Vertical: column
// - Responsive: all icons from React iconMap must be supported
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

interface HighlightItem {
  id?: string;
  icon: string;
  title: string;
  description?: string;
}

// SVG icons matching ALL lucide-react icons from the React component's iconMap
const ICON_SVG: Record<string, string> = {
  Truck: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="11" x="1" y="3" rx="2"/><path d="M17 3h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/></svg>',
  CreditCard: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="22" height="16" x="1" y="4" rx="2"/><line x1="1" x2="23" y1="10" y2="10"/></svg>',
  Shield: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  Clock: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  Phone: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  Gift: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/></svg>',
  Award: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
  ThumbsUp: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
  Star: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  Heart: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  Package: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  Zap: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  CheckCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  ShoppingBag: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  Percent: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  MapPin: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  Mail: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  HelpCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  Info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  AlertCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
};

// Case-insensitive + underscore alias lookup
function getIconSvg(icon: string): string {
  // Direct match
  if (ICON_SVG[icon]) return ICON_SVG[icon];
  // Try PascalCase from snake_case
  const pascal = icon.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
  if (ICON_SVG[pascal]) return ICON_SVG[pascal];
  // Fallback to Shield
  return ICON_SVG['Shield'];
}

export function infoHighlightsToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
): string {
  const items = (Array.isArray(props.items) ? props.items : []) as HighlightItem[];
  const iconColor = (props.iconColor as string) || 'var(--theme-text-primary, #1a1a1a)';
  const textColor = (props.textColor as string) || 'var(--theme-text-primary, #1f2937)';
  const layout = (props.layout as string) || 'horizontal';

  if (items.length === 0) return '';

  const isHorizontal = layout === 'horizontal';

  const itemsHtml = items.map(item => {
    const svg = getIconSvg(item.icon);
    return `<div style="display:flex;align-items:center;gap:12px;${isHorizontal ? 'flex:1;min-width:200px;justify-content:center;' : 'width:100%;'}">
      <div style="flex-shrink:0;padding:8px;border-radius:9999px;background:var(--theme-bg-primary,#fff);color:${escapeHtml(iconColor)};">
        ${svg}
      </div>
      <div>
        <p style="font-size:14px;font-weight:500;color:${escapeHtml(textColor)};">${escapeHtml(item.title)}</p>
        ${item.description ? `<p style="font-size:12px;color:var(--theme-text-secondary, #6b7280);margin-top:2px;">${escapeHtml(item.description)}</p>` : ''}
      </div>
    </div>`;
  }).join('');

  // React component uses: py-6 border-y bg-muted/20
  return `<section class="sf-info-highlights" style="padding:24px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;background:rgba(0,0,0,0.02);">
    <div style="max-width:1280px;margin:0 auto;padding:0 16px;">
      <div style="display:flex;${isHorizontal ? 'flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:center;' : 'flex-direction:column;align-items:flex-start;'}gap:24px;">
        ${itemsHtml}
      </div>
    </div>
    <style>@media(max-width:768px){.sf-info-highlights{padding:8px 0 !important;}.sf-info-highlights [style*="gap:24px"]{gap:6px 8px !important;}.sf-info-highlights [style*="min-width:200px"]{min-width:0 !important;flex:0 0 calc(50% - 4px) !important;gap:6px !important;}.sf-info-highlights [style*="min-width:200px"] svg{width:16px !important;height:16px !important;}.sf-info-highlights [style*="min-width:200px"] [style*="padding:8px"]{padding:5px !important;}.sf-info-highlights [style*="min-width:200px"] [style*="font-size:14px"]{font-size:11px !important;}.sf-info-highlights [style*="min-width:200px"] [style*="font-size:12px"]{font-size:10px !important;}}</style>
  </section>`;
}
