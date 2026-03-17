// =============================================
// BANNER BLOCK COMPILER
// Mirrors: src/components/builder/blocks/BannerBlock.tsx
// =============================================
// KEY PARITY POINTS from React component:
// - layoutPreset: 'standard' | 'compact-centered' | 'compact-full' | 'large'
// - bannerType: 'image' | 'solid'
// - hasEditableContent toggle
// - Per-slide CTA: title, subtitle, buttonText, buttonUrl
// - Overlay opacity
// - Button uses per-banner props (buttonColor, buttonTextColor), not theme vars
// - Uses <picture> with srcMobile
// - Carousel: renders ALL slides with JS rotation
// - RESPONSIVE CTA: mobile justify-between layout
// =============================================

import type { CompilerContext } from '../types.ts';
import { escapeHtml, optimizeImageUrl } from '../utils.ts';

// Generate unique ID to avoid CSS class collisions
function uid(): string {
  return 'sf-b-' + Math.random().toString(36).slice(2, 8);
}

// ===== Resolve layoutPreset — mirrors BannerBlock.tsx resolvePreset exactly =====
function resolvePreset(
  layoutPreset?: string,
  height?: string,
  bannerWidth?: string,
): 'standard' | 'compact-centered' | 'compact-full' | 'large' {
  if (layoutPreset && ['standard', 'compact-centered', 'compact-full', 'large'].includes(layoutPreset)) {
    return layoutPreset as any;
  }
  // Fallback: infer from legacy props
  if (height === 'full' || height === 'lg') return 'large';
  if (height === 'sm' || height === 'md') {
    return bannerWidth === 'contained' ? 'compact-centered' : 'compact-full';
  }
  return bannerWidth === 'contained' ? 'compact-centered' : 'standard';
}

// ===== Preset config — mirrors BannerBlock.tsx PRESET_CONFIG exactly =====
const PRESET_CONFIG = {
  'standard': {
    useAspect: true,
    fullWidth: true,
    naturalHeight: false,
    minHeight: undefined as string | undefined,
  },
  'compact-centered': {
    useAspect: false,
    fullWidth: false, // contained on desktop
    naturalHeight: true, // image determines height
    minHeight: undefined as string | undefined,
  },
  'compact-full': {
    useAspect: false,
    fullWidth: true, // full width on desktop
    naturalHeight: true, // image determines height
    minHeight: undefined as string | undefined,
  },
  'large': {
    useAspect: false,
    fullWidth: true,
    naturalHeight: false,
    minHeight: '100vh',
  },
} as const;

export function bannerToStaticHTML(
  props: Record<string, unknown>,
  _context: CompilerContext,
): string {
  const mode = (props.mode as string) || 'single';
  const slides = Array.isArray(props.slides) ? props.slides as any[] : [];
  const autoplaySeconds = (props.autoplaySeconds as number) || 5;

  // Single mode or no slides → original behavior
  if (mode !== 'carousel' || slides.length <= 1) {
    return renderSingleBanner(props, slides.length > 0 ? slides[0] : null);
  }

  // Carousel mode with multiple slides
  return renderCarousel(props, slides, autoplaySeconds);
}

/**
 * Build responsive CTA style tag.
 */
function buildCtaStyleTag(bannerId: string, alignment: string, buttonAlignment: string): string {
  const maxWidthDesktop = alignment !== 'center' ? 'max-width:55%;' : '';
  const btnAlignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const effectiveBtnAlign = (!buttonAlignment || buttonAlignment === 'auto') ? alignment : buttonAlignment;
  const btnJustify = btnAlignMap[effectiveBtnAlign] || 'center';
  return `<style>
.${bannerId}-cta{position:absolute;inset:0;display:flex;flex-direction:column;z-index:2;padding:32px 20px;}
.${bannerId}-cta h2{font-size:clamp(24px,5vw,36px);font-weight:700;font-family:var(--sf-heading-font);line-height:1.1;}
.${bannerId}-cta p{font-size:clamp(14px,2.5vw,16px);opacity:0.9;margin-top:8px;}
.${bannerId}-btn-wrap{display:flex;justify-content:${btnJustify};margin-top:12px;}
.${bannerId}-btn{display:inline-block;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;transition:opacity 0.2s;}
@media(min-width:768px){
.${bannerId}-cta{padding:48px 64px;${maxWidthDesktop}justify-content:center;}
.${bannerId}-cta h2{font-size:clamp(28px,5vw,60px);}
.${bannerId}-cta p{font-size:clamp(16px,2.5vw,24px);}
.${bannerId}-btn{padding:16px 40px;font-size:18px;}
}
@media(max-width:767px){
.${bannerId}-cta{justify-content:space-between;align-items:center;}
.${bannerId}-cta .${bannerId}-bottom{text-align:center;}
}
</style>`;
}

