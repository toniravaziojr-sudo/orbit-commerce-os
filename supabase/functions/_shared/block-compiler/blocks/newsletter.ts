// =============================================
// NEWSLETTER BLOCK COMPILER — Email capture form
// Mirrors: src/components/builder/blocks/interactive/NewsletterBlock.tsx
// Static HTML with form action via JS hydration
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

export const newsletterToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || 'Receba nossas novidades';
  const subtitle = (props.subtitle as string) || 'Cadastre-se e receba ofertas exclusivas em primeira mão!';
  const placeholder = (props.placeholder as string) || 'Digite seu e-mail';
  const buttonText = (props.buttonText as string) || 'Inscrever-se';
  const layout = (props.layout as string) || 'horizontal';
  const showIcon = props.showIcon !== false;
  const showIncentive = props.showIncentive === true;
  const incentiveText = (props.incentiveText as string) || '🎁 Ganhe 10% OFF na primeira compra!';
  const backgroundColor = (props.backgroundColor as string) || '';
  const textColor = (props.textColor as string) || '';
  const buttonBgColor = (props.buttonBgColor as string) || 'var(--theme-button-primary-bg, #1a1a1a)';
  const buttonTextColor = (props.buttonTextColor as string) || 'var(--theme-button-primary-text, #fff)';

  const bgStyle = backgroundColor ? `background:${backgroundColor};` : 'background:rgba(0,0,0,0.03);';
  const txtStyle = textColor ? `color:${textColor};` : '';
  const btnStyle = `background:${buttonBgColor};color:${buttonTextColor};border:none;padding:0.625rem 1.25rem;border-radius:0.375rem;font-weight:500;cursor:pointer;white-space:nowrap;`;

  const mailIcon = showIcon ? `<svg style="width:24px;height:24px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>` : '';

  const incentiveHtml = showIncentive && incentiveText
    ? `<div style="display:inline-flex;align-items:center;gap:0.5rem;margin-top:0.5rem;font-size:0.875rem;font-weight:500;color:var(--theme-button-primary-bg,#1a1a1a);">${escapeHtml(incentiveText)}</div>`
    : '';

  const inputHtml = `<input type="email" name="email" placeholder="${escapeHtml(placeholder)}" required style="flex:1;padding:0.625rem 0.75rem;border:1px solid #d1d5db;border-radius:0.375rem;font-size:0.875rem;min-width:0;">`;

  if (layout === 'vertical' || layout === 'card') {
    const cardExtra = layout === 'card' ? 'background:#fff;padding:2rem;border-radius:0.75rem;box-shadow:0 4px 12px rgba(0,0,0,0.08);border:1px solid #e5e7eb;' : '';
    return `<section style="padding:3rem 1rem;${bgStyle}${txtStyle}">
  <div style="max-width:28rem;margin:0 auto;text-align:center;${cardExtra}">
    ${mailIcon ? `<div style="display:flex;justify-content:center;margin-bottom:1rem;"><div style="padding:0.75rem;border-radius:50%;background:rgba(0,0,0,0.05);">${mailIcon}</div></div>` : ''}
    ${title ? `<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">${escapeHtml(title)}</h2>` : ''}
    ${subtitle ? `<p style="color:#666;margin-bottom:1rem;">${escapeHtml(subtitle)}</p>` : ''}
    ${incentiveHtml}
    <form data-sf-newsletter class="sf-newsletter-form" style="margin-top:1rem;">
      <div style="display:flex;flex-direction:column;gap:0.75rem;">
        ${inputHtml}
        <button type="submit" style="${btnStyle}width:100%;">${escapeHtml(buttonText)}</button>
      </div>
    </form>
    <p style="font-size:0.75rem;color:#999;margin-top:1rem;">Ao se inscrever, você concorda com nossa política de privacidade.</p>
  </div>
</section>`;
  }

  // Horizontal (default)
  return `<section style="padding:3rem 1rem;${bgStyle}${txtStyle}">
  <div style="max-width:56rem;margin:0 auto;">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:1.5rem;">
      <div style="flex:1;min-width:200px;">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
          ${mailIcon}
          ${title ? `<h2 style="font-size:1.25rem;font-weight:700;">${escapeHtml(title)}</h2>` : ''}
        </div>
        ${subtitle ? `<p style="color:#666;">${escapeHtml(subtitle)}</p>` : ''}
        ${incentiveHtml}
      </div>
      <form data-sf-newsletter class="sf-newsletter-form" style="flex:1;min-width:200px;">
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
          ${inputHtml}
          <button type="submit" style="${btnStyle}">${escapeHtml(buttonText)}</button>
        </div>
      </form>
    </div>
  </div>
</section>`;
};
