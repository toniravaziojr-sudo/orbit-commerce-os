// =============================================
// STEPS TIMELINE BLOCK COMPILER
// Mirrors: src/components/builder/blocks/StepsTimelineBlock.tsx
// Horizontal or vertical steps with numbered circles
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { escapeHtml } from '../utils.ts';

interface Step {
  id?: string;
  number?: number;
  title: string;
  description: string;
}

export const stepsTimelineToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  _context: CompilerContext,
): string => {
  const title = (props.title as string) || '';
  const subtitle = (props.subtitle as string) || '';
  const steps = (props.steps as Step[]) || [];
  const layout = (props.layout as string) || 'horizontal';
  const accentColor = (props.accentColor as string) || '';
  const showNumbers = props.showNumbers !== false;
  const backgroundColor = (props.backgroundColor as string) || 'transparent';

  if (steps.length === 0) return '';

  const effectiveAccent = accentColor || 'var(--theme-button-primary-bg, #1a1a1a)';
  const isHorizontal = layout === 'horizontal';

  const headerHtml = (title || subtitle) ? `
    <div style="text-align:center;margin-bottom:2.5rem;">
      ${title ? `<h2 style="font-size:1.5rem;font-weight:700;color:inherit;margin-bottom:0.75rem;">${escapeHtml(title)}</h2>` : ''}
      ${subtitle ? `<p style="color:var(--theme-text-secondary, #666);font-size:1.125rem;max-width:42rem;margin:0 auto;">${escapeHtml(subtitle)}</p>` : ''}
    </div>` : '';

  const checkSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  const stepsHtml = steps.map((step, i) => {
    const num = showNumbers ? (step.number ?? i + 1) : checkSvg;
    const circleSize = isHorizontal ? 'width:4rem;height:4rem;font-size:1.125rem;' : 'width:3rem;height:3rem;font-size:1rem;';

    return `
      <div style="position:relative;z-index:10;${isHorizontal ? 'flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;' : 'display:flex;gap:1rem;align-items:flex-start;'}">
        <div style="${circleSize}display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700;background-color:${effectiveAccent};color:#fff;flex-shrink:0;box-shadow:0 4px 14px ${effectiveAccent}40;${isHorizontal ? 'margin-bottom:1rem;' : ''}">
          ${showNumbers ? (step.number ?? i + 1) : checkSvg}
        </div>
        <div style="${isHorizontal ? 'max-width:16rem;' : 'flex:1;padding-bottom:2rem;'}">
          <h3 style="font-weight:600;font-size:1.125rem;color:inherit;margin-bottom:0.5rem;">${escapeHtml(step.title)}</h3>
          <p style="color:var(--theme-text-secondary, #666);font-size:0.875rem;line-height:1.6;">${escapeHtml(step.description)}</p>
        </div>
      </div>`;
  }).join('');

  const containerClass = isHorizontal ? 'sf-steps-h' : 'sf-steps-v';

  return `
    <section style="background-color:${backgroundColor};padding:3rem 1rem;">
      <div style="max-width:72rem;margin:0 auto;">
        ${headerHtml}
        <div class="${containerClass}" style="position:relative;${isHorizontal ? 'display:flex;flex-direction:column;gap:2rem;' : 'display:flex;flex-direction:column;gap:2rem;'}">
          ${stepsHtml}
        </div>
      </div>
    </section>
    <style>
      @media(min-width:768px){
        .sf-steps-h{flex-direction:row!important;align-items:flex-start;justify-content:space-between;gap:1rem!important;}
      }
    </style>`;
};
