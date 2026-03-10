// =============================================
// STATS NUMBERS BLOCK COMPILER
// Mirrors: src/components/builder/blocks/StatsNumbersBlock.tsx
// Renders stats with optional JS animation on scroll
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

interface StatItem {
  id?: string;
  number: string;
  label: string;
  prefix?: string;
  suffix?: string;
}

export const statsNumbersToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const subtitle = (props.subtitle as string) || '';
  const items = (props.items as StatItem[]) || [];
  const layout = (props.layout as string) || 'horizontal';
  const animateNumbers = props.animateNumbers !== false;
  const backgroundColor = (props.backgroundColor as string) || 'transparent';
  const accentColor = (props.accentColor as string) || '';
  const textColor = (props.textColor as string) || '';

  if (items.length === 0) return '';

  const effectiveAccent = accentColor || 'var(--theme-button-primary-bg, #1a1a1a)';
  const effectiveText = textColor || 'var(--theme-text-secondary, #666)';
  const isGrid = layout === 'grid' || items.length > 4;

  const headerHtml = (title || subtitle) ? `
    <div style="text-align:center;margin-bottom:2.5rem;">
      ${title ? `<h2 style="font-size:1.5rem;font-weight:700;color:inherit;margin-bottom:0.5rem;">${escapeHtml(title)}</h2>` : ''}
      ${subtitle ? `<p style="color:var(--theme-text-secondary, #666);">${escapeHtml(subtitle)}</p>` : ''}
    </div>` : '';

  const itemsHtml = items.map((item, i) => {
    const dataVal = escapeHtml(item.number);
    return `
      <div style="text-align:center;${!isGrid ? 'padding:0 1.5rem;' : ''}">
        <div style="font-size:1.875rem;font-weight:700;margin-bottom:0.5rem;color:${effectiveAccent};" ${animateNumbers ? `data-sf-stat-value="${dataVal}"` : ''}>
          ${item.prefix ? escapeHtml(item.prefix) : ''}${escapeHtml(item.number)}${item.suffix ? escapeHtml(item.suffix) : ''}
        </div>
        <p style="font-size:0.875rem;color:${effectiveText};">${escapeHtml(item.label)}</p>
      </div>`;
  }).join('');

  const containerStyle = isGrid
    ? 'display:grid;grid-template-columns:repeat(2,1fr);gap:1.5rem;'
    : 'display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;gap:1.5rem;';

  return `
    <section style="background-color:${backgroundColor};padding:3rem 1rem;" ${animateNumbers ? 'data-sf-stats' : ''}>
      <div style="max-width:72rem;margin:0 auto;">
        ${headerHtml}
        <div style="${containerStyle}" class="sf-stats-container">
          ${itemsHtml}
        </div>
      </div>
    </section>
    <style>@media(min-width:768px){.sf-stats-container{${isGrid ? 'grid-template-columns:repeat(4,1fr);' : ''}}}</style>`;
};
