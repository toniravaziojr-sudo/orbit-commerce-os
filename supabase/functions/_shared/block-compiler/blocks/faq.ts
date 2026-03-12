// =============================================
// FAQ BLOCK COMPILER — Frequently Asked Questions
// Mirrors: src/components/builder/blocks/interactive/FAQBlock.tsx
// Uses native <details>/<summary> for zero-JS accordion
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

interface FAQItem {
  question?: string;
  answer?: string;
}

function stripHtmlTags(value: string): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const faqToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || 'Perguntas Frequentes';
  const rawItems = props.items;
  const items: FAQItem[] = Array.isArray(rawItems) ? rawItems : [];

  if (items.length === 0) return '';

  const itemsHtml = items.map((item, i) => {
    const q = escapeHtml(stripHtmlTags(item.question || ''));
    const a = escapeHtml(stripHtmlTags(item.answer || ''));
    if (!q) return '';
    return `<details class="sf-faq-item border-b">
  <summary class="sf-faq-q flex items-center justify-between py-4 font-medium cursor-pointer select-none list-none">${q}<svg class="sf-faq-chevron w-4 h-4 shrink-0 transition-transform duration-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></summary>
  <div class="pb-4 text-sm" style="color:var(--theme-text-secondary, #666);">${a}</div>
</details>`;
  }).filter(Boolean).join('\n');

  return `<section class="py-8" style="max-width:900px;margin:0 auto;padding-left:16px;padding-right:16px;">
  ${title ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem;">${escapeHtml(title)}</h2>` : ''}
  <div class="sf-faq-list">${itemsHtml}</div>
  <style>.sf-faq-q::-webkit-details-marker{display:none}.sf-faq-item[open] .sf-faq-chevron{transform:rotate(180deg)}</style>
</section>`;
};
