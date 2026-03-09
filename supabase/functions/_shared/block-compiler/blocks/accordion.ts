// =============================================
// ACCORDION BLOCK COMPILER — Generic accordion
// Mirrors: src/components/builder/blocks/AccordionBlock.tsx
// Uses native <details>/<summary> for zero-JS
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

interface AccordionItemData {
  id?: string;
  title: string;
  content: string;
}

export const accordionToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = props.title as string | undefined;
  const subtitle = props.subtitle as string | undefined;
  const rawItems = props.items;
  const items: AccordionItemData[] = Array.isArray(rawItems) ? rawItems : [];
  const variant = (props.variant as string) || 'default';
  const defaultOpen = (props.defaultOpen as number) ?? -1;
  const backgroundColor = (props.backgroundColor as string) || 'transparent';

  if (items.length === 0) return '';

  const variantItemStyle: Record<string, string> = {
    default: 'border-bottom:1px solid #e5e7eb;',
    separated: 'border:1px solid #e5e7eb;border-radius:0.5rem;padding:0 1rem;margin-bottom:0.75rem;background:#fff;',
    bordered: '',
  };

  const containerExtra = variant === 'bordered' ? 'border:1px solid #e5e7eb;border-radius:0.5rem;' : '';

  const itemsHtml = items.map((item, i) => {
    const isOpen = i === defaultOpen ? ' open' : '';
    const itemStyle = variantItemStyle[variant] || variantItemStyle.default;
    return `<details class="sf-acc-item" style="${itemStyle}"${isOpen}>
  <summary class="sf-acc-q flex items-center justify-between py-4 font-medium cursor-pointer select-none list-none" style="padding:1rem 0;font-weight:500;"><span style="padding-right:1rem;">${escapeHtml(item.title)}</span><svg class="sf-acc-chevron" style="width:16px;height:16px;flex-shrink:0;transition:transform .2s;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></summary>
  <div style="padding-bottom:1rem;color:#666;font-size:0.875rem;">${item.content}</div>
</details>`;
  }).join('\n');

  const headerHtml = (title || subtitle) ? `<div style="text-align:center;margin-bottom:2rem;">
  ${title ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">${escapeHtml(title)}</h2>` : ''}
  ${subtitle ? `<p style="color:#888;">${escapeHtml(subtitle)}</p>` : ''}
</div>` : '';

  return `<section style="padding:2.5rem 1rem;background:${backgroundColor};">
  <div style="max-width:768px;margin:0 auto;${containerExtra}">
    ${headerHtml}
    ${itemsHtml}
  </div>
  <style>.sf-acc-q::-webkit-details-marker{display:none}.sf-acc-item[open] .sf-acc-chevron{transform:rotate(180deg)}</style>
</section>`;
};
