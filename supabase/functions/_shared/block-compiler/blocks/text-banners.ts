// =============================================
// TEXT BANNERS BLOCK COMPILER
// Mirrors: src/components/builder/blocks/TextBannersBlock.tsx
// Text + 2 images side by side with CTA
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

export const textBannersToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || 'Título legal';
  const text = (props.text as string) || '';
  const imageDesktop1 = (props.imageDesktop1 as string) || '';
  const imageDesktop2 = (props.imageDesktop2 as string) || '';
  const ctaEnabled = props.ctaEnabled !== false;
  const ctaText = (props.ctaText as string) || 'Saiba mais';
  const ctaUrl = (props.ctaUrl as string) || '#';
  const ctaBgColor = (props.ctaBgColor as string) || '';
  const ctaTextColor = (props.ctaTextColor as string) || '';
  const layout = (props.layout as string) || 'text-left';

  const img1 = optimizeImageUrl(imageDesktop1, 400, 85);
  const img2 = optimizeImageUrl(imageDesktop2, 400, 85);

  const ctaStyle = ctaBgColor
    ? `background-color:${ctaBgColor};color:${ctaTextColor || '#fff'};`
    : '';

  const ctaHtml = ctaEnabled && ctaText ? `
    <div style="margin-top:1.5rem;">
      <a href="${escapeHtml(ctaUrl)}" class="sf-btn-primary" style="display:inline-flex;align-items:center;justify-content:center;padding:0.75rem 1.5rem;border-radius:0.375rem;font-weight:500;text-decoration:none;${ctaStyle}">${escapeHtml(ctaText)}</a>
    </div>` : '';

  const textContent = `
    <div style="display:flex;flex-direction:column;justify-content:center;">
      <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem;">${escapeHtml(title)}</h2>
      ${text ? `<p style="color:var(--theme-text-secondary, #666);line-height:1.6;margin-bottom:1.5rem;">${escapeHtml(text)}</p>` : ''}
      ${ctaHtml}
    </div>`;

  const placeholder = '<div style="width:100%;height:100%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>';

  const imagesContent = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      <div style="aspect-ratio:3/4;border-radius:0.5rem;overflow:hidden;">
        ${img1 ? `<img src="${img1}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />` : placeholder}
      </div>
      <div style="aspect-ratio:3/4;border-radius:0.5rem;overflow:hidden;">
        ${img2 ? `<img src="${img2}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />` : placeholder}
      </div>
    </div>`;

  const order = layout === 'text-left'
    ? `${textContent}${imagesContent}`
    : `${imagesContent}${textContent}`;

  return `
    <section style="padding:2rem 0;">
      <div style="max-width:80rem;margin:0 auto;padding:0 1rem;">
        <div style="display:grid;gap:2rem;align-items:center;" class="sf-text-banners">
          ${order}
        </div>
      </div>
    </section>
    <style>@media(min-width:768px){.sf-text-banners{grid-template-columns:1fr 1fr;}}</style>`;
};
