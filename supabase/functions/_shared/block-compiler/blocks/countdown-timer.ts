// =============================================
// COUNTDOWN TIMER BLOCK COMPILER
// Mirrors: src/components/builder/blocks/CountdownTimerBlock.tsx
// Server-renders initial state + JS hydration for live countdown
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

export const countdownTimerToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || 'Oferta por tempo limitado';
  const subtitle = (props.subtitle as string) || '';
  const endDate = (props.endDate as string) || '';
  const showDays = props.showDays !== false;
  const showHours = props.showHours !== false;
  const showMinutes = props.showMinutes !== false;
  const showSeconds = props.showSeconds !== false;
  const backgroundColor = (props.backgroundColor as string) || '#dc2626';
  const textColor = (props.textColor as string) || '#ffffff';
  const accentColor = (props.accentColor as string) || '#ffffff';
  const expiredMessage = (props.expiredMessage as string) || 'Oferta encerrada';
  const buttonText = (props.buttonText as string) || '';
  const buttonUrl = (props.buttonUrl as string) || '#';

  const unitStyle = `background-color:${accentColor}20;color:${textColor};`;
  const labelStyle = `color:${textColor};`;

  const renderUnit = (label: string, dataAttr: string) => `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="${unitStyle}font-size:1.875rem;font-weight:700;padding:0.5rem 0.75rem;border-radius:0.5rem;margin-bottom:0.25rem;" data-sf-cd-${dataAttr}>00</div>
      <span style="${labelStyle}font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;opacity:0.8;">${label}</span>
    </div>`;

  const sep = `<span style="color:${textColor};font-size:1.875rem;font-weight:700;margin:0 0.25rem;">:</span>`;

  const units: string[] = [];
  if (showDays) units.push(renderUnit('Dias', 'days'));
  if (showHours) units.push(renderUnit('Horas', 'hours'));
  if (showMinutes) units.push(renderUnit('Min', 'minutes'));
  if (showSeconds) units.push(renderUnit('Seg', 'seconds'));

  const countdownHtml = units.join(sep);

  const ctaHtml = buttonText ? `
    <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;margin-top:1.5rem;padding:0.75rem 2rem;border-radius:0.5rem;font-weight:600;background-color:${textColor};color:${backgroundColor};text-decoration:none;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${escapeHtml(buttonText)}</a>` : '';

  return `
    <section style="background-color:${backgroundColor};padding:2rem 1rem;" data-sf-countdown data-sf-countdown-end="${escapeHtml(endDate)}" data-sf-countdown-expired="${escapeHtml(expiredMessage)}">
      <div style="max-width:56rem;margin:0 auto;text-align:center;">
        ${title ? `<h2 style="color:${textColor};font-size:1.25rem;font-weight:700;margin-bottom:0.5rem;">${escapeHtml(title)}</h2>` : ''}
        ${subtitle ? `<p style="color:${textColor};font-size:0.875rem;margin-bottom:1.5rem;opacity:0.9;">${escapeHtml(subtitle)}</p>` : ''}
        <div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:0.25rem;" data-sf-cd-display>
          ${countdownHtml}
        </div>
        <p style="display:none;color:${textColor};font-size:1.25rem;font-weight:600;" data-sf-cd-expired>${escapeHtml(expiredMessage)}</p>
        ${ctaHtml}
      </div>
    </section>`;
};