function renderSingleBanner(props: Record<string, unknown>, slide: any | null): string {
  let imageDesktop = (props.imageDesktop as string) || '';
  let imageMobile = (props.imageMobile as string) || '';
  let currentTitle = (props.title as string) || '';
  let currentSubtitle = (props.subtitle as string) || '';
  let currentButtonText = (props.buttonText as string) || '';
  let currentButtonUrl = (props.buttonUrl as string) || '';
  let currentLinkUrl = (props.linkUrl as string) || '';

  if (slide) {
    imageDesktop = slide.imageDesktop || imageDesktop;
    imageMobile = slide.imageMobile || slide.imageDesktop || imageMobile;
    currentTitle = slide.title || currentTitle;
    currentSubtitle = slide.subtitle || currentSubtitle;
    currentButtonText = slide.buttonText || currentButtonText;
    currentButtonUrl = slide.buttonUrl || currentButtonUrl;
    currentLinkUrl = slide.linkUrl || currentLinkUrl;
  }

  const overlayOpacity = (props.overlayOpacity as number) || 0;
  const textColor = (props.textColor as string) || '#ffffff';
  const alignment = (props.alignment as string) || 'center';
  const buttonAlignment = (props.buttonAlignment as string) || 'auto';
  const backgroundColor = (props.backgroundColor as string) || '';
  const buttonColor = (props.buttonColor as string) || '#ffffff';
  const buttonTextColor = (props.buttonTextColor as string) || (buttonColor ? '#ffffff' : '#1a1a1a');
  const bannerType = (props.bannerType as string) || 'image';

  // ===== PRESET RESOLUTION (mirrors BannerBlock.tsx) =====
  const layoutPreset = props.layoutPreset as string | undefined;
  const height = (props.height as string) || 'auto';
  const bannerWidth = (props.bannerWidth as string) || 'full';
  const preset = resolvePreset(layoutPreset, height, bannerWidth);
  const presetCfg = PRESET_CONFIG[preset];

  // Solid banner: no images
  const isSolid = bannerType === 'solid';
  const effectiveDesktop = isSolid ? '' : imageDesktop;
  const effectiveMobile = isSolid ? '' : (imageMobile || imageDesktop);

  const optDesktop = optimizeImageUrl(effectiveDesktop, 1920, 85);
  const optMobile = optimizeImageUrl(effectiveMobile || effectiveDesktop, 768, 80);

  // hasEditableContent resolution
  const hasEditableContent = props.hasEditableContent !== undefined
    ? Boolean(props.hasEditableContent)
    : !!(props.title || props.buttonText);
  const hasCTA = hasEditableContent && !!(currentTitle || currentSubtitle || currentButtonText);

  // Width style based on preset
  const widthStyle = presetCfg.fullWidth
    ? 'width:100%;'
    : 'max-width:1280px;margin-left:auto;margin-right:auto;';

  // Container sizing based on preset
  let containerHeight = '';
  if (presetCfg.minHeight) {
    containerHeight = `min-height:${presetCfg.minHeight};`;
  }

  // Image style based on preset
  const imgStyle = presetCfg.naturalHeight
    ? 'width:100%;height:auto;display:block;'
    : (presetCfg.useAspect || presetCfg.minHeight)
      ? 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;'
      : 'width:100%;height:auto;display:block;';

  const useAbsoluteImage = !presetCfg.naturalHeight && (presetCfg.useAspect || !!presetCfg.minHeight || hasCTA);

  const overlayHtml = overlayOpacity > 0
    ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,${overlayOpacity / 100});"></div>`
    : '';

  let imageHtml = '';
  if (optDesktop) {
    const sourceTag = optMobile && optMobile !== optDesktop
      ? `<source srcset="${escapeHtml(optMobile)}" media="(max-width:768px)">`
      : '';
    imageHtml = `<picture${presetCfg.naturalHeight ? ' style="display:block;width:100%;"' : ''}>
      ${sourceTag}
      <img src="${escapeHtml(optDesktop)}" alt="${escapeHtml(currentTitle || 'Banner')}" style="${imgStyle}" loading="eager" fetchpriority="high">
    </picture>`;
  }

  const bannerId = uid();
  const alignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const justifyContent = alignMap[alignment] || 'center';
  const textAlign = alignment;

  let ctaHtml = '';
  let ctaStyleTag = '';
  if (hasCTA) {
    ctaStyleTag = buildCtaStyleTag(bannerId, alignment, buttonAlignment);
    const titleHtml = currentTitle ? `<h2 style="color:${textColor};">${escapeHtml(currentTitle)}</h2>` : '';
    const subtitleHtml = currentSubtitle ? `<p style="color:${textColor};">${escapeHtml(currentSubtitle)}</p>` : '';
    const buttonHtml = currentButtonText ? `<div class="${bannerId}-btn-wrap"><a href="${escapeHtml(currentButtonUrl || currentLinkUrl || '#')}" class="${bannerId}-btn" style="background:${escapeHtml(buttonColor)};color:${escapeHtml(buttonTextColor)};">${escapeHtml(currentButtonText)}</a></div>` : '';
    
    ctaHtml = `<div class="${bannerId}-cta" style="align-items:${justifyContent};text-align:${textAlign};">
      <div>${titleHtml}</div>
      <div class="${bannerId}-bottom">${subtitleHtml}${buttonHtml}</div>
    </div>`;
  }

  // Aspect ratio for standard preset
  const aspectClass = presetCfg.useAspect ? `${bannerId}-ar` : '';
  const aspectStyleTag = presetCfg.useAspect
    ? `<style>.${bannerId}-ar{aspect-ratio:4/5;}@media(min-width:768px){.${bannerId}-ar{aspect-ratio:12/5;}}</style>`
    : '';

  // Width class for compact-centered: full on mobile, contained on desktop
  const widthCssBlock = !presetCfg.fullWidth
    ? `<style>.${bannerId}-w{width:100%;}@media(min-width:768px){.${bannerId}-w{max-width:1280px;margin-left:auto;margin-right:auto;}}</style>`
    : '';
  const widthCssClass = !presetCfg.fullWidth ? `${bannerId}-w` : '';

  const wrapperTag = currentLinkUrl && !hasCTA ? 'a' : 'div';
  const wrapperHref = currentLinkUrl && !hasCTA ? ` href="${escapeHtml(currentLinkUrl)}"` : '';

  const inlineWidthStyle = presetCfg.fullWidth ? 'width:100%;' : '';

  return `${aspectStyleTag}${widthCssBlock}${ctaStyleTag}<${wrapperTag}${wrapperHref} class="${[aspectClass, widthCssClass].filter(Boolean).join(' ')}" style="position:relative;${inlineWidthStyle}${containerHeight}overflow:hidden;${useAbsoluteImage ? `display:flex;align-items:center;justify-content:${justifyContent};` : ''}${backgroundColor && !optDesktop ? `background-color:${escapeHtml(backgroundColor)};${presetCfg.naturalHeight ? 'min-height:200px;' : ''}` : !optDesktop ? 'background:#f5f5f5;' : ''}">
    ${imageHtml}
    ${overlayHtml}
    ${ctaHtml}
  </${wrapperTag}>`;
}

