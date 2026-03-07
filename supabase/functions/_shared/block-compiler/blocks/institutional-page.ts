// =============================================
// INSTITUTIONAL PAGE COMPILER
// Mirrors: src/pages/storefront/StorefrontPage.tsx
// =============================================

import { escapeHtml } from '../utils.ts';

export function institutionalPageToStaticHTML(page: any): string {
  const pageBody = page.body_html || page.description || '';
  
  return `
    <div style="max-width:800px;margin:0 auto;padding:48px 16px;">
      <h1 style="font-size:clamp(24px,4vw,36px);font-weight:700;font-family:var(--sf-heading-font);margin-bottom:24px;line-height:1.3;">${escapeHtml(page.title)}</h1>
      ${pageBody ? `<div style="font-size:15px;line-height:1.8;color:var(--theme-text-secondary,#444);">${pageBody}</div>` : ''}
    </div>`;
}
