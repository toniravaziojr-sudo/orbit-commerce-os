// =============================================
// BANNER BLOCK COMPILER (single image/text banner)
// Mirrors: src/components/builder/blocks/BannerBlock.tsx
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

export function bannerToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
): string {
  let imageDesktop = props.imageDesktop as string || '';
  let imageMobile = props.imageMobile as string || '';
  const title = props.title as string || '';
  const subtitle = props.subtitle as string || '';
  const buttonText = props.buttonText as string || '';
  const buttonUrl = props.buttonUrl as string || '';
  const linkUrl = props.linkUrl as string || '';
  const mode = props.mode as string || '';
  const slides = Array.isArray(props.slides) ? props.slides : [];

  // Carousel mode: use first slide
  if (mode === 'carousel' && slides.length > 0) {
    const first = slides[0] as any;
    imageDesktop = first.imageDesktop || imageDesktop;
    imageMobile = first.imageMobile || imageMobile;
  }

  const height = props.height as string || 'auto';
  const overlayOpacity = (props.overlayOpacity as number) || 0;
  const textColor = (props.textColor as string) || '#ffffff';
  const alignment = (props.alignment as string) || 'center';
  
  const heightMap: Record<string, string> = {
    sm: '300px', md: '400px', lg: '500px', full: '100vh', auto: 'auto',
  };
  const cssHeight = heightMap[height] || 'auto';
  const alignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const justifyContent = alignMap[alignment] || 'center';

  const optDesktop = optimizeImageUrl(imageDesktop, 1920, 85);
  const optMobile = optimizeImageUrl(imageMobile || imageDesktop, 768, 80);

  const hasOverlayContent = !!(title || subtitle || buttonText);
  const isAutoHeight = cssHeight === 'auto';
  const useAbsoluteImage = !isAutoHeight || hasOverlayContent;
  const containerHeight = isAutoHeight 
    ? (hasOverlayContent ? 'min-height:400px;' : '') 
    : `height:${cssHeight};`;

  const overlayHtml = overlayOpacity > 0
    ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,${overlayOpacity / 100});"></div>`
    : '';

  const textHtml = hasOverlayContent ? `
    <div style="position:relative;z-index:2;text-align:${alignment};display:flex;flex-direction:column;align-items:${justifyContent};gap:12px;padding:24px;max-width:800px;">
      ${title ? `<h1 style="font-size:clamp(24px,5vw,48px);font-weight:700;color:${textColor};font-family:var(--sf-heading-font);line-height:1.2;">${escapeHtml(title)}</h1>` : ''}
      ${subtitle ? `<p style="font-size:clamp(14px,2.5vw,20px);color:${textColor};opacity:0.9;">${escapeHtml(subtitle)}</p>` : ''}
      ${buttonText ? `<a href="${escapeHtml(buttonUrl || linkUrl || '#')}" style="display:inline-block;margin-top:8px;padding:12px 32px;background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border-radius:6px;font-weight:600;font-size:16px;">${escapeHtml(buttonText)}</a>` : ''}
    </div>` : '';

  const wrapperTag = linkUrl && !buttonText ? 'a' : 'div';
  const wrapperHref = linkUrl && !buttonText ? ` href="${escapeHtml(linkUrl)}"` : '';

  return `<${wrapperTag}${wrapperHref} style="position:relative;width:100%;${containerHeight}overflow:hidden;${useAbsoluteImage ? `display:flex;align-items:center;justify-content:${justifyContent};` : ''}background:#f5f5f5;">
    ${optDesktop ? `<picture>
      ${optMobile !== optDesktop ? `<source srcset="${escapeHtml(optMobile)}" media="(max-width:768px)">` : ''}
      <img src="${escapeHtml(optDesktop)}" alt="${escapeHtml(title || 'Banner')}" style="${useAbsoluteImage ? 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' : 'width:100%;height:auto;display:block;'}" loading="eager" fetchpriority="high">
    </picture>` : ''}
    ${overlayHtml}
    ${textHtml}
  </${wrapperTag}>`;
}