function renderCarousel(props: Record<string, unknown>, slides: any[], autoplaySeconds: number): string {
  const showDots = (props.showDots as boolean) ?? true;
  const showArrows = (props.showArrows as boolean) ?? false;

  // ===== PRESET RESOLUTION =====
  const layoutPreset = props.layoutPreset as string | undefined;
  const height = (props.height as string) || 'auto';
  const bannerWidth = (props.bannerWidth as string) || 'full';
  const preset = resolvePreset(layoutPreset, height, bannerWidth);
  const presetCfg = PRESET_CONFIG[preset];

  // Shared style props for CTA rendering
  const overlayOpacity = (props.overlayOpacity as number) || 0;
  const textColor = (props.textColor as string) || '#ffffff';
  const alignment = (props.alignment as string) || 'center';
  const buttonAlignment = (props.buttonAlignment as string) || 'auto';
  const buttonColor = (props.buttonColor as string) || '#ffffff';
  const buttonTextColor = (props.buttonTextColor as string) || (buttonColor ? '#ffffff' : '#1a1a1a');
  const alignMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const justifyContent = alignMap[alignment] || 'center';
  const textAlign = alignment;

  const carouselId = uid();

  // Check if any slide has CTA content
  const anySlideHasCTA = slides.some(s => s.title || s.subtitle || s.buttonText);
  const ctaStyleTag = anySlideHasCTA ? buildCtaStyleTag(carouselId, alignment, buttonAlignment) : '';

  // Image style for carousel slides based on preset
  const slideImgStyle = presetCfg.naturalHeight
    ? 'width:100%;height:auto;display:block;'
    : 'width:100%;height:100%;object-fit:cover;';

  // Build slides HTML
  const slidesHtml = slides.map((slide, idx) => {
    const rawDesktop = (slide.imageDesktop || '').trim();
    const rawMobile = (slide.imageMobile || '').trim() || rawDesktop;
    const effectiveDesktop = rawDesktop || rawMobile;
    const effectiveMobile = rawMobile || rawDesktop;
    const desktopImage = optimizeImageUrl(effectiveDesktop, 1920, 85);
    const mobileImage = optimizeImageUrl(effectiveMobile, 768, 80);
    const altText = slide.altText || slide.title || `Banner ${idx + 1}`;
    const linkUrl = slide.linkUrl || '';
    const isFirst = idx === 0;

    const sourceTag = mobileImage && mobileImage !== desktopImage
      ? `<source media="(max-width: 767px)" srcset="${escapeHtml(mobileImage)}">`
      : '';

    const imgHtml = effectiveDesktop ? `<picture>
      ${sourceTag}
      <img src="${escapeHtml(desktopImage)}" alt="${escapeHtml(altText)}" style="${slideImgStyle}" ${isFirst ? 'fetchpriority="high" decoding="sync" loading="eager"' : 'loading="lazy"'}>
    </picture>` : '';

    const slideTitle = slide.title || '';
    const slideSubtitle = slide.subtitle || '';
    const slideButtonText = slide.buttonText || '';
    const slideButtonUrl = slide.buttonUrl || linkUrl || '#';
    const hasCTA = !!(slideTitle || slideSubtitle || slideButtonText);

    let overlayHtml = '';
    if (overlayOpacity > 0) {
      overlayHtml = `<div style="position:absolute;inset:0;background:rgba(0,0,0,${overlayOpacity / 100});"></div>`;
    }

    let ctaHtml = '';
    if (hasCTA) {
      const titleHtml = slideTitle ? `<h2 style="color:${textColor};">${escapeHtml(slideTitle)}</h2>` : '';
      const subtitleHtml = slideSubtitle ? `<p style="color:${textColor};">${escapeHtml(slideSubtitle)}</p>` : '';
      const buttonHtml = slideButtonText ? `<div class="${carouselId}-btn-wrap"><a href="${escapeHtml(slideButtonUrl)}" class="${carouselId}-btn" style="background:${escapeHtml(buttonColor)};color:${escapeHtml(buttonTextColor)};">${escapeHtml(slideButtonText)}</a></div>` : '';
      ctaHtml = `<div class="${carouselId}-cta" style="align-items:${justifyContent};text-align:${textAlign};">
        <div>${titleHtml}</div>
        <div class="${carouselId}-bottom">${subtitleHtml}${buttonHtml}</div>
      </div>`;
    }

    const wrapTag = linkUrl && !hasCTA ? 'a' : 'div';
    const wrapHref = linkUrl && !hasCTA ? ` href="${escapeHtml(linkUrl)}"` : '';

    return `<${wrapTag}${wrapHref} class="${carouselId}-slide" data-slide-index="${idx}" style="position:absolute;inset:0;opacity:${isFirst ? '1' : '0'};transition:opacity 0.6s ease-in-out;z-index:${isFirst ? '1' : '0'};">
      ${imgHtml}
      ${overlayHtml}
      ${ctaHtml}
    </${wrapTag}>`;
  }).join('');

  // Dots HTML
  let dotsHtml = '';
  if (showDots && slides.length > 1) {
    const dots = slides.map((_, idx) => {
      const isActive = idx === 0;
      return `<button class="${carouselId}-dot" data-dot-index="${idx}" style="width:${isActive ? '24px' : '10px'};height:10px;border-radius:9999px;border:none;background:${isActive ? 'var(--theme-button-primary-bg, #1a1a1a)' : 'rgba(255,255,255,0.6)'};cursor:pointer;transition:all 0.3s;padding:0;" aria-label="Banner ${idx + 1}"></button>`;
    }).join('');
    dotsHtml = `<div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:5;">${dots}</div>`;
  }

  // Arrows HTML
  let arrowsHtml = '';
  if (showArrows && slides.length > 1) {
    arrowsHtml = `
      <button class="${carouselId}-prev" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);z-index:5;background:rgba(255,255,255,0.8);border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:background 0.2s;" aria-label="Anterior">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="${carouselId}-next" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:5;background:rgba(255,255,255,0.8);border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:background 0.2s;" aria-label="Próximo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>`;
  }

  const carouselScript = `<script>(function(){
    var id="${carouselId}",cur=0,total=${slides.length},delay=${autoplaySeconds * 1000};
    var slides=document.querySelectorAll("."+id+"-slide");
    var dots=document.querySelectorAll("."+id+"-dot");
    if(slides.length<2)return;
    function go(n){
      slides[cur].style.opacity="0";slides[cur].style.zIndex="0";
      if(dots[cur]){dots[cur].style.width="10px";dots[cur].style.background="rgba(255,255,255,0.6)";}
      cur=(n+total)%total;
      slides[cur].style.opacity="1";slides[cur].style.zIndex="1";
      if(dots[cur]){dots[cur].style.width="24px";dots[cur].style.background="var(--theme-button-primary-bg,#1a1a1a)";}
    }
    var timer=setInterval(function(){go(cur+1)},delay);
    dots.forEach(function(d,i){d.addEventListener("click",function(){clearInterval(timer);go(i);timer=setInterval(function(){go(cur+1)},delay);});});
    var prev=document.querySelector("."+id+"-prev"),next=document.querySelector("."+id+"-next");
    if(prev)prev.addEventListener("click",function(){clearInterval(timer);go(cur-1);timer=setInterval(function(){go(cur+1)},delay);});
    if(next)next.addEventListener("click",function(){clearInterval(timer);go(cur+1);timer=setInterval(function(){go(cur+1)},delay);});
  })();</script>`;

  // Width based on preset
  const widthStyleInline = presetCfg.fullWidth ? 'width:100%;' : '';
  const widthCssBlock = !presetCfg.fullWidth
    ? `<style>.${carouselId}-w{width:100%;}@media(min-width:768px){.${carouselId}-w{max-width:1280px;margin-left:auto;margin-right:auto;}}</style>`
    : '';
  const widthCssClass = !presetCfg.fullWidth ? `${carouselId}-w` : '';

  // Aspect/sizing based on preset
  let sizingCssBlock = '';
  let sizingClass = '';
  if (presetCfg.useAspect) {
    sizingClass = `${carouselId}-wrap`;
    sizingCssBlock = `<style>.${carouselId}-wrap{aspect-ratio:4/5;}@media(min-width:768px){.${carouselId}-wrap{aspect-ratio:12/5;}}</style>`;
  } else if (presetCfg.minHeight) {
    sizingClass = `${carouselId}-wrap`;
    sizingCssBlock = `<style>.${carouselId}-wrap{min-height:${presetCfg.minHeight};}</style>`;
  } else {
    // naturalHeight — no fixed sizing, slides determine height
    sizingClass = `${carouselId}-wrap`;
  }

  return `${ctaStyleTag}${widthCssBlock}<div class="${widthCssClass}" style="position:relative;overflow:hidden;${widthStyleInline}">
    ${sizingCssBlock}
    <div class="${sizingClass}" style="position:relative;">
      ${slidesHtml}
    </div>
    ${dotsHtml}
    ${arrowsHtml}
  </div>${carouselScript}`;
}
