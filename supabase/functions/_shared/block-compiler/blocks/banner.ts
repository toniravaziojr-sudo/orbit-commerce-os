// =============================================
// BANNER BLOCK COMPILER
// Mirrors: src/components/builder/blocks/BannerBlock.tsx
// =============================================
// KEY PARITY POINTS from React component:
// - Supports 'single' and 'carousel' modes
// - Per-slide CTA: title, subtitle, buttonText, buttonUrl
// - Height: sm/md/lg/full/auto with aspect-ratio fallback
// - Overlay opacity
// - Button uses per-banner props (buttonColor, buttonTextColor), not theme vars
// - Uses <picture> with srcMobile
// - Carousel: static render shows first slide only
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

export function bannerToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
): string {
  const mode = (props.mode as string) || 'single';
  const slides = Array.isArray(props.slides) ? props.slides as any[] : [];

  // Determine current slide data
  let imageDesktop = (props.imageDesktop as string) || '';
  let imageMobile = (props.imageMobile as string) || '';
  let currentTitle = (props.title as string) || '';
  let currentSubtitle = (props.subtitle as string) || '';
  let currentButtonText = (props.buttonText as string) || '';
  let currentButtonUrl = (props.buttonUrl as string) || '';
  let currentLinkUrl = (props.linkUrl as string) || '';

  // Carousel mode: use first slide's data
  if (mode === 'carousel' && slides.length > 0) {
    const first = slides[0];
    imageDesktop = first.imageDesktop || imageDesktop;
    imageMobile = first.imageMobile || first.imageDesktop || imageMobile;
    currentTitle = first.title || currentTitle;
    currentSubtitle = first.subtitle || currentSubtitle;
    currentButtonText = first.buttonText || currentButtonText;
    currentButtonUrl = first.buttonUrl || currentButtonUrl;
    currentLinkUrl = first.linkUrl || currentLinkUrl;
  }

  const height = (props.height as string) || 'auto';
  const overlayOpacity = (props.overlayOpacity as number) || 0;
  const textColor = (props.textColor as string) || '#ffffff';
  const alignment = (props.alignment as string) || 'center';
  const backgroundColor = (props.backgroundColor as string) || '';
  const bannerWidth = (props.bannerWidth as string) || 'full';
  
  // Button colors — use per-banner props (parity with React)
  const buttonColor = (props.buttonColor as string) || '#ffffff';
  const buttonTextColor = (props.buttonTextColor as string) || (buttonColor ? '#ffffff' : '#1a1a1a');

  const heightMap: Record<string, string> = {
    sm: '300px', md: '400px', lg: '500px', full: '100vh', auto: 'auto',
  };
  const cssHeight = heightMap[height] || 'auto';
  const alignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const justifyContent = alignMap[alignment] || 'center';
  const textAlign = alignment;

  const optDesktop = optimizeImageUrl(imageDesktop, 1920, 85);
  const optMobile = optimizeImageUrl(imageMobile || imageDesktop, 768, 80);

  const hasCTA = !!(currentTitle || currentSubtitle || currentButtonText);
  const isAutoHeight = cssHeight === 'auto';

  // Container sizing
  const widthStyle = bannerWidth === 'full' ? 'width:100%;' : 'max-width:1280px;margin-left:auto;margin-right:auto;';
  const containerHeight = isAutoHeight
    ? (hasCTA ? 'min-height:400px;' : '')
    : `height:${cssHeight};`;
  
  // Image positioning
  const useAbsoluteImage = !isAutoHeight || hasCTA;
  const imgStyle = useAbsoluteImage
    ? 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;'
    : 'width:100%;height:auto;display:block;';

  // Overlay
  const overlayHtml = overlayOpacity > 0
    ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,${overlayOpacity / 100});"></div>`
    : '';

  // Image with <picture>
  let imageHtml = '';
  if (optDesktop) {
    const sourceTag = optMobile && optMobile !== optDesktop
      ? `<source srcset="${escapeHtml(optMobile)}" media="(max-width:768px)">`
      : '';
    imageHtml = `<picture>
      ${sourceTag}
      <img src="${escapeHtml(optDesktop)}" alt="${escapeHtml(currentTitle || 'Banner')}" style="${imgStyle}" loading="eager" fetchpriority="high">
    </picture>`;
  }

  // CTA overlay
  let ctaHtml = '';
  if (hasCTA) {
    ctaHtml = `<div style="position:relative;z-index:2;text-align:${textAlign};display:flex;flex-direction:column;align-items:${justifyContent};gap:12px;padding:24px;max-width:800px;">
      ${currentTitle ? `<h2 style="font-size:clamp(24px,5vw,48px);font-weight:700;color:${textColor};font-family:var(--sf-heading-font);line-height:1.2;">${escapeHtml(currentTitle)}</h2>` : ''}
      ${currentSubtitle ? `<p style="font-size:clamp(14px,2.5vw,20px);color:${textColor};opacity:0.9;">${escapeHtml(currentSubtitle)}</p>` : ''}
      ${currentButtonText ? `<a href="${escapeHtml(currentButtonUrl || currentLinkUrl || '#')}" style="display:inline-block;margin-top:8px;padding:12px 32px;background:${escapeHtml(buttonColor)};color:${escapeHtml(buttonTextColor)};border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;transition:opacity 0.2s;">${escapeHtml(currentButtonText)}</a>` : ''}
    </div>`;
  }

  // Aspect ratio for auto height without CTA
  // Match React: aspect-[21/9] on mobile, aspect-[21/7] on desktop
  const needsAspect = isAutoHeight && !hasCTA;
  const aspectClass = needsAspect ? 'sf-banner-auto' : '';
  const aspectStyleTag = needsAspect ? '<style>.sf-banner-auto{aspect-ratio:21/9;}@media(min-width:768px){.sf-banner-auto{aspect-ratio:21/7;}}</style>' : '';

  const wrapperTag = currentLinkUrl && !hasCTA ? 'a' : 'div';
  const wrapperHref = currentLinkUrl && !hasCTA ? ` href="${escapeHtml(currentLinkUrl)}"` : '';

  return `${aspectStyleTag}<${wrapperTag}${wrapperHref} class="${aspectClass}" style="position:relative;${widthStyle}${containerHeight}overflow:hidden;${useAbsoluteImage ? `display:flex;align-items:center;justify-content:${justifyContent};` : ''}${backgroundColor && !optDesktop ? `background-color:${escapeHtml(backgroundColor)};` : 'background:#f5f5f5;'}">
    ${imageHtml}
    ${overlayHtml}
    ${ctaHtml}
  </${wrapperTag}>`;
}
